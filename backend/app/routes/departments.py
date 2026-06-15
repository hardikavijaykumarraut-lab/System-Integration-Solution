from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app import mongo
from app.utils.decorators import admin_required, team_leader_required
from app.utils.helpers import generate_unique_id, serialize_document

departments_bp = Blueprint('departments', __name__)

# Default departments
DEFAULT_DEPARTMENTS = [
    {
        '_id': 'dept_web_dev',
        'name': 'Web Development',
        'code': 'WEB',
        'description': 'Responsible for designing, coding, testing, and deploying client applications',
        'color': '#2196F3',
        'icon': 'code',
        'is_active': True,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    },
    {
        '_id': 'dept_digital_mkt',
        'name': 'Digital Marketing',
        'code': 'MKT',
        'description': 'Focused on campaign management, SEO, content creation, and analytics',
        'color': '#4CAF50',
        'icon': 'trending_up',
        'is_active': True,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    },
    {
        '_id': 'dept_placement',
        'name': 'Placement Consultancy',
        'code': 'PLC',
        'description': 'Handles candidate sourcing, interview scheduling, and company outreach',
        'color': '#FF9800',
        'icon': 'people',
        'is_active': True,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }
]

def initialize_default_departments():
    """Initialize default departments if they don't exist."""
    for dept in DEFAULT_DEPARTMENTS:
        if not mongo.db.departments.find_one({'_id': dept['_id']}):
            mongo.db.departments.insert_one(dept)

@departments_bp.route('/', methods=['GET'])
def get_departments():
    """Get all departments."""
    # Initialize default departments if needed
    initialize_default_departments()
    
    include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'
    
    query = {}
    if not include_inactive:
        query['is_active'] = True
    
    departments = list(mongo.db.departments.find(query).sort('name', 1))
    
    # Get team leader count for each department
    for dept in departments:
        dept['team_leader_count'] = mongo.db.users.count_documents({
            'department_id': dept['_id'],
            'role': 'team_leader',
            'is_active': True
        })
        dept['member_count'] = mongo.db.users.count_documents({
            'department_id': dept['_id'],
            'is_active': True
        })
    
    return jsonify({
        'success': True,
        'data': serialize_document(departments)
    }), 200

@departments_bp.route('/', methods=['POST'])
@admin_required
def create_department():
    """Create a new department (admin only)."""
    data = request.get_json()
    
    # Validate required fields
    if not data.get('name'):
        return jsonify({'success': False, 'message': 'Department name is required'}), 400
    
    # Check if department name already exists
    if mongo.db.departments.find_one({'name': data['name']}):
        return jsonify({'success': False, 'message': 'Department with this name already exists'}), 409
    
    # Generate department code
    code = data.get('code', data['name'][:3].upper())
    if mongo.db.departments.find_one({'code': code}):
        return jsonify({'success': False, 'message': 'Department code already exists'}), 409
    
    department = {
        '_id': generate_unique_id(),
        'name': data['name'],
        'code': code,
        'description': data.get('description', ''),
        'color': data.get('color', '#607D8B'),
        'icon': data.get('icon', 'business'),
        'is_active': True,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }
    
    mongo.db.departments.insert_one(department)
    
    return jsonify({
        'success': True,
        'message': 'Department created successfully',
        'data': serialize_document(department)
    }), 201

@departments_bp.route('/<department_id>', methods=['GET'])
@jwt_required()
def get_department(department_id):
    """Get a specific department by ID."""
    department = mongo.db.departments.find_one({'_id': department_id})
    
    if not department:
        return jsonify({'success': False, 'message': 'Department not found'}), 404
    
    # Get team leader and member counts
    department['team_leader_count'] = mongo.db.users.count_documents({
        'department_id': department_id,
        'role': 'team_leader',
        'is_active': True
    })
    department['member_count'] = mongo.db.users.count_documents({
        'department_id': department_id,
        'is_active': True
    })
    
    # Get team leaders
    department['team_leaders'] = list(mongo.db.users.find({
        'department_id': department_id,
        'role': 'team_leader',
        'is_active': True
    }, {'password': 0}))
    
    return jsonify({
        'success': True,
        'data': serialize_document(department)
    }), 200

@departments_bp.route('/<department_id>', methods=['PUT'])
@admin_required
def update_department(department_id):
    """Update a department (admin only)."""
    department = mongo.db.departments.find_one({'_id': department_id})
    
    if not department:
        return jsonify({'success': False, 'message': 'Department not found'}), 404
    
    data = request.get_json()
    
    # Fields that can be updated
    allowed_fields = ['name', 'description', 'color', 'icon']
    
    update_data = {}
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]
    
    # Check for duplicate name
    if 'name' in update_data:
        existing = mongo.db.departments.find_one({
            'name': update_data['name'],
            '_id': {'$ne': department_id}
        })
        if existing:
            return jsonify({'success': False, 'message': 'Department name already exists'}), 409
    
    update_data['updated_at'] = datetime.utcnow()
    
    mongo.db.departments.update_one(
        {'_id': department_id},
        {'$set': update_data}
    )
    
    updated_department = mongo.db.departments.find_one({'_id': department_id})
    
    return jsonify({
        'success': True,
        'message': 'Department updated successfully',
        'data': serialize_document(updated_department)
    }), 200

@departments_bp.route('/<department_id>', methods=['DELETE'])
@admin_required
def delete_department(department_id):
    """Delete/deactivate a department (admin only)."""
    department = mongo.db.departments.find_one({'_id': department_id})
    
    if not department:
        return jsonify({'success': False, 'message': 'Department not found'}), 404
    
    # Check if department has active users
    user_count = mongo.db.users.count_documents({
        'department_id': department_id,
        'is_active': True
    })
    
    if user_count > 0:
        return jsonify({
            'success': False, 
            'message': f'Cannot delete department with {user_count} active users. Please reassign users first.'
        }), 400
    
    # Soft delete - deactivate
    mongo.db.departments.update_one(
        {'_id': department_id},
        {
            '$set': {
                'is_active': False,
                'updated_at': datetime.utcnow()
            }
        }
    )
    
    return jsonify({
        'success': True,
        'message': 'Department deactivated successfully'
    }), 200

@departments_bp.route('/<department_id>/activate', methods=['POST'])
@admin_required
def activate_department(department_id):
    """Activate a deactivated department (admin only)."""
    department = mongo.db.departments.find_one({'_id': department_id})
    
    if not department:
        return jsonify({'success': False, 'message': 'Department not found'}), 404
    
    mongo.db.departments.update_one(
        {'_id': department_id},
        {
            '$set': {
                'is_active': True,
                'updated_at': datetime.utcnow()
            }
        }
    )
    
    return jsonify({
        'success': True,
        'message': 'Department activated successfully'
    }), 200

@departments_bp.route('/<department_id>/services', methods=['POST'])
@admin_required
def add_department_service(department_id):
    """Add a new service/package to a department (admin only)."""
    department = mongo.db.departments.find_one({'_id': department_id})
    
    if not department:
        return jsonify({'success': False, 'message': 'Department not found'}), 404
    
    data = request.get_json()
    
    # Validate required fields
    if not data.get('name'):
        return jsonify({'success': False, 'message': 'Service name is required'}), 400
    if not data.get('price'):
        return jsonify({'success': False, 'message': 'Service price is required'}), 400
    if not data.get('duration_days'):
        return jsonify({'success': False, 'message': 'Duration is required'}), 400
    
    service = {
        '_id': generate_unique_id(),
        'name': data['name'],
        'description': data.get('description', ''),
        'price': float(data['price']),
        'duration_days': int(data['duration_days']),
        'features': data.get('features', []),
        'department_id': department_id,
        'is_active': data.get('is_active', True),
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }
    
    mongo.db.services.insert_one(service)
    
    return jsonify({
        'success': True,
        'message': 'Service added successfully',
        'data': serialize_document(service)
    }), 201

@departments_bp.route('/<department_id>/services', methods=['GET'])
def get_department_services(department_id):
    """Get all services/packages for a department."""
    department = mongo.db.departments.find_one({'_id': department_id})
    
    if not department:
        return jsonify({'success': False, 'message': 'Department not found'}), 404
    
    include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'
    
    query = {'department_id': department_id}
    if not include_inactive:
        query['is_active'] = True
    
    services = list(mongo.db.services.find(query).sort('price', 1))
    
    return jsonify({
        'success': True,
        'data': serialize_document(services)
    }), 200

@departments_bp.route('/services/<service_id>', methods=['PUT'])
@admin_required
def update_service(service_id):
    """Update a service/package (admin only)."""
    service = mongo.db.services.find_one({'_id': service_id})
    
    if not service:
        return jsonify({'success': False, 'message': 'Service not found'}), 404
    
    data = request.get_json()
    
    # Fields that can be updated
    allowed_fields = ['name', 'description', 'price', 'duration_days', 'features', 'is_active']
    
    update_data = {}
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]
    
    update_data['updated_at'] = datetime.utcnow()
    
    mongo.db.services.update_one(
        {'_id': service_id},
        {'$set': update_data}
    )
    
    updated_service = mongo.db.services.find_one({'_id': service_id})
    
    return jsonify({
        'success': True,
        'message': 'Service updated successfully',
        'data': serialize_document(updated_service)
    }), 200

@departments_bp.route('/services/<service_id>', methods=['DELETE'])
@admin_required
def delete_service(service_id):
    """Delete/deactivate a service/package (admin only)."""
    service = mongo.db.services.find_one({'_id': service_id})
    
    if not service:
        return jsonify({'success': False, 'message': 'Service not found'}), 404
    
    # Soft delete - deactivate
    mongo.db.services.update_one(
        {'_id': service_id},
        {
            '$set': {
                'is_active': False,
                'updated_at': datetime.utcnow()
            }
        }
    )
    
    return jsonify({
        'success': True,
        'message': 'Service deactivated successfully'
    }), 200

@departments_bp.route('/<department_id>/members', methods=['GET'])
@jwt_required()
def get_department_members(department_id):
    """Get all members of a department."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    # Check permissions
    if current_user.get('role') not in ['admin', 'team_leader']:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    if current_user.get('role') == 'team_leader' and current_user.get('department_id') != department_id:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    # Get query parameters
    role = request.args.get('role')
    
    query = {
        'department_id': department_id,
        'is_active': True
    }
    
    if role:
        query['role'] = role
    
    members = list(mongo.db.users.find(query, {'password': 0}).sort('first_name', 1))
    
    return jsonify({
        'success': True,
        'data': serialize_document(members)
    }), 200

@departments_bp.route('/<department_id>/stats', methods=['GET'])
@jwt_required()
def get_department_stats(department_id):
    """Get department statistics."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    # Check permissions
    if current_user.get('role') not in ['admin', 'team_leader']:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    if current_user.get('role') == 'team_leader' and current_user.get('department_id') != department_id:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    department = mongo.db.departments.find_one({'_id': department_id})
    if not department:
        return jsonify({'success': False, 'message': 'Department not found'}), 404
    
    # Get member statistics
    total_members = mongo.db.users.count_documents({
        'department_id': department_id,
        'is_active': True
    })
    
    team_leaders = mongo.db.users.count_documents({
        'department_id': department_id,
        'role': 'team_leader',
        'is_active': True
    })
    
    team_members = mongo.db.users.count_documents({
        'department_id': department_id,
        'role': 'team_member',
        'is_active': True
    })
    
    # Get project statistics
    total_projects = mongo.db.projects.count_documents({
        'department_id': department_id
    })
    
    active_projects = mongo.db.projects.count_documents({
        'department_id': department_id,
        'status': 'active'
    })
    
    completed_projects = mongo.db.projects.count_documents({
        'department_id': department_id,
        'status': 'completed'
    })
    
    # Get task statistics
    total_tasks = mongo.db.tasks.count_documents({
        'department_id': department_id
    })
    
    pending_tasks = mongo.db.tasks.count_documents({
        'department_id': department_id,
        'status': 'pending'
    })
    
    in_progress_tasks = mongo.db.tasks.count_documents({
        'department_id': department_id,
        'status': 'in_progress'
    })
    
    completed_tasks = mongo.db.tasks.count_documents({
        'department_id': department_id,
        'status': 'completed'
    })
    
    return jsonify({
        'success': True,
        'data': {
            'department': serialize_document(department),
            'members': {
                'total': total_members,
                'team_leaders': team_leaders,
                'team_members': team_members
            },
            'projects': {
                'total': total_projects,
                'active': active_projects,
                'completed': completed_projects
            },
            'tasks': {
                'total': total_tasks,
                'pending': pending_tasks,
                'in_progress': in_progress_tasks,
                'completed': completed_tasks
            }
        }
    }), 200
