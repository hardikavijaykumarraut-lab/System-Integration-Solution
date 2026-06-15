from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from app import mongo
from app.utils.decorators import admin_required
from app.utils.helpers import serialize_document

reports_bp = Blueprint('reports', __name__)

@reports_bp.route('/project-progress', methods=['GET'])
@jwt_required()
def get_project_progress_report():
    """Get project progress report."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    department_id = request.args.get('department_id')
    
    query = {}
    
    if current_user.get('role') == 'admin':
        if department_id:
            query['department_id'] = department_id
    elif current_user.get('role') == 'team_leader':
        query['department_id'] = current_user.get('department_id')
    elif current_user.get('role') == 'client':
        query['client_id'] = current_user_id
    else:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    projects = list(mongo.db.projects.find(query))
    
    report = []
    for project in projects:
        tasks = list(mongo.db.tasks.find({'project_id': project['_id']}))
        
        total_tasks = len(tasks)
        completed_tasks = sum(1 for t in tasks if t.get('status') == 'completed')
        progress = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0

        department_name = 'Unassigned'
        department_id = project.get('department_id')
        if department_id:
            department_doc = mongo.db.departments.find_one({'_id': department_id}, {'name': 1})
            if department_doc:
                department_name = department_doc.get('name', 'Unassigned')

        report.append({
            'project_id': project.get('_id'),
            'project_name': project.get('name', 'Unnamed Project'),
            'project_code': project.get('code', ''),
            'department_id': department_id,
            'department_name': department_name,
            'status': project.get('status', 'unknown'),
            'total_tasks': total_tasks,
            'completed_tasks': completed_tasks,
            'progress_percentage': round(progress, 2),
            'budget': project.get('budget', 0) or 0,
            'actual_cost': project.get('actual_cost', 0) or 0
        })
    
    return jsonify({
        'success': True,
        'data': report
    }), 200

@reports_bp.route('/department-performance', methods=['GET'])
@admin_required
def get_department_performance_report():
    """Get department performance report (admin only)."""
    departments = list(mongo.db.departments.find({'is_active': True}))
    
    report = []
    for dept in departments:
        # Get projects
        projects = list(mongo.db.projects.find({'department_id': dept['_id']}))
        
        # Get tasks
        tasks = list(mongo.db.tasks.find({'department_id': dept['_id']}))
        
        # Get team members
        members = mongo.db.users.count_documents({
            'department_id': dept['_id'],
            'is_active': True
        })
        
        # Calculate metrics
        total_projects = len(projects)
        completed_projects = sum(1 for p in projects if p.get('status') == 'completed')
        
        total_tasks = len(tasks)
        completed_tasks = sum(1 for t in tasks if t.get('status') == 'completed')
        
        # Calculate average task completion time
        completion_times = []
        for task in tasks:
            if task.get('status') == 'completed' and task.get('started_at') and task.get('completed_at'):
                try:
                    started = datetime.fromisoformat(task['started_at'])
                    completed = datetime.fromisoformat(task['completed_at'])
                    completion_times.append((completed - started).days)
                except:
                    pass
        
        avg_completion_time = sum(completion_times) / len(completion_times) if completion_times else 0
        
        report.append({
            'department_id': dept['_id'],
            'department_name': dept['name'],
            'total_members': members,
            'total_projects': total_projects,
            'completed_projects': completed_projects,
            'total_tasks': total_tasks,
            'completed_tasks': completed_tasks,
            'task_completion_rate': round(completed_tasks / total_tasks * 100, 2) if total_tasks > 0 else 0,
            'average_task_completion_days': round(avg_completion_time, 2)
        })
    
    return jsonify({
        'success': True,
        'data': report
    }), 200

@reports_bp.route('/team-productivity', methods=['GET'])
@jwt_required()
def get_team_productivity_report():
    """Get team productivity report."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    if current_user.get('role') not in ['admin', 'team_leader']:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    department_id = request.args.get('department_id')
    
    if current_user.get('role') == 'team_leader':
        department_id = current_user.get('department_id')
    
    query = {'role': 'team_member', 'is_active': True}
    if department_id:
        query['department_id'] = department_id
    
    team_members = list(mongo.db.users.find(query, {'password': 0}))
    
    report = []
    for member in team_members:
        # Get tasks assigned to member
        tasks = list(mongo.db.tasks.find({'assigned_to': member['_id']}))
        
        total_tasks = len(tasks)
        completed_tasks = sum(1 for t in tasks if t.get('status') == 'completed')
        in_progress_tasks = sum(1 for t in tasks if t.get('status') == 'in_progress')
        pending_tasks = sum(1 for t in tasks if t.get('status') == 'pending')
        
        # Calculate completion rate
        completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
        
        report.append({
            'user_id': member['_id'],
            'name': f"{member.get('first_name', '')} {member.get('last_name', '')}".strip(),
            'email': member.get('email'),
            'total_tasks': total_tasks,
            'completed_tasks': completed_tasks,
            'in_progress_tasks': in_progress_tasks,
            'pending_tasks': pending_tasks,
            'completion_rate': round(completion_rate, 2)
        })
    
    # Sort by completion rate
    report.sort(key=lambda x: x['completion_rate'], reverse=True)
    
    return jsonify({
        'success': True,
        'data': report
    }), 200

@reports_bp.route('/financial', methods=['GET'])
@admin_required
def get_financial_report():
    """Get comprehensive financial report (admin only)."""
    # Get date range
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    if not start_date:
        start_date = (datetime.utcnow() - timedelta(days=30)).strftime('%Y-%m-%d')
    if not end_date:
        end_date = datetime.utcnow().strftime('%Y-%m-%d')
    
    match_stage = {
        'date': {
            '$gte': start_date,
            '$lte': end_date
        }
    }
    
    payments_match = {'status': 'completed'}
    if start_date or end_date:
        payments_match['created_at'] = {}
        if start_date:
            payments_match['created_at']['$gte'] = start_date
        if end_date:
            payments_match['created_at']['$lte'] = end_date

    # Get income and expenses by category
    category_breakdown = list(mongo.db.transactions.aggregate([
        {'$match': match_stage},
        {'$group': {
            '_id': {'type': '$type', 'category': '$category'},
            'total': {'$sum': '$amount'},
            'count': {'$sum': 1}
        }}
    ]))

    payment_category_breakdown = list(mongo.db.payments.aggregate([
        {'$match': payments_match},
        {'$group': {
            '_id': {'type': 'income', 'category': 'client_payment'},
            'total': {'$sum': '$amount'},
            'count': {'$sum': 1}
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
        {'$sort': {'_id.year': 1, '_id.month': 1}}
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
        {'$sort': {'_id.year': 1, '_id.month': 1}}
    ]))

    monthly_trend.extend(payments_monthly_trend)
    
    # Get project profitability
    projects = list(mongo.db.projects.find())
    project_profitability = []
    
    for project in projects:
        income = sum(t['amount'] for t in mongo.db.transactions.find({
            'project_id': project['_id'],
            'type': 'income'
        }))
        
        expenses = sum(t['amount'] for t in mongo.db.transactions.find({
            'project_id': project['_id'],
            'type': 'expense'
        }))
        
        project_profitability.append({
            'project_id': project['_id'],
            'project_name': project['name'],
            'income': income,
            'expenses': expenses,
            'profit': income - expenses,
            'budget': project.get('budget', 0)
        })
    
    # Calculate totals
    total_income = sum(t['total'] for t in category_breakdown if t['_id']['type'] == 'income')
    total_expenses = sum(t['total'] for t in category_breakdown if t['_id']['type'] == 'expense')
    
    return jsonify({
        'success': True,
        'data': {
            'period': {'start_date': start_date, 'end_date': end_date},
            'summary': {
                'total_income': total_income,
                'total_expenses': total_expenses,
                'net_profit': total_income - total_expenses
            },
            'category_breakdown': category_breakdown,
            'monthly_trend': monthly_trend,
            'project_profitability': project_profitability
        }
    }), 200

@reports_bp.route('/client-activity', methods=['GET'])
@admin_required
def get_client_activity_report():
    """Get client activity report (admin only)."""
    clients = list(mongo.db.users.find({'role': 'client'}))
    
    report = []
    for client in clients:
        # Get projects
        projects = list(mongo.db.projects.find({'client_id': client['_id']}))
        
        # Get transactions
        transactions = list(mongo.db.transactions.find({'client_id': client['_id']}))
        
        total_spent = sum(t['amount'] for t in transactions if t['type'] == 'expense')
        total_paid = sum(t['amount'] for t in transactions if t['type'] == 'income')
        
        # Get last activity
        last_transaction = mongo.db.transactions.find_one(
            {'client_id': client['_id']},
            sort=[('date', -1)]
        )
        
        report.append({
            'client_id': client['_id'],
            'client_name': f"{client.get('first_name', '')} {client.get('last_name', '')}".strip(),
            'company_name': client.get('company_name', ''),
            'email': client.get('email'),
            'total_projects': len(projects),
            'active_projects': sum(1 for p in projects if p.get('status') == 'active'),
            'total_spent': total_spent,
            'total_paid': total_paid,
            'outstanding': total_spent - total_paid,
            'last_activity': last_transaction['date'] if last_transaction else None
        })
    
    return jsonify({
        'success': True,
        'data': report
    }), 200
