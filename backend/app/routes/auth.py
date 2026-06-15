from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from datetime import datetime
from app import mongo
from app.utils.helpers import hash_password, verify_password, generate_unique_id, serialize_document

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'], strict_slashes=False)
def register():
    """Register a new user."""
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['email', 'password', 'first_name', 'last_name', 'role']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'success': False, 'message': f'{field} is required'}), 400
    
    # Check if user already exists
    if mongo.db.users.find_one({'email': data['email'].lower()}):
        return jsonify({'success': False, 'message': 'Email already registered'}), 409
    
    # Validate role
    valid_roles = ['admin', 'team_leader', 'team_member', 'client']
    if data['role'] not in valid_roles:
        return jsonify({'success': False, 'message': f"Invalid role. Must be one of: {', '.join(valid_roles)}"}), 400
    
    # Create user document
    user_id = generate_unique_id()
    new_user = {
        '_id': user_id,
        'email': data['email'].lower(),
        'password': hash_password(data['password']),
        'first_name': data['first_name'],
        'last_name': data['last_name'],
        'role': data['role'],
        'phone': data.get('phone', ''),
        'department_id': data.get('department_id'),
        'is_active': True,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'last_login': None,
        'profile_image': None,
        'address': data.get('address', ''),
        'city': data.get('city', ''),
        'country': data.get('country', ''),
        'skills': data.get('skills', []),
        'bio': data.get('bio', '')
    }
    
    # Add role-specific fields
    if data['role'] == 'client':
        new_user['company_name'] = data.get('company_name', '')
        new_user['projects'] = []
    
    # Insert user into database
    mongo.db.users.insert_one(new_user)
    
    # Create access token
    access_token = create_access_token(identity=user_id)
    refresh_token = create_refresh_token(identity=user_id)
    
    # Remove password from response
    new_user.pop('password', None)
    
    return jsonify({
        'success': True,
        'message': 'User registered successfully',
        'data': {
            'user': serialize_document(new_user),
            'access_token': access_token,
            'refresh_token': refresh_token
        }
    }), 201

@auth_bp.route('/login', methods=['POST'], strict_slashes=False)
def login():
    """Authenticate user and return tokens."""
    data = request.get_json()
    
    # Validate input
    if not data.get('email') or not data.get('password'):
        return jsonify({'success': False, 'message': 'Email and password are required'}), 400
    
    # Find user by email
    user = mongo.db.users.find_one({'email': data['email'].lower()})
    
    if not user:
        return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
    
    # Check if user is active
    if not user.get('is_active', True):
        return jsonify({'success': False, 'message': 'Account is deactivated'}), 403
    
    # Verify password
    if not verify_password(data['password'], user['password']):
        return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
    
    # Update last login
    mongo.db.users.update_one(
        {'_id': user['_id']},
        {'$set': {'last_login': datetime.utcnow()}}
    )
    
    # Create tokens
    access_token = create_access_token(identity=str(user['_id']))
    refresh_token = create_refresh_token(identity=str(user['_id']))
    
    # Remove password from user data
    user.pop('password', None)
    
    return jsonify({
        'success': True,
        'message': 'Login successful',
        'data': {
            'user': serialize_document(user),
            'access_token': access_token,
            'refresh_token': refresh_token
        }
    }), 200

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token."""
    current_user_id = get_jwt_identity()
    new_token = create_access_token(identity=current_user_id)
    
    return jsonify({
        'success': True,
        'data': {
            'access_token': new_token
        }
    }), 200

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get current authenticated user."""
    current_user_id = get_jwt_identity()
    user = mongo.db.users.find_one({'_id': current_user_id})
    
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    
    user.pop('password', None)
    
    # Add department name if department_id exists
    if user.get('department_id'):
        dept = mongo.db.departments.find_one(
            {'_id': user['department_id']},
            {'name': 1}
        )
        user['department_name'] = dept['name'] if dept else 'Unknown'
    
    return jsonify({
        'success': True,
        'data': serialize_document(user)
    }), 200

@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """Change user password."""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data.get('current_password') or not data.get('new_password'):
        return jsonify({'success': False, 'message': 'Current password and new password are required'}), 400
    
    user = mongo.db.users.find_one({'_id': current_user_id})
    
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    
    # Verify current password
    if not verify_password(data['current_password'], user['password']):
        return jsonify({'success': False, 'message': 'Current password is incorrect'}), 401
    
    # Update password
    mongo.db.users.update_one(
        {'_id': current_user_id},
        {
            '$set': {
                'password': hash_password(data['new_password']),
                'updated_at': datetime.utcnow()
            }
        }
    )
    
    return jsonify({
        'success': True,
        'message': 'Password changed successfully'
    }), 200

@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """Logout user (client-side token removal)."""
    return jsonify({
        'success': True,
        'message': 'Logged out successfully'
    }), 200
