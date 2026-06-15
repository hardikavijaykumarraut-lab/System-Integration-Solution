from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from bson.objectid import ObjectId
from app import mongo
from app.utils.decorators import team_leader_required, admin_required

daily_reports_bp = Blueprint('daily_reports', __name__)

@daily_reports_bp.route('/', methods=['POST'])
@jwt_required()
@team_leader_required
def submit_daily_report():
    """Team lead submits daily report to admin."""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    # Validate required fields
    if not data.get('project_id') or not data.get('report_date'):
        return jsonify({
            'success': False,
            'message': 'Project ID and report date are required'
        }), 400
    
    # Get team lead details
    team_lead = mongo.db.users.find_one({'_id': current_user_id})
    
    # Get project details
    project = mongo.db.projects.find_one({
        '_id': data['project_id'],
        'team_lead_id': current_user_id
    })
    
    if not project:
        return jsonify({
            'success': False,
            'message': 'Project not found or not assigned to you'
        }), 404
    
    # Create daily report
    report = {
        '_id': str(ObjectId()),
        'project_id': data['project_id'],
        'project_name': project.get('name', ''),
        'client_id': project.get('client_id'),
        'client_name': project.get('client_name', ''),
        'team_lead_id': current_user_id,
        'team_lead_name': f"{team_lead.get('first_name', '')} {team_lead.get('last_name', '')}".strip(),
        'report_date': datetime.fromisoformat(data['report_date']),
        'tasks_completed': data.get('tasks_completed', []),
        'tasks_in_progress': data.get('tasks_in_progress', []),
        'tasks_planned': data.get('tasks_planned', []),
        'issues_blockers': data.get('issues_blockers', ''),
        'team_performance': data.get('team_performance', {}),
        'overall_progress': data.get('overall_progress', 0),
        'notes': data.get('notes', ''),
        'status': 'submitted',  # submitted, reviewed
        'admin_feedback': '',
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }
    
    mongo.db.daily_reports.insert_one(report)
    
    return jsonify({
        'success': True,
        'message': 'Daily report submitted successfully',
        'data': {'report_id': report['_id']}
    }), 201

@daily_reports_bp.route('/', methods=['GET'])
@jwt_required()
def get_reports():
    """Get daily reports - filtered by role."""
    current_user_id = get_jwt_identity()
    user = mongo.db.users.find_one({'_id': current_user_id})
    
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    
    # Parse query params
    project_id = request.args.get('project_id')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    query = {}
    
    # Filter by role
    if user['role'] == 'team_leader':
        query['team_lead_id'] = current_user_id
    elif user['role'] == 'client':
        query['client_id'] = current_user_id
    # Admin sees all
    
    if project_id:
        query['project_id'] = project_id
    
    if start_date and end_date:
        query['report_date'] = {
            '$gte': datetime.fromisoformat(start_date),
            '$lte': datetime.fromisoformat(end_date)
        }
    
    reports = list(mongo.db.daily_reports.find(query).sort('report_date', -1))
    
    result = []
    for report in reports:
        result.append({
            'id': report['_id'],
            'project_id': report['project_id'],
            'project_name': report['project_name'],
            'client_name': report.get('client_name'),
            'team_lead_name': report['team_lead_name'],
            'report_date': report['report_date'].isoformat(),
            'tasks_completed_count': len(report.get('tasks_completed', [])),
            'tasks_in_progress_count': len(report.get('tasks_in_progress', [])),
            'overall_progress': report.get('overall_progress', 0),
            'status': report.get('status', 'submitted'),
            'created_at': report['created_at'].isoformat()
        })
    
    return jsonify({
        'success': True,
        'data': result
    }), 200

@daily_reports_bp.route('/<report_id>', methods=['GET'])
@jwt_required()
def get_report_details(report_id):
    """Get detailed report by ID."""
    current_user_id = get_jwt_identity()
    user = mongo.db.users.find_one({'_id': current_user_id})
    
    report = mongo.db.daily_reports.find_one({'_id': report_id})
    
    if not report:
        return jsonify({'success': False, 'message': 'Report not found'}), 404
    
    # Check permissions
    if user['role'] == 'team_leader' and report['team_lead_id'] != current_user_id:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    if user['role'] == 'client' and report['client_id'] != current_user_id:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    return jsonify({
        'success': True,
        'data': {
            'id': report['_id'],
            'project_id': report['project_id'],
            'project_name': report['project_name'],
            'client_name': report.get('client_name'),
            'team_lead_name': report['team_lead_name'],
            'report_date': report['report_date'].isoformat(),
            'tasks_completed': report.get('tasks_completed', []),
            'tasks_in_progress': report.get('tasks_in_progress', []),
            'tasks_planned': report.get('tasks_planned', []),
            'issues_blockers': report.get('issues_blockers', ''),
            'team_performance': report.get('team_performance', {}),
            'overall_progress': report.get('overall_progress', 0),
            'notes': report.get('notes', ''),
            'status': report.get('status', 'submitted'),
            'admin_feedback': report.get('admin_feedback', ''),
            'created_at': report['created_at'].isoformat()
        }
    }), 200

@daily_reports_bp.route('/<report_id>/feedback', methods=['POST'])
@jwt_required()
@admin_required
def add_admin_feedback(report_id):
    """Admin adds feedback to a daily report."""
    data = request.get_json()
    
    if not data.get('feedback'):
        return jsonify({
            'success': False,
            'message': 'Feedback is required'
        }), 400
    
    result = mongo.db.daily_reports.update_one(
        {'_id': report_id},
        {
            '$set': {
                'admin_feedback': data['feedback'],
                'status': 'reviewed',
                'updated_at': datetime.utcnow()
            }
        }
    )
    
    if result.matched_count == 0:
        return jsonify({'success': False, 'message': 'Report not found'}), 404
    
    return jsonify({
        'success': True,
        'message': 'Feedback added successfully'
    }), 200

@daily_reports_bp.route('/summary', methods=['GET'])
@jwt_required()
@admin_required
def get_reports_summary():
    """Admin gets summary of all reports."""
    # Get reports from last 7 days
    week_ago = datetime.utcnow() - timedelta(days=7)
    
    pipeline = [
        {'$match': {'created_at': {'$gte': week_ago}}},
        {
            '$group': {
                '_id': '$project_id',
                'project_name': {'$first': '$project_name'},
                'report_count': {'$sum': 1},
                'avg_progress': {'$avg': '$overall_progress'},
                'last_report_date': {'$max': '$report_date'}
            }
        }
    ]
    
    summary = list(mongo.db.daily_reports.aggregate(pipeline))
    
    return jsonify({
        'success': True,
        'data': summary
    }), 200
