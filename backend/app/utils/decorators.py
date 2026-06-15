from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from app import mongo

def admin_required(fn):
    """Decorator to restrict access to admin users only."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        current_user_id = get_jwt_identity()
        user = mongo.db.users.find_one({'_id': current_user_id})
        
        if not user or user.get('role') != 'admin':
            return jsonify({'success': False, 'message': 'Admin access required'}), 403
        
        return fn(*args, **kwargs)
    return wrapper

def team_leader_required(fn):
    """Decorator to restrict access to team leaders and admins."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        current_user_id = get_jwt_identity()
        user = mongo.db.users.find_one({'_id': current_user_id})
        
        if not user or user.get('role') not in ['admin', 'team_leader']:
            return jsonify({'success': False, 'message': 'Team leader access required'}), 403
        
        return fn(*args, **kwargs)
    return wrapper

def client_required(fn):
    """Decorator to restrict access to clients and above."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        current_user_id = get_jwt_identity()
        user = mongo.db.users.find_one({'_id': current_user_id})
        
        if not user or user.get('role') not in ['admin', 'client']:
            return jsonify({'success': False, 'message': 'Client access required'}), 403
        
        return fn(*args, **kwargs)
    return wrapper

def team_member_required(fn):
    """Decorator to restrict access to team members and above."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        current_user_id = get_jwt_identity()
        user = mongo.db.users.find_one({'_id': current_user_id})
        
        if not user or user.get('role') not in ['admin', 'team_leader', 'team_member']:
            return jsonify({'success': False, 'message': 'Team member access required'}), 403
        
        return fn(*args, **kwargs)
    return wrapper

def department_access_required(department_id_param='department_id'):
    """Decorator to check if user has access to a specific department."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            current_user_id = get_jwt_identity()
            user = mongo.db.users.find_one({'_id': current_user_id})
            
            if not user:
                return jsonify({'success': False, 'message': 'User not found'}), 404
            
            # Admin has access to all departments
            if user.get('role') == 'admin':
                return fn(*args, **kwargs)
            
            # Get department ID from kwargs or request
            dept_id = kwargs.get(department_id_param) or user.get('department_id')
            
            # Check if user belongs to the department
            if user.get('department_id') != dept_id:
                return jsonify({'success': False, 'message': 'Department access denied'}), 403
            
            return fn(*args, **kwargs)
        return wrapper
    return decorator
