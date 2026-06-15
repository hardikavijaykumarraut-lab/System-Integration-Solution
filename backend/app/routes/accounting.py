from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from app import mongo
from app.utils.decorators import admin_required
from app.utils.helpers import generate_unique_id, serialize_document, paginate_results

accounting_bp = Blueprint('accounting', __name__)

@accounting_bp.route('/transactions', methods=['GET'])
@jwt_required()
def get_transactions():
    """Get all financial transactions with filtering - includes payments and transactions."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    # Only admin and clients (for their own projects) can view transactions
    if current_user.get('role') not in ['admin', 'client']:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 50))
    transaction_type = request.args.get('type')  # income, expense
    category = request.args.get('category')
    project_id = request.args.get('project_id')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    all_transactions = []
    
    # Get transactions from transactions collection (expenses and manual income)
    query = {}
    if current_user.get('role') == 'client':
        client_projects = mongo.db.projects.find({'client_id': current_user_id}, {'_id': 1})
        project_ids = [p['_id'] for p in client_projects]
        query['project_id'] = {'$in': project_ids}
    elif project_id:
        query['project_id'] = project_id
    
    if transaction_type and transaction_type != 'income':
        query['type'] = transaction_type
    if category:
        query['category'] = category
    if start_date or end_date:
        query['date'] = {}
        if start_date:
            query['date']['$gte'] = start_date
        if end_date:
            query['date']['$lte'] = end_date
    
    # Get admin transactions (expenses and transfers)
    if not transaction_type or transaction_type == 'expense':
        transactions_cursor = mongo.db.transactions.find(query).sort('date', -1)
        for transaction in transactions_cursor:
            transaction['source'] = 'transaction'
            all_transactions.append(transaction)
    
    # Get client payments as income transactions
    if not transaction_type or transaction_type == 'income':
        payment_query = {'status': 'completed'}
        if current_user.get('role') == 'client':
            payment_query['client_id'] = current_user_id
        
        if start_date or end_date:
            payment_query['created_at'] = {}
            if start_date:
                payment_query['created_at']['$gte'] = datetime.fromisoformat(start_date)
            if end_date:
                payment_query['created_at']['$lte'] = datetime.fromisoformat(end_date)
        
        payments_cursor = mongo.db.payments.find(payment_query).sort('created_at', -1)
        for payment in payments_cursor:
            # Convert payment to transaction format
            transaction = {
                '_id': payment['_id'],
                'type': 'income',
                'amount': payment['amount'],
                'description': f"Payment from {payment.get('client_name', 'Client')} - {payment.get('package_name', 'Service')}",
                'category': 'client_payment',
                'date': payment['created_at'].strftime('%Y-%m-%d') if isinstance(payment['created_at'], datetime) else payment['created_at'],
                'payment_method': payment.get('payment_mode', 'online'),
                'reference_number': payment.get('receipt_id', payment.get('transaction_id', '')),
                'notes': f"Client: {payment.get('client_email', '')}",
                'project_id': payment.get('project_id'),
                'client_id': payment.get('client_id'),
                'created_at': payment['created_at'],
                'source': 'payment'
            }
            all_transactions.append(transaction)
    
    # Sort all transactions by date (newest first)
    all_transactions.sort(key=lambda x: x.get('created_at', x.get('date', '')), reverse=True)
    
    # Paginate results
    total = len(all_transactions)
    total_pages = (total + per_page - 1) // per_page
    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page
    paginated_items = all_transactions[start_idx:end_idx]
    
    # Enrich transactions with project info
    for transaction in paginated_items:
        if transaction.get('project_id'):
            project = mongo.db.projects.find_one({'_id': transaction['project_id']},
                {'name': 1, 'code': 1})
            transaction['project'] = serialize_document(project)
        
        if transaction.get('client_id'):
            client = mongo.db.users.find_one({'_id': transaction['client_id']},
                {'first_name': 1, 'last_name': 1, 'email': 1})
            transaction['client'] = serialize_document(client)
        
        if transaction.get('created_by'):
            creator = mongo.db.users.find_one({'_id': transaction['created_by']},
                {'first_name': 1, 'last_name': 1})
            transaction['created_by_user'] = serialize_document(creator)
    
    return jsonify({
        'success': True,
        'data': {
            'transactions': serialize_document(paginated_items),
            'pagination': {
                'total': total,
                'page': page,
                'per_page': per_page,
                'total_pages': total_pages
            }
        }
    }), 200

@accounting_bp.route('/transactions', methods=['POST'])
@admin_required
def create_transaction():
    """Create a new financial transaction (admin only)."""
    data = request.get_json()
    current_user_id = get_jwt_identity()
    
    required_fields = ['type', 'amount', 'description', 'date']
    for field in required_fields:
        if field not in data:
            return jsonify({'success': False, 'message': f'{field} is required'}), 400
    
    if data['type'] not in ['income', 'expense']:
        return jsonify({'success': False, 'message': 'Type must be income or expense'}), 400
    
    transaction = {
        '_id': generate_unique_id(),
        'type': data['type'],
        'amount': float(data['amount']),
        'description': data['description'],
        'category': data.get('category', 'general'),
        'date': data['date'],
        'project_id': data.get('project_id'),
        'client_id': data.get('client_id'),
        'team_lead_id': data.get('team_lead_id'),
        'payment_method': data.get('payment_method', 'bank_transfer'),
        'reference_number': data.get('reference_number', ''),
        'notes': data.get('notes', ''),
        'attachments': data.get('attachments', []),
        'created_by': current_user_id,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }
    
    mongo.db.transactions.insert_one(transaction)
    
    # Update project actual cost if it's an expense and linked to a project
    if data['type'] == 'expense' and data.get('project_id'):
        mongo.db.projects.update_one(
            {'_id': data['project_id']},
            {'$inc': {'actual_cost': float(data['amount'])}}
        )
    
    return jsonify({
        'success': True,
        'message': 'Transaction created successfully',
        'data': serialize_document(transaction)
    }), 201

@accounting_bp.route('/transactions/<transaction_id>', methods=['GET'])
@jwt_required()
def get_transaction(transaction_id):
    """Get a specific transaction."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    transaction = mongo.db.transactions.find_one({'_id': transaction_id})
    
    if not transaction:
        return jsonify({'success': False, 'message': 'Transaction not found'}), 404
    
    # Check permissions
    if current_user.get('role') == 'admin':
        pass
    elif current_user.get('role') == 'client':
        if transaction.get('client_id') != current_user_id:
            return jsonify({'success': False, 'message': 'Access denied'}), 403
    else:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    # Enrich transaction
    if transaction.get('project_id'):
        project = mongo.db.projects.find_one({'_id': transaction['project_id']})
        transaction['project'] = serialize_document(project)
    
    if transaction.get('created_by'):
        creator = mongo.db.users.find_one({'_id': transaction['created_by']},
            {'first_name': 1, 'last_name': 1})
        transaction['created_by_user'] = serialize_document(creator)
    
    return jsonify({
        'success': True,
        'data': serialize_document(transaction)
    }), 200

@accounting_bp.route('/transactions/<transaction_id>', methods=['PUT'])
@admin_required
def update_transaction(transaction_id):
    """Update a transaction (admin only)."""
    transaction = mongo.db.transactions.find_one({'_id': transaction_id})
    
    if not transaction:
        return jsonify({'success': False, 'message': 'Transaction not found'}), 404
    
    data = request.get_json()
    
    allowed_fields = ['description', 'category', 'date', 'payment_method', 
                     'reference_number', 'notes', 'attachments']
    
    update_data = {}
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]
    
    # Handle amount change
    if 'amount' in data:
        old_amount = transaction['amount']
        new_amount = float(data['amount'])
        update_data['amount'] = new_amount
        
        # Update project cost if linked
        if transaction.get('project_id') and transaction['type'] == 'expense':
            difference = new_amount - old_amount
            mongo.db.projects.update_one(
                {'_id': transaction['project_id']},
                {'$inc': {'actual_cost': difference}}
            )
    
    update_data['updated_at'] = datetime.utcnow()
    
    mongo.db.transactions.update_one(
        {'_id': transaction_id},
        {'$set': update_data}
    )
    
    updated_transaction = mongo.db.transactions.find_one({'_id': transaction_id})
    
    return jsonify({
        'success': True,
        'message': 'Transaction updated successfully',
        'data': serialize_document(updated_transaction)
    }), 200

@accounting_bp.route('/transactions/<transaction_id>', methods=['DELETE'])
@admin_required
def delete_transaction(transaction_id):
    """Delete a transaction (admin only)."""
    transaction = mongo.db.transactions.find_one({'_id': transaction_id})
    
    if not transaction:
        return jsonify({'success': False, 'message': 'Transaction not found'}), 404
    
    # Update project cost if it's an expense
    if transaction.get('project_id') and transaction['type'] == 'expense':
        mongo.db.projects.update_one(
            {'_id': transaction['project_id']},
            {'$inc': {'actual_cost': -transaction['amount']}}
        )
    
    mongo.db.transactions.delete_one({'_id': transaction_id})
    
    return jsonify({
        'success': True,
        'message': 'Transaction deleted successfully'
    }), 200

@accounting_bp.route('/summary', methods=['GET'])
@admin_required
def get_financial_summary():
    """Get financial summary (admin only)."""
    # Get date range
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    match_stage = {}
    if start_date or end_date:
        match_stage['date'] = {}
        if start_date:
            match_stage['date']['$gte'] = start_date
        if end_date:
            match_stage['date']['$lte'] = end_date
    
    # Get total income and expenses from transactions
    totals = list(mongo.db.transactions.aggregate([
        {'$match': match_stage},
        {'$group': {
            '_id': '$type',
            'total': {'$sum': '$amount'}
        }}
    ]))
    
    income = next((t['total'] for t in totals if t['_id'] == 'income'), 0)
    expenses = next((t['total'] for t in totals if t['_id'] == 'expense'), 0)
    
    # Also get income from payments collection (client payments)
    payments_match = {'status': 'completed'}
    if start_date or end_date:
        payments_match['created_at'] = {}
        if start_date:
            payments_match['created_at']['$gte'] = start_date
        if end_date:
            payments_match['created_at']['$lte'] = end_date
    
    payments_income = list(mongo.db.payments.aggregate([
        {'$match': payments_match},
        {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
    ]))
    payments_total = next((p['total'] for p in payments_income), 0)
    
    # Combine income
    total_income = income + payments_total
    
    # Get category breakdown
    category_breakdown = list(mongo.db.transactions.aggregate([
        {'$match': match_stage},
        {'$group': {
            '_id': {'type': '$type', 'category': '$category'},
            'total': {'$sum': '$amount'}
        }}
    ]))

    payment_category_breakdown = list(mongo.db.payments.aggregate([
        {'$match': payments_match},
        {'$group': {
            '_id': {'type': 'income', 'category': 'client_payment'},
            'total': {'$sum': '$amount'}
        }}
    ]))

    category_breakdown.extend(payment_category_breakdown)
    
    # Get monthly trend
    monthly_trend = list(mongo.db.transactions.aggregate([
        {'$match': match_stage},
        {'$group': {
            '_id': {
                'year': {'$year': {'$dateFromString': {'dateString': '$date'}}},
                'month': {'$month': {'$dateFromString': {'dateString': '$date'}}},
                'type': '$type'
            },
            'total': {'$sum': '$amount'}
        }},
        {'$sort': {'_id.year': -1, '_id.month': -1}}
    ]))

    payments_monthly_trend = list(mongo.db.payments.aggregate([
        {'$match': payments_match},
        {'$group': {
            '_id': {
                'year': {'$year': {'$toDate': '$created_at'}},
                'month': {'$month': {'$toDate': '$created_at'}},
                'type': 'income'
            },
            'total': {'$sum': '$amount'}
        }},
        {'$sort': {'_id.year': -1, '_id.month': -1}}
    ]))

    monthly_trend.extend(payments_monthly_trend)
    
    return jsonify({
        'success': True,
        'data': {
            'summary': {
                'total_income': total_income,
                'total_expenses': expenses,
                'net_profit': total_income - expenses,
                'transaction_income': income,
                'payments_income': payments_total
            },
            'category_breakdown': category_breakdown,
            'monthly_trend': monthly_trend
        }
    }), 200

@accounting_bp.route('/categories', methods=['GET'])
@jwt_required()
def get_categories():
    """Get transaction categories."""
    income_categories = ['project_payment', 'consulting', 'maintenance', 'other_income']
    expense_categories = ['salary', 'software', 'hardware', 'office', 'marketing', 
                         'utilities', 'travel', 'maintenance', 'other_expense']
    
    return jsonify({
        'success': True,
        'data': {
            'income': income_categories,
            'expense': expense_categories
        }
    }), 200

@accounting_bp.route('/project/<project_id>/costs', methods=['GET'])
@jwt_required()
def get_project_costs(project_id):
    """Get costs for a specific project."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    project = mongo.db.projects.find_one({'_id': project_id})
    if not project:
        return jsonify({'success': False, 'message': 'Project not found'}), 404
    
    # Check permissions
    if current_user.get('role') == 'admin':
        pass
    elif current_user.get('role') == 'client':
        if project.get('client_id') != current_user_id:
            return jsonify({'success': False, 'message': 'Access denied'}), 403
    elif current_user.get('role') == 'team_leader':
        if project.get('department_id') != current_user.get('department_id'):
            return jsonify({'success': False, 'message': 'Access denied'}), 403
    else:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    # Get transactions for this project
    transactions = list(mongo.db.transactions.find(
        {'project_id': project_id, 'type': 'expense'}
    ).sort('date', -1))
    
    # Calculate category totals
    category_totals = {}
    for t in transactions:
        category = t.get('category', 'general')
        category_totals[category] = category_totals.get(category, 0) + t['amount']
    
    return jsonify({
        'success': True,
        'data': {
            'project': serialize_document(project),
            'budget': project.get('budget', 0),
            'actual_cost': project.get('actual_cost', 0),
            'remaining_budget': project.get('budget', 0) - project.get('actual_cost', 0),
            'transactions': serialize_document(transactions),
            'category_breakdown': category_totals
        }
    }), 200

@accounting_bp.route('/team-leader/wages', methods=['GET'])
@jwt_required()
def get_team_leader_wages():
    """Get wage calculations for team leader's projects (client payments based on hours worked)."""
    try:
        print("=== get_team_leader_wages called ===")
        current_user_id = get_jwt_identity()
        print(f"Current user ID: {current_user_id}")
        
        current_user = mongo.db.users.find_one({'_id': current_user_id})
        print(f"Current user: {current_user}")
        
        if not current_user or current_user.get('role') != 'team_leader':
            print("Access denied - not team leader")
            return jsonify({'success': False, 'message': 'Access denied'}), 403
        
        # Get all projects assigned to this team leader
        team_leader_projects = list(mongo.db.projects.find({
            'team_lead_id': current_user_id
        }))
        print(f"Found {len(team_leader_projects)} projects")
        
        if not team_leader_projects:
            print("No projects found")
            return jsonify({
                'success': True,
                'data': [],
                'balance': 0,
                'total_received': 0,
                'total_paid': 0
            }), 200
        
        project_ids = [p['_id'] for p in team_leader_projects]
        print(f"Project IDs: {project_ids}")
        
        # Get all tasks for these projects with time tracking
        try:
            # Convert project_ids to strings for comparison
            project_id_strs = [str(pid) for pid in project_ids]
            print(f"Project ID strings: {project_id_strs}")
            
            tasks = list(mongo.db.tasks.find({
                'project_id': {'$in': project_ids}
            }))
            
            # Also try string comparison if above returns nothing
            if not tasks:
                print("No tasks found with ObjectId comparison, trying with string comparison")
                all_tasks = list(mongo.db.tasks.find({}))
                tasks = [t for t in all_tasks if str(t.get('project_id')) in project_id_strs]
            
            print(f"Found {len(tasks)} tasks")
            if tasks:
                print(f"Sample task: {tasks[0]}")
        except Exception as e:
            print(f"Error accessing tasks collection: {e}")
            import traceback
            traceback.print_exc()
            tasks = []
        
        # Calculate total amount received from admin
        # Check payments collection (for client payments) and transactions collection
        admin_payments = []
        
        # Method 1: Check payments collection for project-related payments
        try:
            project_payments = list(mongo.db.payments.find({
                'project_id': {'$in': project_ids},
                'status': 'completed'
            }))
            admin_payments.extend(project_payments)
            print(f"Found {len(project_payments)} project payments")
        except Exception as e:
            print(f"Error accessing payments collection: {e}")
        
        # Method 2: Check transactions collection for transfers to team leads
        try:
            # Query for transfers in multiple ways to catch all scenarios
            admin_transactions = list(mongo.db.transactions.find({
                '$or': [
                    # Match by team_lead_id
                    {'team_lead_id': current_user_id},
                    # Match by category (covers both old and new category names)
                    {'type': 'expense', 'category': {'$in': ['transfer', 'team_lead_transfer']}}
                ]
            }))
            
            # Filter to only include transfers meant for this team lead
            filtered_transfers = []
            for trans in admin_transactions:
                # Include if explicitly marked for this team lead, or if description mentions the team lead
                if trans.get('team_lead_id') == current_user_id:
                    filtered_transfers.append(trans)
                elif trans.get('category') in ['transfer', 'team_lead_transfer']:
                    # Also include transfer category expenses as they're admin transfers
                    filtered_transfers.append(trans)
            
            admin_payments.extend(filtered_transfers)
            print(f"Found {len(filtered_transfers)} transaction transfers")
            if filtered_transfers:
                print(f"Sample transfer: {filtered_transfers[0]}")
        except Exception as e:
            print(f"Error accessing transactions collection: {e}")
        
        # Calculate total received
        total_received = sum(p.get('amount', 0) for p in admin_payments)
        print(f"Total received from admin: {total_received}")
        
        # Calculate total amount already paid to team members
        try:
            member_payments = list(mongo.db.team_leader_payments.find({
                'team_lead_id': current_user_id
            }))
            total_paid = sum(p.get('amount', 0) for p in member_payments)
            print(f"Total paid to members: {total_paid}")
        except Exception as e:
            print(f"Error accessing team_leader_payments collection: {e}")
            member_payments = []
            total_paid = 0

        # Build set of paid member/project pairs for exclusion
        paid_member_pairs = set(
            (str(p.get('project_id')), str(p.get('member_id')))
            for p in member_payments
            if p.get('project_id') and p.get('member_id')
        )
        print(f"Paid member/project pairs: {paid_member_pairs}")
        
        # Calculate balance
        balance = total_received - total_paid
        print(f"Balance: {balance}")
        
        # Calculate hours worked by each team member per project
        wages_data = []
        
        try:
            for project in team_leader_projects:
                try:
                    print(f"Processing project: {project.get('_id')}")
                    project_id = project.get('_id')
                    project_tasks = [t for t in tasks if str(t.get('project_id')) == str(project_id)]
                    
                    # Get team members who worked on this project
                    team_member_ids = list(set([t.get('assigned_to') for t in project_tasks if t.get('assigned_to')]))
                    print(f"Team member IDs: {team_member_ids}")
                    
                    members_wages = []
                    total_hours = 0
                    total_wages = 0
                    
                    for member_id in team_member_ids:
                        # Skip members who were already paid for this project
                        if (str(project_id), str(member_id)) in paid_member_pairs:
                            print(f"Skipping already paid member {member_id} for project {project_id}")
                            continue
                        try:
                            member = mongo.db.users.find_one({'_id': member_id}, 
                                {'first_name': 1, 'last_name': 1, 'email': 1, 'hourly_rate': 1})
                            
                            if not member:
                                print(f"Member {member_id} not found")
                                continue
                        except Exception as e:
                            print(f"Error accessing users collection for member {member_id}: {e}")
                            continue
                        
                        # Calculate hours from tasks assigned to this member
                        member_tasks = [t for t in project_tasks if t.get('assigned_to') == member_id]
                        # Build task description list
                        task_descriptions = []
                        member_hours = 0
                        for t in member_tasks:
                            title = t.get('title') or ''
                            description = t.get('description') or ''
                            if title:
                                task_descriptions.append(title)
                            elif description:
                                task_descriptions.append(description)

                            actual = t.get('actual_hours')
                            estimated = t.get('estimated_hours')
                            # Convert to float, handling string values
                            try:
                                hours = 0
                                if actual and actual != 0:
                                    hours = float(actual) if isinstance(actual, str) else actual
                                elif estimated and estimated != 0:
                                    hours = float(estimated) if isinstance(estimated, str) else estimated
                                member_hours += hours
                            except (ValueError, TypeError) as he:
                                print(f"Warning: Could not convert hours {actual}/{estimated} for task {t.get('_id')}: {he}")
                                continue
                        
                        hourly_rate = member.get('hourly_rate', 0) or 0
                        member_wage = member_hours * hourly_rate
                        
                        # Check if member has completed tasks
                        completed_tasks = len([t for t in member_tasks if t.get('status') == 'completed'])
                        
                        members_wages.append({
                            'member_id': str(member_id),
                            'member_name': f"{member.get('first_name', '')} {member.get('last_name', '')}".strip(),
                            'member_email': member.get('email', ''),
                            'hours_worked': float(member_hours),
                            'hourly_rate': float(hourly_rate),
                            'wage_amount': float(member_wage),
                            'tasks_completed': int(completed_tasks),
                            'task_description': ', '.join(task_descriptions) or 'No task description',
                            'eligible_for_payment': completed_tasks > 0
                        })
                        
                        total_hours += member_hours
                        total_wages += member_wage
                    
                    wages_data.append({
                        'project_id': str(project_id),
                        'project_name': project.get('name', 'Unknown Project'),
                        'project_code': project.get('code', ''),
                        'client_name': project.get('client_name', 'Unknown Client'),
                        'total_hours': float(total_hours),
                        'total_wages': float(total_wages),
                        'team_members': members_wages
                    })
                except Exception as project_error:
                    print(f"Error processing project: {project_error}")
                    continue
        except Exception as wages_error:
            print(f"Error in wage calculation: {wages_error}")
            import traceback
            traceback.print_exc()
        
        result = {
            'success': True,
            'data': wages_data,
            'balance': float(balance),
            'total_received': float(total_received),
            'total_paid': float(total_paid)
        }
        print(f"Returning result: {result}")
        return jsonify(result), 200
    except Exception as e:
        import traceback
        print(f"❌ Error in get_team_leader_wages: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'message': str(e)}), 500

@accounting_bp.route('/team-leader/payments', methods=['GET'])
@jwt_required()
def get_team_leader_payments():
    """Get payments made by team leader to team members."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    if current_user.get('role') != 'team_leader':
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    # Get all payments made by this team leader
    payments = list(mongo.db.team_leader_payments.find({
        'team_lead_id': current_user_id
    }).sort('created_at', -1))
    
    result = []
    for payment in payments:
        member = mongo.db.users.find_one({'_id': payment['member_id']},
            {'first_name': 1, 'last_name': 1, 'email': 1})
        
        project = mongo.db.projects.find_one({'_id': payment.get('project_id')},
            {'name': 1, 'code': 1})
        
        result.append({
            'id': payment['_id'],
            'member_id': payment['member_id'],
            'member_name': member.get('first_name', '') + ' ' + member.get('last_name', '') if member else 'Unknown',
            'member_email': member.get('email') if member else '',
            'project_id': payment.get('project_id'),
            'project_name': project.get('name') if project else 'N/A',
            'project_code': project.get('code') if project else '',
            'amount': payment.get('amount', 0),
            'hours_paid': payment.get('hours_paid', 0),
            'payment_date': payment.get('payment_date', ''),
            'payment_mode': payment.get('payment_mode', 'bank_transfer'),
            'transaction_id': payment.get('transaction_id', ''),
            'notes': payment.get('notes', ''),
            'created_at': payment['created_at'].isoformat() if isinstance(payment['created_at'], datetime) else str(payment['created_at'])
        })
    
    return jsonify({
        'success': True,
        'data': result
    }), 200

@accounting_bp.route('/team-leader/payments', methods=['POST'])
@jwt_required()
def create_team_leader_payment():
    """Create a payment from team leader to team member."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    if current_user.get('role') != 'team_leader':
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['member_id', 'amount', 'project_id']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'success': False, 'message': f'{field} is required'}), 400
    
    # Verify member exists
    member = mongo.db.users.find_one({'_id': data['member_id']})
    if not member:
        return jsonify({'success': False, 'message': 'Team member not found'}), 404
    
    # Verify project exists and belongs to this team leader
    project = mongo.db.projects.find_one({'_id': data['project_id']})
    if not project or project.get('team_lead_id') != current_user_id:
        return jsonify({'success': False, 'message': 'Invalid project'}), 404
    
    # Create payment record
    payment = {
        '_id': generate_unique_id(),
        'team_lead_id': current_user_id,
        'member_id': data['member_id'],
        'project_id': data['project_id'],
        'amount': data['amount'],
        'hours_paid': data.get('hours_paid', 0),
        'payment_date': data.get('payment_date', datetime.utcnow().strftime('%Y-%m-%d')),
        'payment_mode': data.get('payment_mode', 'bank_transfer'),
        'transaction_id': data.get('transaction_id') or f"TXN-{int(datetime.utcnow().timestamp())}-{generate_unique_id().split('-')[0]}",
        'notes': data.get('notes', ''),
        'created_at': datetime.utcnow()
    }
    
    mongo.db.team_leader_payments.insert_one(payment)
    
    return jsonify({
        'success': True,
        'message': 'Payment recorded successfully',
        'data': serialize_document(payment)
    }), 201

@accounting_bp.route('/team-member/earnings', methods=['GET'])
@jwt_required()
def get_team_member_earnings():
    """Get earnings history for team member."""
    current_user_id = get_jwt_identity()
    
    # Get all payments received by this member
    payments = list(mongo.db.team_leader_payments.find({
        'member_id': current_user_id
    }).sort('created_at', -1))
    
    result = []
    for payment in payments:
        team_lead = mongo.db.users.find_one({'_id': payment['team_lead_id']},
            {'first_name': 1, 'last_name': 1, 'email': 1})
        
        project = mongo.db.projects.find_one({'_id': payment.get('project_id')},
            {'name': 1, 'code': 1})
        
        result.append({
            'id': payment['_id'],
            'team_lead_id': payment['team_lead_id'],
            'team_lead_name': team_lead.get('first_name', '') + ' ' + team_lead.get('last_name', '') if team_lead else 'Unknown',
            'project_id': payment.get('project_id'),
            'project_name': project.get('name') if project else 'N/A',
            'project_code': project.get('code') if project else '',
            'amount': payment.get('amount', 0),
            'hours_paid': payment.get('hours_paid', 0),
            'payment_date': payment.get('payment_date', ''),
            'payment_mode': payment.get('payment_mode', 'bank_transfer'),
            'transaction_id': payment.get('transaction_id', ''),
            'notes': payment.get('notes', ''),
            'created_at': payment['created_at'].isoformat() if isinstance(payment['created_at'], datetime) else str(payment['created_at'])
        })
    
    # Calculate total earnings
    total_earnings = sum(p.get('amount', 0) for p in payments)
    total_hours = sum(p.get('hours_paid', 0) for p in payments)
    
    return jsonify({
        'success': True,
        'data': {
            'payments': result,
            'total_earnings': total_earnings,
            'total_hours': total_hours
        }
    }), 200

@accounting_bp.route('/team-member/hours', methods=['GET'])
@jwt_required()
def get_team_member_hours():
    """Get hours worked by team member across all projects."""
    try:
        print("=== get_team_member_hours called ===")
        current_user_id = get_jwt_identity()
        print(f"Current user ID: {current_user_id}")
        
        # Get all tasks assigned to this member
        try:
            tasks = list(mongo.db.tasks.find({
                'assigned_to': current_user_id
            }))
            print(f"Found {len(tasks)} tasks")
        except Exception as e:
            print(f"Error accessing tasks collection: {e}")
            tasks = []
        
        # Group by project
        project_hours = {}
        total_hours = 0
        
        def parse_hours(value):
            if value is None:
                return 0.0
            if isinstance(value, (int, float)):
                return float(value)
            try:
                return float(value)
            except (TypeError, ValueError):
                print(f"Warning: Could not convert hours '{value}' for task {task.get('_id')} to float")
                return 0.0
        
        for task in tasks:
            project_id = task.get('project_id')
            if not project_id:
                continue
            
            raw_hours = task.get('actual_hours', 0) or task.get('estimated_hours', 0) or 0
            hours = parse_hours(raw_hours)
            
            if project_id not in project_hours:
                try:
                    project = mongo.db.projects.find_one({'_id': project_id},
                        {'name': 1, 'code': 1})
                    project_hours[project_id] = {
                        'project_id': project_id,
                        'project_name': project.get('name') if project else 'N/A',
                        'project_code': project.get('code') if project else '',
                        'hours': 0.0
                    }
                except Exception as e:
                    print(f"Error accessing projects collection for project {project_id}: {e}")
                    project_hours[project_id] = {
                        'project_id': project_id,
                        'project_name': 'N/A',
                        'project_code': '',
                        'hours': 0.0
                    }
            
            project_hours[project_id]['hours'] += hours
            total_hours += hours
        
        result = {
            'success': True,
            'data': {
                'projects': list(project_hours.values()),
                'total_hours': total_hours
            }
        }
        print(f"Returning result: {result}")
        return jsonify(result), 200
    except Exception as e:
        import traceback
        print(f"❌ Error in get_team_member_hours: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'message': str(e)}), 500


@accounting_bp.route('/admin/transfer-to-team-lead', methods=['POST'])
@jwt_required()
def admin_transfer_to_team_lead():
    """Admin transfers funds to team lead for project expenses and wages."""
    try:
        current_user_id = get_jwt_identity()
        current_user = mongo.db.users.find_one({'_id': current_user_id})
        
        # Only admin can transfer funds
        if not current_user or current_user.get('role') != 'admin':
            return jsonify({'success': False, 'message': 'Access denied'}), 403
        
        data = request.get_json()
        team_lead_id = data.get('team_lead_id')
        amount = data.get('amount')
        project_id = data.get('project_id')
        notes = data.get('notes', '')
        
        if not team_lead_id or not amount:
            return jsonify({'success': False, 'message': 'Team lead ID and amount are required'}), 400
        
        # Verify team lead exists
        team_lead = mongo.db.users.find_one({'_id': team_lead_id, 'role': 'team_leader'})
        if not team_lead:
            return jsonify({'success': False, 'message': 'Team lead not found'}), 404
        
        # Create transfer record in transactions collection
        transfer = {
            '_id': str(ObjectId()),
            'type': 'transfer',
            'from_user_id': current_user_id,
            'from_user_name': f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip(),
            'to_user_id': team_lead_id,
            'to_user_name': f"{team_lead.get('first_name', '')} {team_lead.get('last_name', '')}".strip(),
            'team_lead_id': team_lead_id,
            'project_id': project_id,
            'amount': float(amount),
            'status': 'completed',
            'category': 'transfer',
            'subcategory': 'team_lead_funding',
            'description': f'Funds transferred to team lead - {notes}',
            'notes': notes,
            'transaction_date': datetime.utcnow(),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        mongo.db.transactions.insert_one(transfer)
        
        # Also record in expenses for accounting tracking
        expense = {
            '_id': str(ObjectId()),
            'team_lead_id': team_lead_id,
            'project_id': project_id,
            'amount': float(amount),
            'category': 'transfer',
            'subcategory': 'team_lead_payment',
            'description': f'Transfer to team lead: {team_lead.get("first_name")} {team_lead.get("last_name")}',
            'notes': notes,
            'status': 'completed',
            'payment_mode': 'bank_transfer',
            'transaction_id': generate_unique_id('TXN'),
            'expense_date': datetime.utcnow(),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        mongo.db.expenses.insert_one(expense)
        
        return jsonify({
            'success': True,
            'message': 'Transfer completed successfully',
            'data': {
                'transfer_id': transfer['_id'],
                'amount': amount,
                'team_lead_name': transfer['to_user_name']
            }
        }), 201
    except Exception as e:
        import traceback
        print(f"❌ Error in admin_transfer_to_team_lead: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'message': str(e)}), 500
