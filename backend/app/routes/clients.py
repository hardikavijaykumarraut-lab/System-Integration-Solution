from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app import mongo
from app.utils.decorators import admin_required
from app.utils.helpers import generate_unique_id, serialize_document, paginate_results

clients_bp = Blueprint('clients', __name__)

@clients_bp.route('/', methods=['GET'])
@jwt_required()
def get_clients():
    """Get all clients with filtering and pagination."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    # Only admin and team leaders can view all clients
    if current_user.get('role') not in ['admin', 'team_leader']:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    search = request.args.get('search')
    
    query = {'role': 'client'}
    
    if search:
        query['$or'] = [
            {'first_name': {'$regex': search, '$options': 'i'}},
            {'last_name': {'$regex': search, '$options': 'i'}},
            {'email': {'$regex': search, '$options': 'i'}},
            {'company_name': {'$regex': search, '$options': 'i'}}
        ]
    
    clients_cursor = mongo.db.users.find(query).sort('created_at', -1)
    result = paginate_results(clients_cursor, page, per_page)
    
    # Remove passwords and enrich data
    for client in result['items']:
        client.pop('password', None)
        
        # Get project count
        client['project_count'] = mongo.db.projects.count_documents({
            'client_id': client['_id']
        })
        
        # Get active project count
        client['active_project_count'] = mongo.db.projects.count_documents({
            'client_id': client['_id'],
            'status': 'active'
        })
    
    return jsonify({
        'success': True,
        'data': {
            'clients': serialize_document(result['items']),
            'pagination': {
                'total': result['total'],
                'page': result['page'],
                'per_page': result['per_page'],
                'total_pages': result['total_pages']
            }
        }
    }), 200

@clients_bp.route('/<client_id>', methods=['GET'])
@jwt_required()
def get_client(client_id):
    """Get a specific client by ID."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    client = mongo.db.users.find_one({'_id': client_id, 'role': 'client'})
    
    if not client:
        return jsonify({'success': False, 'message': 'Client not found'}), 404
    
    # Check permissions
    if current_user.get('role') == 'admin':
        pass
    elif current_user.get('role') == 'client' and current_user_id != client_id:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    client.pop('password', None)
    
    # Get client's projects
    projects = list(mongo.db.projects.find({'client_id': client_id}))
    
    # Get project statistics
    for project in projects:
        project['task_stats'] = {
            'total': mongo.db.tasks.count_documents({'project_id': project['_id']}),
            'completed': mongo.db.tasks.count_documents({
                'project_id': project['_id'],
                'status': 'completed'
            })
        }
    
    client['projects'] = projects
    
    # Get total spent
    transactions = list(mongo.db.transactions.find({
        'client_id': client_id,
        'type': 'expense'
    }))
    client['total_spent'] = sum(t['amount'] for t in transactions)
    
    return jsonify({
        'success': True,
        'data': serialize_document(client)
    }), 200

@clients_bp.route('/<client_id>/projects', methods=['GET'])
@jwt_required()
def get_client_projects(client_id):
    """Get all projects for a specific client."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    # Check permissions
    if current_user.get('role') == 'admin':
        pass
    elif current_user.get('role') == 'client' and current_user_id != client_id:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    else:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    projects = list(mongo.db.projects.find({'client_id': client_id}).sort('created_at', -1))
    
    # Enrich projects
    for project in projects:
        # Get department info
        if project.get('department_id'):
            dept = mongo.db.departments.find_one({'_id': project['department_id']},
                {'name': 1, 'code': 1})
            project['department'] = serialize_document(dept)
        
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
        'data': serialize_document(projects)
    }), 200

@clients_bp.route('/<client_id>/transactions', methods=['GET'])
@jwt_required()
def get_client_transactions(client_id):
    """Get all transactions for a specific client."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    # Check permissions
    if current_user.get('role') == 'admin':
        pass
    elif current_user.get('role') == 'client' and current_user_id != client_id:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    else:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    transactions = list(mongo.db.transactions.find(
        {'client_id': client_id}
    ).sort('date', -1))
    
    # Enrich transactions with project info
    for transaction in transactions:
        if transaction.get('project_id'):
            project = mongo.db.projects.find_one({'_id': transaction['project_id']},
                {'name': 1, 'code': 1})
            transaction['project'] = serialize_document(project)
    
    return jsonify({
        'success': True,
        'data': serialize_document(transactions)
    }), 200

@clients_bp.route('/stats', methods=['GET'])
@admin_required
def get_client_stats():
    """Get client statistics (admin only)."""
    total_clients = mongo.db.users.count_documents({'role': 'client'})
    active_clients = mongo.db.users.count_documents({'role': 'client', 'is_active': True})
    
    # Get top clients by project count
    top_clients = list(mongo.db.projects.aggregate([
        {'$group': {
            '_id': '$client_id',
            'project_count': {'$sum': 1}
        }},
        {'$sort': {'project_count': -1}},
        {'$limit': 10}
    ]))
    
    # Enrich with client info
    for client in top_clients:
        client_info = mongo.db.users.find_one({'_id': client['_id']},
            {'first_name': 1, 'last_name': 1, 'email': 1, 'company_name': 1})
        client['client'] = serialize_document(client_info)
    
    # Get client acquisition trend (last 6 months)
    six_months_ago = (datetime.utcnow() - datetime.timedelta(days=180)).isoformat()
    
    acquisition_trend = list(mongo.db.users.aggregate([
        {'$match': {'role': 'client', 'created_at': {'$gte': six_months_ago}}},
        {'$group': {
            '_id': {
                'year': {'$year': {'$dateFromString': {'dateString': '$created_at'}}},
                'month': {'$month': {'$dateFromString': {'dateString': '$created_at'}}}
            },
            'count': {'$sum': 1}
        }},
        {'$sort': {'_id.year': 1, '_id.month': 1}}
    ]))
    
    return jsonify({
        'success': True,
        'data': {
            'total_clients': total_clients,
            'active_clients': active_clients,
            'top_clients': top_clients,
            'acquisition_trend': acquisition_trend
        }
    }), 200


@clients_bp.route('/profile-status', methods=['GET'])
@jwt_required()
def check_profile_status():
    """Check if the current client's profile is complete."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    if not current_user or current_user.get('role') != 'client':
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    # Check if profile is complete
    profile_completed = current_user.get('profile_completed', False)
    
    # Also check if essential fields are filled
    required_fields = ['client_id', 'phone', 'company_name', 'address']
    has_required_fields = all(
        current_user.get(field) for field in required_fields
    )
    
    is_complete = profile_completed and has_required_fields
    
    return jsonify({
        'success': True,
        'data': {
            'profile_completed': is_complete,
            'missing_fields': [
                field for field in required_fields 
                if not current_user.get(field)
            ] if not is_complete else []
        }
    }), 200


@clients_bp.route('/<client_id>/profile', methods=['PUT'])
@jwt_required()
def update_client_profile(client_id):
    """Update client profile information."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    # Check permissions - only the client themselves can update their profile
    if current_user.get('role') != 'admin' and current_user_id != client_id:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    # Check if client exists
    client = mongo.db.users.find_one({'_id': client_id, 'role': 'client'})
    if not client:
        return jsonify({'success': False, 'message': 'Client not found'}), 404
    
    data = request.get_json()
    
    # Fields that can be updated
    allowed_fields = [
        'client_id', 'first_name', 'last_name', 'phone', 
        'company_name', 'address', 'city', 'country', 
        'profile_image', 'profile_completed'
    ]
    
    update_data = {}
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]
    
    # Add timestamps
    update_data['updated_at'] = datetime.utcnow()
    
    # Check if client_id is unique (if being updated)
    if 'client_id' in update_data and update_data['client_id'] != client.get('client_id'):
        existing = mongo.db.users.find_one({
            'client_id': update_data['client_id'],
            '_id': {'$ne': client_id}
        })
        if existing:
            return jsonify({
                'success': False, 
                'message': 'Client ID already exists'
            }), 409
    
    # Update the client
    mongo.db.users.update_one(
        {'_id': client_id},
        {'$set': update_data}
    )
    
    # Get updated client data
    updated_client = mongo.db.users.find_one({'_id': client_id})
    updated_client.pop('password', None)
    
    return jsonify({
        'success': True,
        'message': 'Profile updated successfully',
        'data': serialize_document(updated_client)
    }), 200
