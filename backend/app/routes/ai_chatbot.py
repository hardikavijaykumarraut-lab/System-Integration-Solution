import os
import json

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import mongo
from app.utils.helpers import generate_unique_id
from datetime import datetime

try:
    import openai
except ImportError:
    openai = None

ai_chatbot_bp = Blueprint('ai_chatbot', __name__)

def serialize_document(doc):
    """Convert MongoDB document to JSON-serializable format."""
    if doc is None:
        return None
    if isinstance(doc, dict) and '_id' in doc:
        doc['_id'] = str(doc['_id'])
    return doc


def call_openai_chat_completion(message, user_role, role_config, current_user, session_id=None):
    """Call OpenAI chat completion for real-time, role-aware responses."""
    openai_api_key = os.environ.get('OPENAI_API_KEY')
    if not openai_api_key or openai is None:
        return None

    openai_model = os.environ.get('OPENAI_MODEL', 'gpt-3.5-turbo')
    openai.api_key = openai_api_key

    system_prompt = (
        "You are the AI assistant for the System Integration System. "
        "Answer user questions directly and clearly, using the system's domain knowledge when appropriate. "
        "Be polite and helpful, and do not invent unsupported system behavior. "
        "When asked about this platform, mention services, projects, tasks, users, accounting, and reporting."
    )
    role_prompt = f"The current user is a {user_role.replace('_', ' ')}. Respond with helpful guidance appropriate to their role."

    messages = [
        {'role': 'system', 'content': system_prompt},
        {'role': 'system', 'content': role_prompt},
    ]

    if session_id:
        try:
            history_cursor = mongo.db.ai_chat_sessions.find(
                {'session_id': session_id, 'user_id': current_user['_id']}
            ).sort('created_at', 1).limit(20)
            for item in history_cursor:
                if item.get('user_message'):
                    messages.append({'role': 'user', 'content': item['user_message']})
                if item.get('ai_response'):
                    messages.append({'role': 'assistant', 'content': item['ai_response']})
        except Exception:
            pass

    messages.append({'role': 'user', 'content': message})

    try:
        completion = openai.ChatCompletion.create(
            model=openai_model,
            messages=messages,
            temperature=0.7,
            max_tokens=500,
            n=1,
        )
        ai_text = completion.choices[0].message['content'].strip()
        return ai_text
    except Exception:
        return None

# Role-specific AI response templates
AI_RESPONSES = {
    'client': {
        'greeting': "Hello! I'm your AI assistant. I can help you with service requests, project tracking, and general questions about our services.",
        'capabilities': [
            "Help with service requests and orders",
            "Track project progress and status",
            "Answer questions about our services",
            "Provide billing and payment information",
            "Schedule appointments and consultations"
        ],
        'sample_responses': {
            'services': "We offer various services including web development, mobile apps, and digital marketing. Would you like details about any specific service?",
            'projects': "I can help you track your project progress. Please provide your project ID or name, and I'll get the latest status for you.",
            'billing': "For billing inquiries, I can check your invoice status, payment history, and help with payment processing. What would you like to know?",
            'support': "I'm here to help! You can ask me about services, projects, billing, or any other questions you might have."
        },
        'sample_questions': [
            "What services do you offer?",
            "How can I track my project?",
            "How do I view my invoice?",
            "How do I create a service request?"
        ]
    },
    'admin': {
        'greeting': "Hello Admin! I'm your AI management assistant. I can help you with system administration, user management, and operational insights.",
        'capabilities': [
            "System monitoring and analytics",
            "User management and permissions",
            "Department and service management",
            "Financial reporting and insights",
            "Operational efficiency recommendations"
        ],
        'sample_responses': {
            'users': "I can help you manage users, check their activity, and analyze user patterns. What specific user information do you need?",
            'departments': "I can assist with department management, service allocation, and team performance metrics.",
            'analytics': "I can provide system analytics, user engagement metrics, and operational insights to help you make informed decisions.",
            'reports': "I can generate various reports including financial summaries, project statuses, and system performance metrics."
        },
        'sample_questions': [
            "How can I manage users?",
            "How do I view department analytics?",
            "How do I generate financial reports?",
            "How do I configure services?"
        ]
    },
    'team_leader': {
        'greeting': "Hello Team Leader! I'm your AI project assistant. I can help you with team management, project coordination, and resource planning.",
        'capabilities': [
            "Project and task management",
            "Team performance tracking",
            "Resource allocation and scheduling",
            "Progress reporting and analytics",
            "Team communication and coordination"
        ],
        'sample_responses': {
            'projects': "I can help you manage projects, track milestones, and optimize resource allocation. What project would you like to work on?",
            'team': "I can provide insights on team performance, workload distribution, and productivity metrics for your team members.",
            'tasks': "I can help you create, assign, and track tasks for your team members. Would you like to set up new tasks or review existing ones?",
            'reports': "I can generate progress reports, performance analytics, and project summaries for your department."
        },
        'sample_questions': [
            "How do I assign tasks to my team?",
            "How can I view project progress?",
            "How do I monitor team performance?",
            "How do I generate project reports?"
        ]
    },
    'team_member': {
        'greeting': "Hello! I'm your AI work assistant. I can help you with your tasks, project updates, and team collaboration.",
        'capabilities': [
            "Task management and updates",
            "Project progress tracking",
            "Team collaboration tools",
            "Time management and scheduling",
            "Skill development and training"
        ],
        'sample_responses': {
            'tasks': "I can help you manage your assigned tasks, update progress, and notify your team leader about completion.",
            'projects': "I can provide updates on your current projects, deadlines, and next steps you need to take.",
            'collaboration': "I can help you coordinate with team members, share updates, and communicate project status effectively.",
            'learning': "I can suggest training resources and skill development opportunities based on your role and project requirements."
        },
        'sample_questions': [
            "What are my current tasks?",
            "How can I update task progress?",
            "What is the status of my projects?",
            "How do I collaborate with my team?"
        ]
    }
}

SYSTEM_KNOWLEDGE = {
    'system': (
        "This platform is the System Integration System, designed to help you manage services, projects, tasks, users, "
        "and accounting from one dashboard. You can ask about service offerings, project status, task updates, payments, "
        "reports, and user or team management."
    ),
    'usage': (
        "To use the system, start by selecting the relevant dashboard section for your role. Clients can track service orders, "
        "projects, and invoices. Team leaders can manage projects, assign tasks, and review team performance. Team members "
        "can view tasks, log hours, and check project updates. Admins can manage users, departments, services, and financial reports."
    ),
    'out_of_the_box': (
        "I can answer general questions about this system, provide guided support on how to use it, "
        "and help with both system-specific topics and common operational questions."
    ),
    'support': (
        "If you'd like assistance, just ask a question about services, projects, tasks, payments, reports, or user management. "
        "I'm here to help with both system-related and general questions."
    ),
}

SYSTEM_KNOWLEDGE = {
    'system': (
        "This platform is the System Integration System, designed to help you manage services, projects, tasks, users, "
        "and accounting from one dashboard. You can ask about service offerings, project status, task updates, payments, "
        "reports, and user or team management."
    ),
    'usage': (
        "To use the system, start by selecting the relevant dashboard section for your role. Clients can track service orders, "
        "projects, and invoices. Team leaders can manage projects, assign tasks, and review team performance. Team members "
        "can view tasks, log hours, and check project updates. Admins can manage users, departments, services, and financial reports."
    ),
    'out_of_the_box': (
        "I can answer general questions about this system, provide guided support on how to use it, "
        "and help with both system-specific topics and common operational questions."
    ),
    'support': (
        "If you'd like assistance, just ask a question about services, projects, tasks, payments, reports, or user management. "
        "I'm here to help with both system-related and general questions."
    ),
}


def build_team_member_project_summary(user):
    """Build a direct response containing team member names and their projects for team leaders."""
    if user.get('role') != 'team_leader':
        return None

    department_id = user.get('department_id')
    team_members = list(mongo.db.users.find({
        'department_id': department_id,
        'role': 'team_member',
        'is_active': True
    }, {'first_name': 1, 'last_name': 1}))

    if not team_members:
        return "I couldn't find any active team members in your department."

    project_cursor = mongo.db.projects.find({'team_lead_id': user['_id']}, {'_id': 1, 'name': 1})
    project_map = {p['_id']: p.get('name', 'Unnamed Project') for p in project_cursor}

    if not project_map:
        project_cursor = mongo.db.projects.find({'department_id': department_id}, {'_id': 1, 'name': 1})
        project_map = {p['_id']: p.get('name', 'Unnamed Project') for p in project_cursor}

    if not project_map:
        return "I couldn't find any projects assigned to you or your department."

    member_ids = [member['_id'] for member in team_members]
    tasks = list(mongo.db.tasks.find({
        'project_id': {'$in': list(project_map.keys())},
        'assigned_to': {'$in': member_ids}
    }, {'assigned_to': 1, 'project_id': 1}))

    member_projects = {}
    for task in tasks:
        assigned_to = task.get('assigned_to')
        project_id = task.get('project_id')
        project_name = project_map.get(project_id, 'Unknown Project')
        if assigned_to and project_name:
            member_projects.setdefault(assigned_to, set()).add(project_name)

    response_lines = []
    for member in team_members:
        member_id = member['_id']
        name = f"{member.get('first_name', '').strip()} {member.get('last_name', '').strip()}".strip() or 'Unknown Member'
        projects = sorted(member_projects.get(member_id, []))
        if projects:
            response_lines.append(f"{name}: {', '.join(projects)}")
        else:
            response_lines.append(f"{name}: not currently assigned to a tracked project.")

    return "Here are the team members and the projects they are working on:\n" + "\n".join(response_lines)


@ai_chatbot_bp.route('/chat', methods=['POST'])
@jwt_required()
def ai_chat():
    """AI chatbot endpoint with role-based responses."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    if not current_user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    
    data = request.get_json()
    message = data.get('message', '').strip()
    
    if not message:
        return jsonify({'success': False, 'message': 'Message is required'}), 400
    
    user_role = current_user.get('role', 'client')
    role_config = AI_RESPONSES.get(user_role, AI_RESPONSES['client'])
    session_id = data.get('session_id') or generate_unique_id()

    # Direct team leader query handling for member/project details
    ai_response = None
    if user_role == 'team_leader' and any(keyword in message.lower() for keyword in [
        'team members', 'member details', 'names and project', 'names and projects', 'working on',
        'project on which', 'give me the team', 'team member details', 'team member names',
        'project on which they are working'
    ]):
        ai_response = build_team_member_project_summary(current_user)

    # Generate AI response based on OpenAI if available, otherwise fallback to local role-based logic
    if not ai_response and os.environ.get('OPENAI_API_KEY') and openai is not None:
        ai_response = call_openai_chat_completion(message, user_role, role_config, current_user, session_id)

    if not ai_response:
        ai_response = generate_ai_response(message, user_role, role_config, current_user)

    # Save chat session
    chat_session = {
        '_id': generate_unique_id(),
        'user_id': current_user_id,
        'user_role': user_role,
        'user_message': message,
        'ai_response': ai_response,
        'created_at': datetime.utcnow(),
        'session_id': session_id
    }
    
    mongo.db.ai_chat_sessions.insert_one(chat_session)
    
    return jsonify({
        'success': True,
        'data': {
            'message': ai_response,
            'session_id': chat_session['session_id'],
            'timestamp': chat_session['created_at'].isoformat(),
            'role': user_role
        }
    }), 200

@ai_chatbot_bp.route('/history', methods=['GET'])
@jwt_required()
def get_chat_history():
    """Get AI chat history for current user."""
    current_user_id = get_jwt_identity()
    
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    skip = (page - 1) * per_page
    
    sessions = list(mongo.db.ai_chat_sessions.find(
        {'user_id': current_user_id}
    ).sort('created_at', -1).skip(skip).limit(per_page))
    
    return jsonify({
        'success': True,
        'data': serialize_document(sessions),
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': mongo.db.ai_chat_sessions.count_documents({'user_id': current_user_id})
        }
    }), 200

@ai_chatbot_bp.route('/capabilities', methods=['GET'])
@jwt_required()
def get_capabilities():
    """Get AI capabilities for current user's role."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    if not current_user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    
    user_role = current_user.get('role', 'client')
    role_config = AI_RESPONSES.get(user_role, AI_RESPONSES['client'])
    
    return jsonify({
        'success': True,
        'data': {
            'role': user_role,
            'greeting': role_config['greeting'],
            'capabilities': role_config['capabilities'],
            'sample_questions': role_config.get('sample_questions', list(role_config['sample_responses'].keys()))
        }
    }), 200

@ai_chatbot_bp.route('/clear-history', methods=['DELETE'])
@jwt_required()
def clear_chat_history():
    """Clear AI chat history for current user."""
    current_user_id = get_jwt_identity()
    
    result = mongo.db.ai_chat_sessions.delete_many({'user_id': current_user_id})
    
    return jsonify({
        'success': True,
        'message': f'Chat history cleared. {result.deleted_count} sessions deleted.'
    }), 200

def generate_ai_response(message, user_role, role_config, user):
    """Generate contextual AI response based on user role and message."""
    message_lower = message.lower()
    sample_responses = role_config['sample_responses']

    if user_role == 'team_leader' and any(keyword in message_lower for keyword in [
        'team members', 'member details', 'names and project', 'names and projects', 'working on',
        'project on which', 'give me the team', 'team member details', 'team member names',
        'project on which they are working'
    ]):
        direct_summary = build_team_member_project_summary(user)
        if direct_summary:
            return direct_summary

    def contains_any(text, keywords):
        return any(keyword in text for keyword in keywords)

    # System-level responses
    if contains_any(message_lower, [
        'what is this system', 'tell me about the system', 'about the platform', 'system integration',
        'what is this platform', 'what can this system do', 'system overview'
    ]):
        return SYSTEM_KNOWLEDGE['system']

    if contains_any(message_lower, [
        'out of the box', 'out of box', 'general question', 'general knowledge', 'general information'
    ]):
        return SYSTEM_KNOWLEDGE['out_of_the_box']

    if contains_any(message_lower, [
        'how do i use', 'how to use', 'how do i get started', 'getting started', 'how to begin'
    ]):
        return SYSTEM_KNOWLEDGE['usage']

    if contains_any(message_lower, [
        'need help', 'support', 'assist me', 'help me', 'i have a question'
    ]):
        return SYSTEM_KNOWLEDGE['support']

    # Task-related queries
    if contains_any(message_lower, ['assign', 'task', 'tasks', 'deadline', 'status', 'update progress']):
        if 'tasks' in sample_responses:
            return sample_responses['tasks']
        if 'projects' in sample_responses:
            return sample_responses['projects']

    # Team-related queries
    if contains_any(message_lower, ['team', 'performance', 'productivity', 'workload', 'collaboration', 'member']):
        if 'team' in sample_responses:
            return sample_responses['team']
        if 'reports' in sample_responses:
            return sample_responses['reports']

    # Project-related queries
    if contains_any(message_lower, ['project', 'projects', 'milestone', 'progress', 'timeline', 'schedule']):
        if 'projects' in sample_responses:
            return sample_responses['projects']

    # Billing-related queries
    if contains_any(message_lower, ['bill', 'payment', 'invoice', 'cost', 'price', 'charge', 'billing']):
        if user_role == 'client' and 'billing' in sample_responses:
            return sample_responses['billing']
        if user_role == 'admin' and 'reports' in sample_responses:
            return sample_responses['reports']

    # User and access queries
    if contains_any(message_lower, ['user', 'users', 'account', 'member', 'role', 'permission', 'access']):
        if user_role == 'admin' and 'users' in sample_responses:
            return sample_responses['users']
        if user_role == 'team_leader' and 'team' in sample_responses:
            return sample_responses['team']

    # Analytics and reports
    if contains_any(message_lower, ['analytics', 'report', 'reports', 'stats', 'data', 'insight']):
        if 'analytics' in sample_responses:
            return sample_responses['analytics']
        if 'reports' in sample_responses:
            return sample_responses['reports']

    # Support and help queries
    if contains_any(message_lower, ['help', 'support', 'assist', 'question']):
        if 'support' in sample_responses:
            return sample_responses['support']

    # General explanation questions
    if contains_any(message_lower, ['what is ai', 'what is artificial intelligence', 'what is an assistant', 'who are you']):
        return (
            "I'm the built-in AI assistant for this platform. I can answer questions about system usage, services, projects, tasks, "
            "billing, reports, and general system-related topics."
        )

    # Default contextual response based on role
    base_role = user_role.replace('_', ' ')
    if user_role == 'client':
        return (
            f"I understand you're asking about: '{message}'. As a client, I can help you with services, projects, and billing. "
            "Please add a little more detail so I can answer exactly what you need."
        )
    elif user_role == 'admin':
        return (
            f"I see you're asking: '{message}'. As an admin, I can help with system management, user administration, "
            "and reporting. Tell me the specific area you'd like help with, and I will respond directly."
        )
    elif user_role == 'team_leader':
        return (
            f"I note your question about: '{message}'. As a team leader, I can help with project management, team coordination, "
            "and performance tracking. Please let me know which part of the workflow you'd like to focus on."
        )
    elif user_role == 'team_member':
        return (
            f"I understand you're asking about: '{message}'. As a team member, I can help you with tasks, project updates, "
            "and team collaboration. Please tell me more so I can provide a direct answer."
        )

    return (
        "I'm here to help! You can ask me about services, projects, tasks, payments, reports, or how to use the system. "
        "Please be specific and I will give you a better answer."
    )
