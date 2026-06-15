from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app import mongo
from app.utils.decorators import admin_required, team_leader_required
from app.utils.helpers import generate_unique_id, serialize_document, paginate_results, generate_project_code

projects_bp = Blueprint('projects', __name__)

@projects_bp.route('/', methods=['GET'])
@jwt_required()
def get_projects():
    """Get all projects with filtering and pagination."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    # Get query parameters
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    status = request.args.get('status')
    department_id = request.args.get('department_id')
    client_id = request.args.get('client_id')
    search = request.args.get('search')
    
    # Build query
    query = {}
    
    # Role-based filtering
    if current_user.get('role') == 'admin':
        pass
    elif current_user.get('role') == 'team_leader':
        # Team leaders see projects where they are assigned as team lead
        # OR projects in their department
        query['$or'] = [
            {'team_lead_id': current_user_id},
            {'department_id': current_user.get('department_id')}
        ]
    elif current_user.get('role') == 'team_member':
        # Team members see projects they have tasks in
        user_tasks = mongo.db.tasks.find({'assigned_to': current_user_id}, {'project_id': 1})
        project_ids = list(set([t['project_id'] for t in user_tasks]))
        query['_id'] = {'$in': project_ids}
    elif current_user.get('role') == 'client':
        query['client_id'] = current_user_id
    
    # Apply filters
    if status:
        query['status'] = status
    if department_id and current_user.get('role') == 'admin':
        query['department_id'] = department_id
    if client_id and current_user.get('role') == 'admin':
        query['client_id'] = client_id
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'code': {'$regex': search, '$options': 'i'}},
            {'description': {'$regex': search, '$options': 'i'}}
        ]
    
    # Execute query with pagination
    projects_cursor = mongo.db.projects.find(query).sort('created_at', -1)
    result = paginate_results(projects_cursor, page, per_page)
    
    # Enrich projects with related data
    for project in result['items']:
        # Get client info
        if project.get('client_id'):
            client = mongo.db.users.find_one({'_id': project['client_id']},
                {'first_name': 1, 'last_name': 1, 'email': 1, 'company_name': 1})
            project['client'] = serialize_document(client)
        
        # Get department info
        if project.get('department_id'):
            department = mongo.db.departments.find_one({'_id': project['department_id']},
                {'name': 1, 'code': 1, 'color': 1})
            project['department'] = serialize_document(department)
        
        # Get task statistics
        project['task_stats'] = {
            'total': mongo.db.tasks.count_documents({'project_id': project['_id']}),
            'completed': mongo.db.tasks.count_documents({
                'project_id': project['_id'],
                'status': 'completed'
            }),
            'in_progress': mongo.db.tasks.count_documents({
                'project_id': project['_id'],
                'status': 'in_progress'
            }),
            'pending': mongo.db.tasks.count_documents({
                'project_id': project['_id'],
                'status': 'pending'
            })
        }
    
    return jsonify({
        'success': True,
        'data': {
            'projects': serialize_document(result['items']),
            'pagination': {
                'total': result['total'],
                'page': result['page'],
                'per_page': result['per_page'],
                'total_pages': result['total_pages']
            }
        }
    }), 200

@projects_bp.route('/', methods=['POST'])
@jwt_required()
def create_project():
    """Create a new project."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['name', 'department_id']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'success': False, 'message': f'{field} is required'}), 400
    
    # Check permissions
    if current_user.get('role') not in ['admin', 'team_leader']:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    if current_user.get('role') == 'team_leader':
        if data['department_id'] != current_user.get('department_id'):
            return jsonify({'success': False, 'message': 'Can only create projects for your department'}), 403
    
    # Verify department exists
    department = mongo.db.departments.find_one({'_id': data['department_id']})
    if not department:
        return jsonify({'success': False, 'message': 'Department not found'}), 404
    
    # If client_id provided, verify client exists
    if data.get('client_id'):
        client = mongo.db.users.find_one({'_id': data['client_id'], 'role': 'client'})
        if not client:
            return jsonify({'success': False, 'message': 'Client not found'}), 404
    
    # Generate project code
    project_count = mongo.db.projects.count_documents({
        'department_id': data['department_id']
    }) + 1
    code = generate_project_code(department['code'], project_count)
    
    project = {
        '_id': generate_unique_id(),
        'name': data['name'],
        'code': code,
        'description': data.get('description', ''),
        'department_id': data['department_id'],
        'client_id': data.get('client_id'),
        'status': data.get('status', 'active'),
        'priority': data.get('priority', 'medium'),
        'start_date': data.get('start_date'),
        'end_date': data.get('end_date'),
        'budget': data.get('budget'),
        'actual_cost': 0,
        'progress': 0,
        'created_by': current_user_id,
        'team_members': data.get('team_members', []),
        'attachments': data.get('attachments', []),
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }
    
    mongo.db.projects.insert_one(project)
    
    # If client is assigned, add project to client's projects list
    if data.get('client_id'):
        mongo.db.users.update_one(
            {'_id': data['client_id']},
            {'$push': {'projects': project['_id']}}
        )
    
    return jsonify({
        'success': True,
        'message': 'Project created successfully',
        'data': serialize_document(project)
    }), 201

@projects_bp.route('/<project_id>', methods=['GET'])
@jwt_required()
def get_project(project_id):
    """Get a specific project by ID."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    project = mongo.db.projects.find_one({'_id': project_id})
    
    if not project:
        return jsonify({'success': False, 'message': 'Project not found'}), 404
    
    # Check permissions
    if current_user.get('role') == 'admin':
        pass
    elif current_user.get('role') == 'team_leader':
        # Team leader can access if they are assigned to the project OR if it's in their department
        if project.get('team_lead_id') != current_user_id and project.get('department_id') != current_user.get('department_id'):
            return jsonify({'success': False, 'message': 'Access denied'}), 403
    elif current_user.get('role') == 'client':
        if project.get('client_id') != current_user_id:
            return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    # Enrich project with related data
    if project.get('client_id'):
        client = mongo.db.users.find_one({'_id': project['client_id']},
            {'password': 0})
        project['client'] = serialize_document(client)
    
    if project.get('department_id'):
        department = mongo.db.departments.find_one({'_id': project['department_id']})
        project['department'] = serialize_document(department)
    
    if project.get('created_by'):
        creator = mongo.db.users.find_one({'_id': project['created_by']},
            {'first_name': 1, 'last_name': 1, 'email': 1})
        project['created_by_user'] = serialize_document(creator)

    if project.get('team_lead_id'):
        team_lead = mongo.db.users.find_one({'_id': project['team_lead_id']},
            {'first_name': 1, 'last_name': 1, 'email': 1})
        project['team_lead_user'] = serialize_document(team_lead)
    
    # Get team members
    if project.get('team_members'):
        members = list(mongo.db.users.find(
            {'_id': {'$in': project['team_members']}},
            {'password': 0}
        ))
        project['team_members_data'] = serialize_document(members)
    
    # Get task statistics
    project['task_stats'] = {
        'total': mongo.db.tasks.count_documents({'project_id': project_id}),
        'completed': mongo.db.tasks.count_documents({
            'project_id': project_id,
            'status': 'completed'
        }),
        'in_progress': mongo.db.tasks.count_documents({
            'project_id': project_id,
            'status': 'in_progress'
        }),
        'pending': mongo.db.tasks.count_documents({
            'project_id': project_id,
            'status': 'pending'
        })
    }
    
    return jsonify({
        'success': True,
        'data': serialize_document(project)
    }), 200

@projects_bp.route('/<project_id>', methods=['PUT'])
@jwt_required()
def update_project(project_id):
    """Update a project."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    project = mongo.db.projects.find_one({'_id': project_id})
    
    if not project:
        return jsonify({'success': False, 'message': 'Project not found'}), 404
    
    # Check permissions
    if current_user.get('role') not in ['admin', 'team_leader']:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    if current_user.get('role') == 'team_leader':
        if project.get('department_id') != current_user.get('department_id'):
            return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    data = request.get_json()
    
    # Fields that can be updated
    allowed_fields = ['name', 'description', 'status', 'priority', 
                     'start_date', 'end_date', 'budget', 'progress', 'team_members']
    
    update_data = {}
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]
    
    update_data['updated_at'] = datetime.utcnow()
    
    mongo.db.projects.update_one(
        {'_id': project_id},
        {'$set': update_data}
    )
    
    updated_project = mongo.db.projects.find_one({'_id': project_id})
    
    return jsonify({
        'success': True,
        'message': 'Project updated successfully',
        'data': serialize_document(updated_project)
    }), 200

@projects_bp.route('/<project_id>', methods=['DELETE'])
@admin_required
def delete_project(project_id):
    """Delete a project (admin only)."""
    project = mongo.db.projects.find_one({'_id': project_id})
    
    if not project:
        return jsonify({'success': False, 'message': 'Project not found'}), 404
    
    # Delete associated tasks
    mongo.db.tasks.delete_many({'project_id': project_id})
    
    # Remove project from client's projects list
    if project.get('client_id'):
        mongo.db.users.update_one(
            {'_id': project['client_id']},
            {'$pull': {'projects': project_id}}
        )
    
    # Delete project
    mongo.db.projects.delete_one({'_id': project_id})
    
    return jsonify({
        'success': True,
        'message': 'Project deleted successfully'
    }), 200

@projects_bp.route('/<project_id>/add-member', methods=['POST'])
@jwt_required()
def add_team_member(project_id):
    """Add a team member to a project."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    project = mongo.db.projects.find_one({'_id': project_id})
    
    if not project:
        return jsonify({'success': False, 'message': 'Project not found'}), 404
    
    # Check permissions
    if current_user.get('role') not in ['admin', 'team_leader']:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    if current_user.get('role') == 'team_leader':
        if project.get('department_id') != current_user.get('department_id'):
            return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    data = request.get_json()
    member_id = data.get('user_id')
    
    if not member_id:
        return jsonify({'success': False, 'message': 'user_id is required'}), 400
    
    # Verify user exists and is in the same department
    member = mongo.db.users.find_one({
        '_id': member_id,
        'department_id': project.get('department_id'),
        'is_active': True
    })
    
    if not member:
        return jsonify({'success': False, 'message': 'Team member not found or not in project department'}), 404
    
    # Add member to project
    mongo.db.projects.update_one(
        {'_id': project_id},
        {
            '$addToSet': {'team_members': member_id},
            '$set': {'updated_at': datetime.utcnow()}
        }
    )
    
    return jsonify({
        'success': True,
        'message': 'Team member added successfully'
    }), 200

@projects_bp.route('/<project_id>/remove-member', methods=['POST'])
@jwt_required()
def remove_team_member(project_id):
    """Remove a team member from a project."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    project = mongo.db.projects.find_one({'_id': project_id})
    
    if not project:
        return jsonify({'success': False, 'message': 'Project not found'}), 404
    
    # Check permissions
    if current_user.get('role') not in ['admin', 'team_leader']:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    data = request.get_json()
    member_id = data.get('user_id')
    
    if not member_id:
        return jsonify({'success': False, 'message': 'user_id is required'}), 400
    
    # Remove member from project
    mongo.db.projects.update_one(
        {'_id': project_id},
        {
            '$pull': {'team_members': member_id},
            '$set': {'updated_at': datetime.utcnow()}
        }
    )
    
    return jsonify({
        'success': True,
        'message': 'Team member removed successfully'
    }), 200

@projects_bp.route('/stats', methods=['GET'])
@admin_required
def get_project_stats():
    """Get project statistics (admin only)."""
    # Get status counts
    status_counts = list(mongo.db.projects.aggregate([
        {'$group': {'_id': '$status', 'count': {'$sum': 1}}}
    ]))
    
    # Get department-wise counts
    dept_counts = list(mongo.db.projects.aggregate([
        {'$group': {'_id': '$department_id', 'count': {'$sum': 1}}}
    ]))
    
    # Enrich department data
    for dept in dept_counts:
        dept_info = mongo.db.departments.find_one({'_id': dept['_id']}, {'name': 1})
        dept['name'] = dept_info['name'] if dept_info else 'Unknown'
    
    # Get total projects
    total_projects = mongo.db.projects.count_documents({})
    
    # Get active projects
    active_projects = mongo.db.projects.count_documents({'status': 'active'})
    
    return jsonify({
        'success': True,
        'data': {
            'total': total_projects,
            'active': active_projects,
            'by_status': status_counts,
            'by_department': dept_counts
        }
    }), 200
