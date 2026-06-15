from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from bson import ObjectId
from app import mongo
from app.utils.decorators import admin_required, team_leader_required
from app.utils.helpers import hash_password, serialize_document, paginate_results

users_bp = Blueprint('users', __name__)

@users_bp.route('/', methods=['GET'])
@jwt_required()
def get_users():
    """Get all users with pagination and filtering."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    # Get query parameters
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    role = request.args.get('role')
    department_id = request.args.get('department_id')
    is_active = request.args.get('is_active')
    search = request.args.get('search')
    
    # Build query
    query = {}
    
    # Non-admin users can only see users in their department
    if current_user.get('role') != 'admin':
        if current_user.get('role') == 'team_leader':
            query['department_id'] = current_user.get('department_id')
        elif current_user.get('role') == 'client':
            # Clients can only see team members assigned to their projects
            return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    if role:
        query['role'] = role
    if department_id and current_user.get('role') == 'admin':
        query['department_id'] = department_id
    if is_active is not None:
        query['is_active'] = is_active.lower() == 'true'
    if search:
        query['$or'] = [
            {'first_name': {'$regex': search, '$options': 'i'}},
            {'last_name': {'$regex': search, '$options': 'i'}},
            {'email': {'$regex': search, '$options': 'i'}}
        ]
    
    # Execute query with pagination
    users_cursor = mongo.db.users.find(query).sort('created_at', -1)
    result = paginate_results(users_cursor, page, per_page)
    
    # Remove passwords from results and enrich with department info
    for user in result['items']:
        user.pop('password', None)
        # Add department name for users with department_id
        if user.get('department_id'):
            dept = mongo.db.departments.find_one(
                {'_id': user['department_id']},
                {'name': 1}
            )
            user['department_name'] = dept['name'] if dept else 'Unknown'
    
    return jsonify({
        'success': True,
        'data': {
            'users': serialize_document(result['items']),
            'pagination': {
                'total': result['total'],
                'page': result['page'],
                'per_page': result['per_page'],
                'total_pages': result['total_pages']
            }
        }
    }), 200

@users_bp.route('/<user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    """Get a specific user by ID."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    user = mongo.db.users.find_one({'_id': user_id})
    
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    
    # Check permissions
    if current_user.get('role') != 'admin':
        if current_user.get('role') == 'team_leader':
            if user.get('department_id') != current_user.get('department_id'):
                return jsonify({'success': False, 'message': 'Access denied'}), 403
        elif current_user_id != user_id:
            return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    user.pop('password', None)
    
    return jsonify({
        'success': True,
        'data': serialize_document(user)
    }), 200

@users_bp.route('/<user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    """Update user information."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    # Check permissions
    if current_user.get('role') != 'admin' and current_user_id != user_id:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    user = mongo.db.users.find_one({'_id': user_id})
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    
    data = request.get_json()
    
    # Fields that can be updated
    allowed_fields = [
        'first_name', 'last_name', 'phone', 'address', 'city', 
        'country', 'bio', 'skills', 'profile_image'
    ]
    
    # Admin can update additional fields
    if current_user.get('role') == 'admin':
        allowed_fields.extend(['role', 'department_id', 'is_active', 'company_name'])
    
    update_data = {}
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]
    
    update_data['updated_at'] = datetime.utcnow()
    
    mongo.db.users.update_one(
        {'_id': user_id},
        {'$set': update_data}
    )
    
    # Get updated user
    updated_user = mongo.db.users.find_one({'_id': user_id})
    updated_user.pop('password', None)
    
    return jsonify({
        'success': True,
        'message': 'User updated successfully',
        'data': serialize_document(updated_user)
    }), 200

@users_bp.route('/<user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    """Delete a user (admin only)."""
    user = mongo.db.users.find_one({'_id': user_id})
    
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    
    # Prevent deleting the last admin
    if user.get('role') == 'admin':
        admin_count = mongo.db.users.count_documents({'role': 'admin', 'is_active': True})
        if admin_count <= 1:
            return jsonify({'success': False, 'message': 'Cannot delete the last admin'}), 400
    
    # Soft delete - deactivate user
    mongo.db.users.update_one(
        {'_id': user_id},
        {
            '$set': {
                'is_active': False,
                'updated_at': datetime.utcnow()
            }
        }
    )
    
    return jsonify({
        'success': True,
        'message': 'User deactivated successfully'
    }), 200

@users_bp.route('/<user_id>/activate', methods=['POST'])
@admin_required
def activate_user(user_id):
    """Activate a deactivated user (admin only)."""
    user = mongo.db.users.find_one({'_id': user_id})
    
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    
    mongo.db.users.update_one(
        {'_id': user_id},
        {
            '$set': {
                'is_active': True,
                'updated_at': datetime.utcnow()
            }
        }
    )
    
    return jsonify({
        'success': True,
        'message': 'User activated successfully'
    }), 200

@users_bp.route('/by-department/<department_id>', methods=['GET'])
@jwt_required()
def get_users_by_department(department_id):
    """Get all users in a specific department."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    # Check permissions
    if current_user.get('role') not in ['admin', 'team_leader']:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    if current_user.get('role') == 'team_leader' and current_user.get('department_id') != department_id:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    users = list(mongo.db.users.find({
        'department_id': department_id,
        'is_active': True
    }))
    
    for user in users:
        user.pop('password', None)
    
    return jsonify({
        'success': True,
        'data': serialize_document(users)
    }), 200

@users_bp.route('/roles', methods=['GET'])
@jwt_required()
def get_roles():
    """Get all available user roles."""
    roles = [
        {'id': 'admin', 'name': 'Administrator', 'description': 'Full system access'},
        {'id': 'team_leader', 'name': 'Team Leader', 'description': 'Department management access'},
        {'id': 'team_member', 'name': 'Team Member', 'description': 'Task and project access'},
        {'id': 'client', 'name': 'Client', 'description': 'Project viewing access'}
    ]
    
    return jsonify({
        'success': True,
        'data': roles
    }), 200

@users_bp.route('/stats', methods=['GET'])
@admin_required
def get_user_stats():
    """Get user statistics (admin only)."""
    total_users = mongo.db.users.count_documents({})
    active_users = mongo.db.users.count_documents({'is_active': True})
    inactive_users = mongo.db.users.count_documents({'is_active': False})
    
    role_distribution = list(mongo.db.users.aggregate([
        {'$group': {'_id': '$role', 'count': {'$sum': 1}}}
    ]))
    
    recent_users = list(mongo.db.users.find().sort('created_at', -1).limit(5))
    for user in recent_users:
        user.pop('password', None)
    
    return jsonify({
        'success': True,
        'data': {
            'total_users': total_users,
            'active_users': active_users,
            'inactive_users': inactive_users,
            'role_distribution': role_distribution,
            'recent_users': serialize_document(recent_users)
        }
    }), 200
