from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app import mongo
from app.utils.decorators import admin_required, team_leader_required, team_member_required
from app.utils.helpers import generate_unique_id, serialize_document, paginate_results

tasks_bp = Blueprint('tasks', __name__)

@tasks_bp.route('/', methods=['GET'])
@jwt_required()
def get_tasks():
    """Get all tasks with filtering and pagination."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    # Get query parameters
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    status = request.args.get('status')
    priority = request.args.get('priority')
    project_id = request.args.get('project_id')
    department_id = request.args.get('department_id')
    assigned_to = request.args.get('assigned_to')
    search = request.args.get('search')
    
    # Build query
    query = {}
    
    # Role-based filtering
    if current_user.get('role') == 'admin':
        # Admin can see all tasks
        pass
    elif current_user.get('role') == 'team_leader':
        # Team leader can see tasks in their department
        # OR tasks for projects where they are the assigned team lead
        # OR tasks they created or are assigned to
        team_lead_projects = list(mongo.db.projects.find(
            {'team_lead_id': current_user_id}, 
            {'_id': 1}
        ))
        project_ids = [p['_id'] for p in team_lead_projects]
        
        or_conditions = [
            {'assigned_to': current_user_id},
            {'created_by': current_user_id}
        ]
        
        if current_user.get('department_id'):
            or_conditions.append({'department_id': current_user.get('department_id')})
        
        if project_ids:
            or_conditions.append({'project_id': {'$in': project_ids}})
        
        query['$or'] = or_conditions
    elif current_user.get('role') == 'team_member':
        # Team member can see tasks assigned to them or in their department
        query['$or'] = [
            {'assigned_to': current_user_id},
            {'created_by': current_user_id}
        ]
    elif current_user.get('role') == 'client':
        # Client can see tasks related to their projects
        client_projects = mongo.db.projects.find({'client_id': current_user_id}, {'_id': 1})
        project_ids = [p['_id'] for p in client_projects]
        query['project_id'] = {'$in': project_ids}
    
    # Apply filters
    if status:
        query['status'] = status
    if priority:
        query['priority'] = priority
    if project_id:
        query['project_id'] = project_id
    if department_id and current_user.get('role') == 'admin':
        query['department_id'] = department_id
    if assigned_to:
        query['assigned_to'] = assigned_to
    if search:
        query['$or'] = [
            {'title': {'$regex': search, '$options': 'i'}},
            {'description': {'$regex': search, '$options': 'i'}}
        ]
    
    # Execute query with pagination
    tasks_cursor = mongo.db.tasks.find(query).sort('created_at', -1)
    result = paginate_results(tasks_cursor, page, per_page)
    
    # Enrich tasks with user and project data
    for task in result['items']:
        if task.get('assigned_to'):
            assignee = mongo.db.users.find_one({'_id': task['assigned_to']}, 
                {'first_name': 1, 'last_name': 1, 'email': 1})
            task['assigned_to_user'] = serialize_document(assignee)
        
        if task.get('created_by'):
            creator = mongo.db.users.find_one({'_id': task['created_by']},
                {'first_name': 1, 'last_name': 1, 'email': 1})
            task['created_by_user'] = serialize_document(creator)

        if task.get('project_id'):
            project = mongo.db.projects.find_one({'_id': task['project_id']},
                {'name': 1, 'project_name': 1, 'project_title': 1, 'package_name': 1, 'code': 1})
            task['project'] = serialize_document(project)
    
    return jsonify({
        'success': True,
        'data': {
            'tasks': serialize_document(result['items']),
            'pagination': {
                'total': result['total'],
                'page': result['page'],
                'per_page': result['per_page'],
                'total_pages': result['total_pages']
            }
        }
    }), 200

@tasks_bp.route('/', methods=['POST'])
@jwt_required()
def create_task():
    """Create a new task."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['title', 'project_id']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'success': False, 'message': f'{field} is required'}), 400
    
    # Verify project exists
    project = mongo.db.projects.find_one({'_id': data['project_id']})
    if not project:
        return jsonify({'success': False, 'message': 'Project not found'}), 404
    
    # Check permissions
    if current_user.get('role') not in ['admin', 'team_leader']:
        if current_user.get('role') == 'team_member':
            # Team members can only create tasks for themselves
            if data.get('assigned_to') and data['assigned_to'] != current_user_id:
                return jsonify({'success': False, 'message': 'Can only create tasks for yourself'}), 403
        else:
            return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    if current_user.get('role') == 'team_leader':
        # Team lead can create tasks if they are assigned to the project
        # OR if the project is in their department
        if project.get('team_lead_id') != current_user_id and project.get('department_id') != current_user.get('department_id'):
            return jsonify({'success': False, 'message': 'Access denied for this project'}), 403
    
    # Create task
    task = {
        '_id': generate_unique_id(),
        'title': data['title'],
        'description': data.get('description', ''),
        'project_id': data['project_id'],
        'department_id': project.get('department_id'),
        'assigned_to': data.get('assigned_to'),
        'created_by': current_user_id,
        'status': data.get('status', 'pending'),
        'priority': data.get('priority', 'medium'),
        'progress': data.get('progress', 0),
        'due_date': data.get('due_date'),
        'started_at': None,
        'completed_at': None,
        'estimated_hours': data.get('estimated_hours'),
        'actual_hours': 0,
        'tags': data.get('tags', []),
        'attachments': data.get('attachments', []),
        'shared_files': data.get('shared_files', []),
        'comments': [],
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }
    
    mongo.db.tasks.insert_one(task)
    
    return jsonify({
        'success': True,
        'message': 'Task created successfully',
        'data': serialize_document(task)
    }), 201

@tasks_bp.route('/<task_id>', methods=['GET'])
@jwt_required()
def get_task(task_id):
    """Get a specific task by ID."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    task = mongo.db.tasks.find_one({'_id': task_id})
    
    if not task:
        return jsonify({'success': False, 'message': 'Task not found'}), 404
    
    # Check permissions
    if current_user.get('role') == 'admin':
        pass
    elif current_user.get('role') == 'team_leader':
        if task.get('department_id') != current_user.get('department_id'):
            return jsonify({'success': False, 'message': 'Access denied'}), 403
    elif current_user.get('role') == 'team_member':
        if task.get('assigned_to') != current_user_id and task.get('created_by') != current_user_id:
            return jsonify({'success': False, 'message': 'Access denied'}), 403
    elif current_user.get('role') == 'client':
        project = mongo.db.projects.find_one({'_id': task.get('project_id')})
        if not project or project.get('client_id') != current_user_id:
            return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    # Enrich task with user data
    if task.get('assigned_to'):
        assignee = mongo.db.users.find_one({'_id': task['assigned_to']},
            {'password': 0})
        task['assigned_to_user'] = serialize_document(assignee)
    
    if task.get('created_by'):
        creator = mongo.db.users.find_one({'_id': task['created_by']},
            {'password': 0})
        task['created_by_user'] = serialize_document(creator)
    
    # Get project info
    if task.get('project_id'):
        project = mongo.db.projects.find_one({'_id': task['project_id']},
            {'name': 1, 'code': 1})
        task['project'] = serialize_document(project)
    
    return jsonify({
        'success': True,
        'data': serialize_document(task)
    }), 200

@tasks_bp.route('/<task_id>', methods=['PUT'])
@jwt_required()
def update_task(task_id):
    """Update a task."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    task = mongo.db.tasks.find_one({'_id': task_id})
    
    if not task:
        return jsonify({'success': False, 'message': 'Task not found'}), 404
    
    # Check permissions
    if current_user.get('role') == 'admin':
        pass
    elif current_user.get('role') == 'team_leader':
        if task.get('department_id') != current_user.get('department_id'):
            return jsonify({'success': False, 'message': 'Access denied'}), 403
    elif current_user.get('role') == 'team_member':
        # Team members can only update tasks assigned to them
        if task.get('assigned_to') != current_user_id:
            return jsonify({'success': False, 'message': 'Access denied'}), 403
    else:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    data = request.get_json()
    
    # Fields that can be updated
    allowed_fields = ['title', 'description', 'status', 'priority', 'progress', 
                     'due_date', 'estimated_hours', 'tags']
    
    # Team leaders and admins can also update assignment
    if current_user.get('role') in ['admin', 'team_leader']:
        allowed_fields.append('assigned_to')
    
    update_data = {}
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]
    
    # Handle status change timestamps
    if 'status' in update_data:
        if update_data['status'] == 'in_progress' and not task.get('started_at'):
            update_data['started_at'] = datetime.utcnow()
        elif update_data['status'] == 'completed':
            update_data['completed_at'] = datetime.utcnow()
            update_data['progress'] = 100
    
    update_data['updated_at'] = datetime.utcnow()
    
    mongo.db.tasks.update_one(
        {'_id': task_id},
        {'$set': update_data}
    )
    
    # Get updated task
    updated_task = mongo.db.tasks.find_one({'_id': task_id})
    
    return jsonify({
        'success': True,
        'message': 'Task updated successfully',
        'data': serialize_document(updated_task)
    }), 200

@tasks_bp.route('/<task_id>', methods=['DELETE'])
@jwt_required()
def delete_task(task_id):
    """Delete a task."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    task = mongo.db.tasks.find_one({'_id': task_id})
    
    if not task:
        return jsonify({'success': False, 'message': 'Task not found'}), 404
    
    # Check permissions
    if current_user.get('role') not in ['admin', 'team_leader']:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    if current_user.get('role') == 'team_leader':
        if task.get('department_id') != current_user.get('department_id'):
            return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    mongo.db.tasks.delete_one({'_id': task_id})
    
    return jsonify({
        'success': True,
        'message': 'Task deleted successfully'
    }), 200

@tasks_bp.route('/<task_id>/comments', methods=['POST'])
@jwt_required()
def add_comment(task_id):
    """Add a comment to a task."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    task = mongo.db.tasks.find_one({'_id': task_id})
    
    if not task:
        return jsonify({'success': False, 'message': 'Task not found'}), 404
    
    data = request.get_json()
    
    if not data.get('content'):
        return jsonify({'success': False, 'message': 'Comment content is required'}), 400
    
    comment = {
        '_id': generate_unique_id(),
        'content': data['content'],
        'created_by': current_user_id,
        'created_at': datetime.utcnow()
    }
    
    mongo.db.tasks.update_one(
        {'_id': task_id},
        {
            '$push': {'comments': comment},
            '$set': {'updated_at': datetime.utcnow()}
        }
    )
    
    return jsonify({
        'success': True,
        'message': 'Comment added successfully',
        'data': serialize_document(comment)
    }), 201

@tasks_bp.route('/by-project/<project_id>', methods=['GET'])
@jwt_required()
def get_tasks_by_project(project_id):
    """Get all tasks for a specific project."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    # Verify project exists
    project = mongo.db.projects.find_one({'_id': project_id})
    if not project:
        return jsonify({'success': False, 'message': 'Project not found'}), 404
    
    # Check permissions
    if current_user.get('role') == 'admin':
        pass
    elif current_user.get('role') == 'team_leader':
        if project.get('department_id') != current_user.get('department_id'):
            return jsonify({'success': False, 'message': 'Access denied'}), 403
    elif current_user.get('role') == 'client':
        if project.get('client_id') != current_user_id:
            return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    tasks = list(mongo.db.tasks.find({'project_id': project_id}).sort('created_at', -1))
    
    # Enrich tasks with user data
    for task in tasks:
        if task.get('assigned_to'):
            assignee = mongo.db.users.find_one({'_id': task['assigned_to']},
                {'first_name': 1, 'last_name': 1})
            task['assigned_to_user'] = serialize_document(assignee)
    
    return jsonify({
        'success': True,
        'data': serialize_document(tasks)
    }), 200

@tasks_bp.route('/my-tasks', methods=['GET'])
@jwt_required()
def get_my_tasks():
    """Get tasks assigned to current user."""
    current_user_id = get_jwt_identity()
    
    status = request.args.get('status')
    
    query = {'assigned_to': current_user_id}
    if status:
        query['status'] = status
    
    tasks = list(mongo.db.tasks.find(query).sort('due_date', 1))
    
    # Enrich tasks with project data
    for task in tasks:
        if task.get('project_id'):
            project = mongo.db.projects.find_one({'_id': task['project_id']},
                {'name': 1, 'code': 1})
            task['project'] = serialize_document(project)
    
    return jsonify({
        'success': True,
        'data': serialize_document(tasks)
    }), 200

@tasks_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_task_stats():
    """Get task statistics."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    query = {}
    
    # Role-based filtering
    if current_user.get('role') == 'admin':
        pass
    elif current_user.get('role') == 'team_leader':
        query['department_id'] = current_user.get('department_id')
    elif current_user.get('role') == 'team_member':
        query['assigned_to'] = current_user_id
    elif current_user.get('role') == 'client':
        client_projects = mongo.db.projects.find({'client_id': current_user_id}, {'_id': 1})
        project_ids = [p['_id'] for p in client_projects]
        query['project_id'] = {'$in': project_ids}
    
    # Get status counts
    status_counts = list(mongo.db.tasks.aggregate([
        {'$match': query},
        {'$group': {'_id': '$status', 'count': {'$sum': 1}}}
    ]))
    
    # Get priority counts
    priority_counts = list(mongo.db.tasks.aggregate([
        {'$match': query},
        {'$group': {'_id': '$priority', 'count': {'$sum': 1}}}
    ]))
    
    # Get overdue tasks
    overdue_query = query.copy()
    overdue_query['due_date'] = {'$lt': datetime.utcnow().isoformat()}
    overdue_query['status'] = {'$nin': ['completed', 'cancelled']}
    overdue_count = mongo.db.tasks.count_documents(overdue_query)
    
    # Get total count
    total_count = mongo.db.tasks.count_documents(query)
    
    return jsonify({
        'success': True,
        'data': {
            'total': total_count,
            'by_status': status_counts,
            'by_priority': priority_counts,
            'overdue': overdue_count
        }
    }), 200