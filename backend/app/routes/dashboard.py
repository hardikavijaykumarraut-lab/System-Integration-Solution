from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from app import mongo
from app.utils.helpers import serialize_document

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/admin', methods=['GET'])
@jwt_required()
def get_admin_dashboard():
    """Get admin dashboard data."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    if current_user.get('role') != 'admin':
        return jsonify({'success': False, 'message': 'Admin access required'}), 403
    
    # Get counts
    total_users = mongo.db.users.count_documents({'is_active': True})
    total_departments = mongo.db.departments.count_documents({'is_active': True})
    total_projects = mongo.db.projects.count_documents({})
    active_projects = mongo.db.projects.count_documents({'status': 'active'})
    total_tasks = mongo.db.tasks.count_documents({})
    pending_tasks = mongo.db.tasks.count_documents({'status': 'pending'})
    in_progress_tasks = mongo.db.tasks.count_documents({'status': 'in_progress'})
    completed_tasks = mongo.db.tasks.count_documents({'status': 'completed'})
    total_clients = mongo.db.users.count_documents({'role': 'client', 'is_active': True})
    
    # Get recent activities (last 7 days)
    seven_days_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()
    
    recent_tasks = list(mongo.db.tasks.find({
        'created_at': {'$gte': seven_days_ago}
    }).sort('created_at', -1).limit(10))
    
    recent_projects = list(mongo.db.projects.find().sort('created_at', -1))
    
    # Get financial summary from transactions
    transactions = list(mongo.db.transactions.aggregate([
        {'$group': {
            '_id': '$type',
            'total': {'$sum': '$amount'}
        }}
    ]))
    
    income = next((t['total'] for t in transactions if t['_id'] == 'income'), 0)
    expenses = next((t['total'] for t in transactions if t['_id'] == 'expense'), 0)
    
    # Also get income from payments collection (client payments)
    payments_income = mongo.db.payments.aggregate([
        {'$match': {'status': 'completed'}},
        {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
    ])
    payments_total = next((p['total'] for p in payments_income), 0)
    
    # Combine income from both sources
    total_income = income + payments_total
    
    # Get department-wise project distribution
    dept_projects = list(mongo.db.projects.aggregate([
        {'$group': {
            '_id': '$department_id',
            'count': {'$sum': 1}
        }}
    ]))
    
    for dept in dept_projects:
        dept_info = mongo.db.departments.find_one({'_id': dept['_id']}, {'name': 1})
        dept['name'] = dept_info['name'] if dept_info else 'Unknown'
    
    return jsonify({
        'success': True,
        'data': {
            'stats': {
                'users': total_users,
                'departments': total_departments,
                'projects': {
                    'total': total_projects,
                    'active': active_projects
                },
                'tasks': {
                    'total': total_tasks,
                    'pending': pending_tasks,
                    'in_progress': in_progress_tasks,
                    'completed': completed_tasks
                },
                'clients': total_clients,
                'finance': {
                    'income': total_income,
                    'expenses': expenses,
                    'profit': total_income - expenses
                }
            },
            'recent_tasks': serialize_document(recent_tasks),
            'recent_projects': serialize_document(recent_projects),
            'department_distribution': dept_projects
        }
    }), 200

@dashboard_bp.route('/team-leader', methods=['GET'])
@jwt_required()
def get_team_leader_dashboard():
    """Get team leader dashboard data."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    if current_user.get('role') != 'team_leader':
        return jsonify({'success': False, 'message': 'Team leader access required'}), 403
    
    department_id = current_user.get('department_id')
    
    # Get department info
    department = mongo.db.departments.find_one({'_id': department_id})
    
    # Get team members with their task counts
    team_members = list(mongo.db.users.find({
        'department_id': department_id,
        'is_active': True,
        'role': 'team_member'
    }, {'password': 0}))
    
    # Enrich team members with task statistics
    for member in team_members:
        member_tasks = list(mongo.db.tasks.find({'assigned_to': member['_id']}))
        member['task_stats'] = {
            'total': len(member_tasks),
            'pending': sum(1 for t in member_tasks if t.get('status') == 'pending'),
            'in_progress': sum(1 for t in member_tasks if t.get('status') == 'in_progress'),
            'completed': sum(1 for t in member_tasks if t.get('status') == 'completed')
        }
    
    # Get projects where team lead is assigned OR in their department
    query = {
        '$or': [
            {'team_lead_id': current_user_id},
            {'department_id': department_id}
        ]
    }
    projects = list(mongo.db.projects.find(query).sort('created_at', -1))
    
    # Get tasks for team lead's projects
    project_ids = [p['_id'] for p in projects]
    tasks = list(mongo.db.tasks.find({
        'project_id': {'$in': project_ids}
    }).sort('created_at', -1))
    
    # Enrich tasks with assignee and project info
    for task in tasks:
        if task.get('assigned_to'):
            assignee = mongo.db.users.find_one({'_id': task['assigned_to']}, 
                {'first_name': 1, 'last_name': 1, 'email': 1})
            task['assigned_to_user'] = serialize_document(assignee)
        
        project = mongo.db.projects.find_one({'_id': task.get('project_id')}, 
            {'name': 1, 'code': 1})
        task['project'] = serialize_document(project)
    
    # Calculate statistics
    project_stats = {
        'total': len(projects),
        'active': sum(1 for p in projects if p.get('status') == 'active'),
        'completed': sum(1 for p in projects if p.get('status') == 'completed')
    }
    
    task_stats = {
        'total': len(tasks),
        'pending': sum(1 for t in tasks if t.get('status') == 'pending'),
        'in_progress': sum(1 for t in tasks if t.get('status') == 'in_progress'),
        'completed': sum(1 for t in tasks if t.get('status') == 'completed')
    }
    
    return jsonify({
        'success': True,
        'data': {
            'department': serialize_document(department),
            'team_size': len(team_members),
            'team_members': serialize_document(team_members),
            'projects': project_stats,
            'tasks': task_stats,
            'recent_projects': serialize_document(projects[:5]),
            'recent_tasks': serialize_document(tasks[:10])
        }
    }), 200

@dashboard_bp.route('/team-member', methods=['GET'])
@jwt_required()
def get_team_member_dashboard():
    """Get team member dashboard data."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    if current_user.get('role') != 'team_member':
        return jsonify({'success': False, 'message': 'Team member access required'}), 403
    
    # Get assigned tasks
    my_tasks = list(mongo.db.tasks.find({
        'assigned_to': current_user_id
    }).sort('due_date', 1))
    
    # Get task statistics
    task_stats = {
        'total': len(my_tasks),
        'pending': sum(1 for t in my_tasks if t.get('status') == 'pending'),
        'in_progress': sum(1 for t in my_tasks if t.get('status') == 'in_progress'),
        'completed': sum(1 for t in my_tasks if t.get('status') == 'completed'),
        'overdue': sum(1 for t in my_tasks if t.get('status') != 'completed' and 
                      t.get('due_date') and t.get('due_date') < datetime.utcnow().isoformat())
    }
    
    # Get projects I'm working on
    project_ids = list(set(t['project_id'] for t in my_tasks if t.get('project_id')))
    my_projects = list(mongo.db.projects.find({
        '_id': {'$in': project_ids}
    }))
    
    return jsonify({
        'success': True,
        'data': {
            'task_stats': task_stats,
            'my_tasks': serialize_document(my_tasks[:10]),
            'my_projects': serialize_document(my_projects),
            'department': mongo.db.departments.find_one({'_id': current_user.get('department_id')}, {'name': 1})
        }
    }), 200

@dashboard_bp.route('/client', methods=['GET'])
@jwt_required()
def get_client_dashboard():
    """Get client dashboard data."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    if current_user.get('role') != 'client':
        return jsonify({'success': False, 'message': 'Client access required'}), 403
    
    # Get client's projects
    projects = list(mongo.db.projects.find({
        'client_id': current_user_id
    }).sort('created_at', -1))
    
    project_ids = [p['_id'] for p in projects]
    
    # Get tasks for these projects
    tasks = list(mongo.db.tasks.find({
        'project_id': {'$in': project_ids}
    }))
    
    # Calculate statistics
    project_stats = {
        'total': len(projects),
        'active': sum(1 for p in projects if p.get('status') == 'active'),
        'completed': sum(1 for p in projects if p.get('status') == 'completed')
    }
    
    task_stats = {
        'total': len(tasks),
        'pending': sum(1 for t in tasks if t.get('status') == 'pending'),
        'in_progress': sum(1 for t in tasks if t.get('status') == 'in_progress'),
        'completed': sum(1 for t in tasks if t.get('status') == 'completed')
    }
    
    # Get total spent from payments collection
    payments = list(mongo.db.payments.find({
        'client_id': current_user_id
    }).sort('created_at', -1))
    total_spent = sum(p['amount'] for p in payments)
    
    # Get service/payment history
    payment_history = []
    for payment in payments:
        payment_info = {
            'id': str(payment.get('_id')),
            'date': payment.get('created_at'),
            'amount': payment.get('amount', 0),
            'description': payment.get('package_name', ''),
            'project_id': payment.get('project_id'),
            'status': payment.get('status', 'completed'),
            'receipt_id': payment.get('receipt_id', ''),
            'payment_mode': payment.get('payment_mode', '')
        }
        
        # Get project info if available
        if payment.get('project_id'):
            project = mongo.db.projects.find_one(
                {'_id': payment['project_id']},
                {'name': 1, 'code': 1, 'service_name': 1}
            )
            if project:
                payment_info['project_name'] = project.get('name', 'Unknown Project')
                payment_info['project_code'] = project.get('code', '')
                payment_info['service_name'] = project.get('service_name', 'Service')
        
        payment_history.append(payment_info)
    
    # Get requirements submitted by client
    requirements = list(mongo.db.project_requirements.find({
        'client_id': current_user_id
    }).sort('created_at', -1))
    
    # Enrich requirements with service info
    for req in requirements:
        if req.get('department_id'):
            dept = mongo.db.departments.find_one(
                {'_id': req['department_id']},
                {'name': 1}
            )
            req['department_name'] = dept.get('name', 'Unknown') if dept else 'Unknown'
    
    return jsonify({
        'success': True,
        'data': {
            'projects': project_stats,
            'tasks': task_stats,
            'total_spent': total_spent,
            'my_projects': serialize_document(projects),
            'recent_tasks': serialize_document(tasks[:10]),
            'payment_history': payment_history[:10],  # Last 10 payments
            'service_history': serialize_document(requirements[:10])  # Last 10 services
        }
    }), 200
