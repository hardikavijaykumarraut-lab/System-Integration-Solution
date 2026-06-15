from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_socketio import emit, join_room, leave_room
from datetime import datetime
from app import mongo, socketio
from app.utils.helpers import generate_unique_id, serialize_document

chat_bp = Blueprint('chat', __name__)

# Socket.IO event handlers
@socketio.on('connect')
def handle_connect():
    """Handle client connection."""
    print('Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection."""
    print('Client disconnected')

@socketio.on('join')
def handle_join(data):
    """Join a chat room."""
    room = data.get('room')
    if room:
        join_room(room)
        emit('joined', {'room': room, 'message': f'Joined room: {room}'}, room=request.sid)

@socketio.on('leave')
def handle_leave(data):
    """Leave a chat room."""
    room = data.get('room')
    if room:
        leave_room(room)
        emit('left', {'room': room, 'message': f'Left room: {room}'}, room=request.sid)

@socketio.on('send_message')
def handle_send_message(data):
    """Handle sending a message via WebSocket."""
    room = data.get('room')
    message_content = data.get('message')
    sender_id = data.get('sender_id')
    
    if not all([room, message_content, sender_id]):
        emit('error', {'message': 'Missing required fields'}, room=request.sid)
        return
    
    # Save message to database
    message = {
        '_id': generate_unique_id(),
        'room': room,
        'content': message_content,
        'sender_id': sender_id,
        'type': data.get('type', 'text'),
        'attachments': data.get('attachments', []),
        'created_at': datetime.utcnow(),
        'read_by': [sender_id]
    }
    
    mongo.db.chat_messages.insert_one(message)
    
    # Get sender info
    sender = mongo.db.users.find_one({'_id': sender_id}, 
        {'first_name': 1, 'last_name': 1, 'profile_image': 1})
    
    message_data = serialize_document(message)
    message_data['sender'] = serialize_document(sender)
    
    # Broadcast to room
    emit('new_message', message_data, room=room, broadcast=True)

@socketio.on('typing')
def handle_typing(data):
    """Handle typing indicator."""
    room = data.get('room')
    user_id = data.get('user_id')
    is_typing = data.get('is_typing', False)
    
    if room and user_id:
        user = mongo.db.users.find_one({'_id': user_id}, 
            {'first_name': 1, 'last_name': 1})
        emit('user_typing', {
            'user_id': user_id,
            'user_name': f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
            'is_typing': is_typing
        }, room=room, broadcast=True, include_self=False)

# REST API endpoints
@chat_bp.route('/conversations', methods=['GET'])
@jwt_required()
def get_conversations():
    """Get all conversations for the current user."""
    current_user_id = get_jwt_identity()
    
    # Get all rooms where user is a participant
    conversations = list(mongo.db.conversations.find({
        'participants': current_user_id
    }).sort('last_message_at', -1))
    
    # Enrich conversation data
    for conv in conversations:
        # Get other participants
        other_participants = [p for p in conv['participants'] if p != current_user_id]
        participants_data = list(mongo.db.users.find(
            {'_id': {'$in': other_participants}},
            {'first_name': 1, 'last_name': 1, 'email': 1, 'profile_image': 1, 'role': 1}
        ))
        conv['participants_data'] = serialize_document(participants_data)
        
        # Get unread count
        conv['unread_count'] = mongo.db.chat_messages.count_documents({
            'room': conv['room_id'],
            'sender_id': {'$ne': current_user_id},
            'read_by': {'$ne': current_user_id}
        })
        
        # Get last message
        last_message = mongo.db.chat_messages.find_one(
            {'room': conv['room_id']},
            sort=[('created_at', -1)]
        )
        conv['last_message'] = serialize_document(last_message)
    
    return jsonify({
        'success': True,
        'data': serialize_document(conversations)
    }), 200

@chat_bp.route('/conversations', methods=['POST'])
@jwt_required()
def create_conversation():
    """Create a new conversation."""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    participant_ids = data.get('participants', [])
    conversation_type = data.get('type', 'direct')  # direct or group
    name = data.get('name', '')
    
    if not participant_ids:
        return jsonify({'success': False, 'message': 'Participants are required'}), 400
    
    # Add current user to participants
    if current_user_id not in participant_ids:
        participant_ids.append(current_user_id)
    
    # For direct conversations, check if one already exists
    if conversation_type == 'direct' and len(participant_ids) == 2:
        existing = mongo.db.conversations.find_one({
            'type': 'direct',
            'participants': {'$all': participant_ids, '$size': 2}
        })
        if existing:
            return jsonify({
                'success': True,
                'message': 'Conversation already exists',
                'data': serialize_document(existing)
            }), 200
    
    room_id = generate_unique_id()
    conversation = {
        '_id': room_id,
        'room_id': room_id,
        'type': conversation_type,
        'name': name,
        'participants': participant_ids,
        'created_by': current_user_id,
        'created_at': datetime.utcnow(),
        'last_message_at': datetime.utcnow()
    }
    
    mongo.db.conversations.insert_one(conversation)
    
    return jsonify({
        'success': True,
        'message': 'Conversation created successfully',
        'data': serialize_document(conversation)
    }), 201

@chat_bp.route('/messages/<room_id>', methods=['GET'])
@jwt_required()
def get_messages(room_id):
    """Get messages for a specific room."""
    current_user_id = get_jwt_identity()
    
    # Verify user is part of the conversation
    conversation = mongo.db.conversations.find_one({
        'room_id': room_id,
        'participants': current_user_id
    })
    
    if not conversation:
        return jsonify({'success': False, 'message': 'Access denied or conversation not found'}), 403
    
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 50))
    
    skip = (page - 1) * per_page
    
    messages = list(mongo.db.chat_messages.find(
        {'room': room_id}
    ).sort('created_at', -1).skip(skip).limit(per_page))
    
    # Enrich messages with sender info
    for message in messages:
        sender = mongo.db.users.find_one({'_id': message['sender_id']},
            {'first_name': 1, 'last_name': 1, 'profile_image': 1})
        message['sender'] = serialize_document(sender)
    
    # Mark messages as read
    mongo.db.chat_messages.update_many(
        {
            'room': room_id,
            'sender_id': {'$ne': current_user_id},
            'read_by': {'$ne': current_user_id}
        },
        {'$addToSet': {'read_by': current_user_id}}
    )
    
    return jsonify({
        'success': True,
        'data': serialize_document(messages[::-1])  # Reverse to get chronological order
    }), 200

@chat_bp.route('/messages', methods=['POST'])
@jwt_required()
def send_message():
    """Send a message via REST API."""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    room_id = data.get('room_id')
    content = data.get('content')
    
    if not room_id or not content:
        return jsonify({'success': False, 'message': 'room_id and content are required'}), 400
    
    # Verify user is part of the conversation
    conversation = mongo.db.conversations.find_one({
        'room_id': room_id,
        'participants': current_user_id
    })
    
    if not conversation:
        return jsonify({'success': False, 'message': 'Access denied or conversation not found'}), 403
    
    message = {
        '_id': generate_unique_id(),
        'room': room_id,
        'content': content,
        'sender_id': current_user_id,
        'type': data.get('type', 'text'),
        'attachments': data.get('attachments', []),
        'created_at': datetime.utcnow(),
        'read_by': [current_user_id]
    }
    
    mongo.db.chat_messages.insert_one(message)
    
    # Update conversation last message time
    mongo.db.conversations.update_one(
        {'room_id': room_id},
        {'$set': {'last_message_at': datetime.utcnow()}}
    )
    
    # Get sender info
    sender = mongo.db.users.find_one({'_id': current_user_id},
        {'first_name': 1, 'last_name': 1, 'profile_image': 1})
    
    message_data = serialize_document(message)
    message_data['sender'] = serialize_document(sender)
    
    # Emit via Socket.IO
    socketio.emit('new_message', message_data, room=room_id)
    
    return jsonify({
        'success': True,
        'message': 'Message sent successfully',
        'data': message_data
    }), 201

@chat_bp.route('/messages/<message_id>/read', methods=['POST'])
@jwt_required()
def mark_message_read(message_id):
    """Mark a message as read."""
    current_user_id = get_jwt_identity()
    
    message = mongo.db.chat_messages.find_one({'_id': message_id})
    
    if not message:
        return jsonify({'success': False, 'message': 'Message not found'}), 404
    
    # Verify user is part of the conversation
    conversation = mongo.db.conversations.find_one({
        'room_id': message['room'],
        'participants': current_user_id
    })
    
    if not conversation:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    mongo.db.chat_messages.update_one(
        {'_id': message_id},
        {'$addToSet': {'read_by': current_user_id}}
    )
    
    return jsonify({
        'success': True,
        'message': 'Message marked as read'
    }), 200

@chat_bp.route('/unread-count', methods=['GET'])
@jwt_required()
def get_unread_count():
    """Get total unread message count for current user."""
    current_user_id = get_jwt_identity()
    
    # Get all rooms where user is a participant
    conversations = mongo.db.conversations.find({
        'participants': current_user_id
    })
    
    room_ids = [conv['room_id'] for conv in conversations]
    
    unread_count = mongo.db.chat_messages.count_documents({
        'room': {'$in': room_ids},
        'sender_id': {'$ne': current_user_id},
        'read_by': {'$ne': current_user_id}
    })
    
    return jsonify({
        'success': True,
        'data': {'unread_count': unread_count}
    }), 200

@chat_bp.route('/users/search', methods=['GET'])
@jwt_required()
def search_users():
    """Search users to start a conversation with role-based filtering."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    query = request.args.get('q', '')
    
    if len(query) < 2:
        return jsonify({
            'success': True,
            'data': []
        }), 200
    
    search_query = {
        '_id': {'$ne': current_user_id},
        'is_active': True,
        '$or': [
            {'first_name': {'$regex': query, '$options': 'i'}},
            {'last_name': {'$regex': query, '$options': 'i'}},
            {'email': {'$regex': query, '$options': 'i'}}
        ]
    }
    
    # Role-based search filtering
    user_role = current_user.get('role')
    
    if user_role == 'client':
        # Clients can only chat with admins
        search_query['role'] = 'admin'
    elif user_role == 'team_member':
        # Team members can chat with team members and team lead in same department
        search_query['$and'] = [
            {
                '$or': [
                    {'role': 'team_member'},
                    {'role': 'team_leader'}
                ]
            },
            {'department_id': current_user.get('department_id')}
        ]
    elif user_role == 'team_leader':
        # Team leaders can chat with admin, team members in their department, and other team leads
        search_query['$or'] = [
            {'role': 'admin'},
            {
                '$and': [
                    {'role': {'$in': ['team_member', 'team_leader']}},
                    {'department_id': current_user.get('department_id')}
                ]
            }
        ]
    # Admin can search everyone (no additional filtering needed)
    
    users = list(mongo.db.users.find(search_query, {
        'first_name': 1, 'last_name': 1, 'email': 1, 
        'profile_image': 1, 'role': 1, 'department_id': 1
    }).limit(10))
    
    # Add department info
    for user in users:
        if user.get('department_id'):
            dept = mongo.db.departments.find_one({'_id': user['department_id']}, {'name': 1})
            user['department'] = dept['name'] if dept else 'Unknown'
    
    return jsonify({
        'success': True,
        'data': serialize_document(users)
    }), 200

@chat_bp.route('/conversations/validate', methods=['POST'])
@jwt_required()
def validate_conversation():
    """Validate if a conversation can be created between users based on roles."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    data = request.get_json()
    
    participant_id = data.get('participant_id')
    if not participant_id:
        return jsonify({'success': False, 'message': 'Participant ID is required'}), 400
    
    participant = mongo.db.users.find_one({'_id': participant_id})
    if not participant:
        return jsonify({'success': False, 'message': 'Participant not found'}), 404
    
    current_role = current_user.get('role')
    participant_role = participant.get('role')
    
    # Role-based conversation rules
    can_chat = False
    
    if current_role == 'client' and participant_role == 'admin':
        can_chat = True
    elif current_role == 'admin':
        # Admin can chat with anyone
        can_chat = True
    elif current_role == 'team_member':
        # Team member can chat with team members and team lead in same department
        if participant_role in ['team_member', 'team_leader']:
            if current_user.get('department_id') == participant.get('department_id'):
                can_chat = True
    elif current_role == 'team_leader':
        # Team leader can chat with admin, team members in their department, and other team leads
        if participant_role == 'admin':
            can_chat = True
        elif participant_role in ['team_member', 'team_leader']:
            if current_user.get('department_id') == participant.get('department_id'):
                can_chat = True
    
    if not can_chat:
        return jsonify({
            'success': False, 
            'message': 'You cannot start a conversation with this user based on your role permissions'
        }), 403
    
    return jsonify({
        'success': True,
        'message': 'Conversation allowed'
    }), 200

@chat_bp.route('/admin/monitor', methods=['GET'])
@jwt_required()
def admin_monitor_chats():
    """Admin can monitor all conversations."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    if current_user.get('role') != 'admin':
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    # Get all conversations
    conversations = list(mongo.db.conversations.find({}).sort('last_message_at', -1))
    
    # Enrich conversation data
    for conv in conversations:
        # Get all participants data
        participants_data = list(mongo.db.users.find(
            {'_id': {'$in': conv['participants']}},
            {'first_name': 1, 'last_name': 1, 'email': 1, 'profile_image': 1, 'role': 1}
        ))
        conv['participants_data'] = serialize_document(participants_data)
        
        # Get unread count for admin
        conv['unread_count'] = mongo.db.chat_messages.count_documents({
            'room': conv['room_id'],
            'sender_id': {'$ne': current_user_id},
            'read_by': {'$ne': current_user_id}
        })
        
        # Get last message
        last_message = mongo.db.chat_messages.find_one(
            {'room': conv['room_id']},
            sort=[('created_at', -1)]
        )
        conv['last_message'] = serialize_document(last_message)
    
    return jsonify({
        'success': True,
        'data': serialize_document(conversations)
    }), 200
