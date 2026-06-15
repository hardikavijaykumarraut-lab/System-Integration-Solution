from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from bson.objectid import ObjectId
from app import mongo
from app.utils.decorators import admin_required, team_leader_required

requirements_bp = Blueprint('requirements', __name__)

@requirements_bp.route('/', methods=['POST'])
@jwt_required()
def submit_requirements():
    """Client submits project requirements after payment."""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    # Validate required fields
    if not data.get('package_id') or not data.get('requirements'):
        return jsonify({
            'success': False,
            'message': 'Package ID and requirements are required'
        }), 400
    
    # Get client details
    client = mongo.db.users.find_one({'_id': current_user_id})
    if not client:
        return jsonify({'success': False, 'message': 'Client not found'}), 404
    
    # Create requirement document
    requirement = {
        '_id': str(ObjectId()),
        'client_id': current_user_id,
        'client_name': f"{client.get('first_name', '')} {client.get('last_name', '')}".strip(),
        'client_email': client.get('email'),
        'package_id': data['package_id'],
        'package_name': data.get('package_name', ''),
        'department_id': data.get('department_id', ''),
        'amount_paid': data.get('amount_paid', 0),
        'project_title': data.get('project_title', ''),  # Optional custom project title
        'requirements': data['requirements'],
        'status': 'pending',  # pending, assigned, in_progress, completed
        'assigned_team_lead_id': None,
        'assigned_team_lead_name': None,
        'project_id': None,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'admin_notes': '',
        'priority': data.get('priority', 'medium'),  # low, medium, high
        'attachments': data.get('attachments', [])  # File attachments
    }
    
    mongo.db.project_requirements.insert_one(requirement)
    
    # Update client status
    mongo.db.users.update_one(
        {'_id': current_user_id},
        {'$set': {'has_submitted_requirements': True, 'last_requirement_id': requirement['_id']}}
    )
    
    return jsonify({
        'success': True,
        'message': 'Requirements submitted successfully',
        'data': {'requirement_id': requirement['_id']}
    }), 201

@requirements_bp.route('/', methods=['GET'])
@jwt_required()
@admin_required
def get_all_requirements():
    """Admin gets all pending requirements."""
    status = request.args.get('status', 'pending')
    
    query = {}
    if status != 'all':
        query['status'] = status
    
    requirements = list(mongo.db.project_requirements.find(query).sort('created_at', -1))
    
    # Format response
    result = []
    for req in requirements:
        # Get client details for profile image and company info
        client = mongo.db.users.find_one({'_id': req['client_id']},
            {'profile_image': 1, 'company_name': 1, 'address': 1, 'city': 1, 'country': 1, 'phone': 1})
        
        result.append({
            'id': req['_id'],
            'client_id': req['client_id'],
            'client_name': req['client_name'],
            'client_email': req['client_email'],
            'client_profile_image': client.get('profile_image') if client else None,
            'client_company': client.get('company_name') if client else None,
            'client_address': client.get('address') if client else None,
            'client_city': client.get('city') if client else None,
            'client_country': client.get('country') if client else None,
            'client_phone': client.get('phone') if client else None,
            'package_name': req['package_name'],
            'department_id': req['department_id'],
            'amount_paid': req['amount_paid'],
            'project_title': req.get('project_title', ''),  # Include project title
            'requirements': req['requirements'][:200] + '...' if len(req['requirements']) > 200 else req['requirements'],
            'full_requirements': req['requirements'],
            'status': req['status'],
            'assigned_team_lead_id': req.get('assigned_team_lead_id'),
            'assigned_team_lead_name': req.get('assigned_team_lead_name'),
            'created_at': req['created_at'].isoformat(),
            'priority': req.get('priority', 'medium'),
            'admin_notes': req.get('admin_notes', ''),
            'attachments': req.get('attachments', []),
            'documents_enabled_for_team_lead': req.get('documents_enabled_for_team_lead', False)
        })
    
    return jsonify({
        'success': True,
        'data': result
    }), 200


@requirements_bp.route('/<requirement_id>', methods=['GET'])
@jwt_required()
def get_requirement(requirement_id):
    """Get a specific requirement by ID."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    req = mongo.db.project_requirements.find_one({'_id': requirement_id})
    
    if not req:
        return jsonify({'success': False, 'message': 'Requirement not found'}), 404
    
    # Check permissions
    if current_user.get('role') == 'admin':
        pass
    elif current_user.get('role') == 'client' and req['client_id'] != current_user_id:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    elif current_user.get('role') == 'team_leader':
        # Team lead can view if they are assigned to this requirement
        if req.get('assigned_team_lead_id') != current_user_id:
            return jsonify({'success': False, 'message': 'Access denied'}), 403
        # Note: documents_enabled_for_team_lead controls access to raw attachments
        # but shared_files in project are always accessible
    
    # Get client details
    client = mongo.db.users.find_one({'_id': req['client_id']},
        {'profile_image': 1, 'company_name': 1, 'address': 1, 'city': 1, 'country': 1, 'phone': 1})
    
    # If this requirement is already converted into a project, include shared project files too
    project_shared_files = []
    if req.get('project_id'):
        project = mongo.db.projects.find_one({'_id': req['project_id']}, {'shared_files': 1})
        if project:
            project_shared_files = project.get('shared_files', [])

    return jsonify({
        'success': True,
        'data': {
            'id': req['_id'],
            'client_id': req['client_id'],
            'client_name': req['client_name'],
            'client_email': req['client_email'],
            'client_profile_image': client.get('profile_image') if client else None,
            'client_company': client.get('company_name') if client else None,
            'client_address': client.get('address') if client else None,
            'client_city': client.get('city') if client else None,
            'client_country': client.get('country') if client else None,
            'client_phone': client.get('phone') if client else None,
            'package_name': req['package_name'],
            'department_id': req['department_id'],
            'amount_paid': req['amount_paid'],
            'project_title': req.get('project_title', ''),  # Include project title
            'requirements': req['requirements'],
            'status': req['status'],
            'assigned_team_lead_id': req.get('assigned_team_lead_id'),
            'assigned_team_lead_name': req.get('assigned_team_lead_name'),
            'created_at': req['created_at'].isoformat(),
            'priority': req.get('priority', 'medium'),
            'admin_notes': req.get('admin_notes', ''),
            'attachments': req.get('attachments', []),
            'project_id': req.get('project_id'),
            'project_shared_files': project_shared_files,
            'documents_enabled_for_team_lead': req.get('documents_enabled_for_team_lead', False)
        }
    }), 200


@requirements_bp.route('/<requirement_id>/document-access', methods=['PUT'])
@jwt_required()
@admin_required
def toggle_document_access(requirement_id):
    """Admin toggles document access for team lead."""
    data = request.get_json()
    enabled = data.get('enabled', False)
    
    result = mongo.db.project_requirements.update_one(
        {'_id': requirement_id},
        {'$set': {'documents_enabled_for_team_lead': enabled, 'updated_at': datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        return jsonify({'success': False, 'message': 'Requirement not found'}), 404
    
    return jsonify({
        'success': True,
        'message': f'Document access {"enabled" if enabled else "disabled"} successfully',
        'data': {'enabled': enabled}
    }), 200

@requirements_bp.route('/<requirement_id>/assign', methods=['POST'])
@jwt_required()
@admin_required
def assign_team_lead(requirement_id):
    """Admin assigns a team lead to a requirement."""
    data = request.get_json()
    team_lead_id = data.get('team_lead_id')
    shared_files = data.get('shared_files', [])
    
    if not team_lead_id:
        return jsonify({
            'success': False,
            'message': 'Team lead ID is required'
        }), 400
    
    # Get team lead details
    team_lead = mongo.db.users.find_one({
        '_id': team_lead_id,
        'role': 'team_leader',
        'is_active': True
    })
    
    if not team_lead:
        return jsonify({
            'success': False,
            'message': 'Team lead not found or inactive'
        }), 404
    
    # Get requirement details
    requirement = mongo.db.project_requirements.find_one({'_id': requirement_id})
    if not requirement:
        return jsonify({
            'success': False,
            'message': 'Requirement not found'
        }), 404
    
    # Create a project for this requirement
    project_name = requirement.get('project_title') or f"{requirement['client_name']}'s Project"
    project = {
        '_id': str(ObjectId()),
        'name': project_name,
        'description': requirement['requirements'][:500],
        'client_id': requirement['client_id'],
        'client_name': requirement['client_name'],
        'team_lead_id': team_lead_id,
        'team_lead_name': f"{team_lead.get('first_name', '')} {team_lead.get('last_name', '')}".strip(),
        'department_id': requirement['department_id'],
        'status': 'active',
        'progress': 0,
        'requirement_id': requirement_id,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'start_date': datetime.utcnow(),
        'deadline': None,
        'budget': requirement['amount_paid'],
        'shared_files': shared_files  # Store shared files for team lead access
    };
    
    mongo.db.projects.insert_one(project)
    
    # Update requirement
    mongo.db.project_requirements.update_one(
        {'_id': requirement_id},
        {
            '$set': {
                'assigned_team_lead_id': team_lead_id,
                'assigned_team_lead_name': f"{team_lead.get('first_name', '')} {team_lead.get('last_name', '')}".strip(),
                'status': 'assigned',
                'updated_at': datetime.utcnow(),
                'project_id': project['_id'],
                'documents_enabled_for_team_lead': True  # Enable documents when assigned
            }
        }
    )
    
    # Update client status
    mongo.db.users.update_one(
        {'_id': requirement['client_id']},
        {'$set': {
            'has_active_project': True,
            'current_project_id': project['_id'],
            'assigned_team_lead_id': team_lead_id
        }}
    )
    
    return jsonify({
        'success': True,
        'message': 'Team lead assigned successfully',
        'data': {
            'project_id': project['_id'],
            'team_lead_name': project['team_lead_name'],
            'shared_files_count': len(shared_files)
        }
    }), 200

@requirements_bp.route('/my-requirement', methods=['GET'])
@jwt_required()
def get_my_requirement():
    """Client gets their submitted requirement."""
    current_user_id = get_jwt_identity()
    
    requirement = mongo.db.project_requirements.find_one(
        {'client_id': current_user_id},
        sort=[('created_at', -1)]
    )
    
    if not requirement:
        return jsonify({
            'success': True,
            'data': None
        }), 200
    
    project_shared_files = []
    if requirement.get('project_id'):
        project = mongo.db.projects.find_one({'_id': requirement['project_id']}, {'shared_files': 1})
        if project:
            project_shared_files = project.get('shared_files', [])

    return jsonify({
        'success': True,
        'data': {
            'id': requirement['_id'],
            'package_name': requirement['package_name'],
            'status': requirement['status'],
            'assigned_team_lead_name': requirement.get('assigned_team_lead_name'),
            'created_at': requirement['created_at'].isoformat(),
            'requirements': requirement['requirements'],
            'project_id': requirement.get('project_id'),
            'project_title': requirement.get('project_title', ''),
            'attachments': requirement.get('attachments', []),
            'project_shared_files': project_shared_files
        }
    }), 200

@requirements_bp.route('/assigned', methods=['GET'])
@jwt_required()
@team_leader_required
def get_assigned_requirements():
    """Team lead gets requirements assigned to them."""
    current_user_id = get_jwt_identity()
    
    requirements = list(mongo.db.project_requirements.find({
        'assigned_team_lead_id': current_user_id
    }).sort('created_at', -1))
    
    result = []
    for req in requirements:
        result.append({
            'id': req['_id'],
            'client_name': req['client_name'],
            'client_email': req['client_email'],
            'package_name': req['package_name'],
            'project_title': req.get('project_title', ''),
            'requirements': req['requirements'],
            'status': req['status'],
            'project_id': req.get('project_id'),
            'created_at': req['created_at'].isoformat(),
            'priority': req.get('priority', 'medium')
        })
    
    return jsonify({
        'success': True,
        'data': result
    }), 200
