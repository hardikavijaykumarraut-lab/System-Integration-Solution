from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from bson.objectid import ObjectId
from app import mongo
from app.utils.helpers import generate_unique_id, serialize_document
import io
import json

payments_bp = Blueprint('payments', __name__)


def generate_receipt_id():
    """Generate a unique receipt ID."""
    timestamp = datetime.utcnow().strftime('%Y%m%d')
    random_suffix = str(ObjectId())[-6:].upper()
    return f"RCP-{timestamp}-{random_suffix}"


@payments_bp.route('/', methods=['POST'])
@jwt_required()
def create_payment():
    """Create a new payment record."""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['amount', 'payment_mode', 'package_id', 'package_name']
    for field in required_fields:
        if not data.get(field):
            return jsonify({
                'success': False,
                'message': f'{field} is required'
            }), 400
    
    # Get client details
    client = mongo.db.users.find_one({'_id': current_user_id})
    if not client:
        return jsonify({'success': False, 'message': 'Client not found'}), 404
    
    # Generate receipt ID
    receipt_id = generate_receipt_id()
    
    # Create payment document
    payment = {
        '_id': str(ObjectId()),
        'receipt_id': receipt_id,
        'client_id': current_user_id,
        'client_name': f"{client.get('first_name', '')} {client.get('last_name', '')}".strip(),
        'client_email': client.get('email'),
        'project_id': data.get('project_id'),  # May be null for new requirements
        'package_id': data['package_id'],
        'package_name': data['package_name'],
        'department_id': data.get('department_id'),
        'amount': float(data['amount']),
        'payment_mode': data['payment_mode'],  # credit_card, debit_card, upi, net_banking, etc.
        'status': 'completed',
        'transaction_id': data.get('transaction_id', ''),
        'notes': data.get('notes', ''),
        # Store non-sensitive payment details for verification purposes
        'payment_details': {
            'card_last_4': data.get('payment_details', {}).get('card_number', '')[-4:] if data.get('payment_details', {}).get('card_number') else None,
            'cardholder_name': data.get('payment_details', {}).get('cardholder_name', None),
            'payment_method': data.get('payment_details', {}).get('payment_method', None),
            'upi_id': data.get('payment_details', {}).get('upi_id', None),
            'bank_name': data.get('payment_details', {}).get('bank_name', None),
            'wallet_provider': data.get('payment_details', {}).get('wallet_provider', None)
        },
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }
    
    # Insert payment into database
    mongo.db.payments.insert_one(payment)
    
    return jsonify({
        'success': True,
        'message': 'Payment recorded successfully',
        'data': {
            'payment_id': payment['_id'],
            'receipt_id': receipt_id,
            'amount': payment['amount'],
            'payment_mode': payment['payment_mode'],
            'created_at': payment['created_at'].isoformat()
        }
    }), 201


@payments_bp.route('/my-payments', methods=['GET'])
@jwt_required()
def get_my_payments():
    """Get all payments for the current client."""
    current_user_id = get_jwt_identity()
    
    payments = list(mongo.db.payments.find({
        'client_id': current_user_id
    }).sort('created_at', -1))
    
    # Enrich with project info if available
    for payment in payments:
        if payment.get('project_id'):
            project = mongo.db.projects.find_one(
                {'_id': payment['project_id']},
                {'name': 1, 'code': 1, 'status': 1}
            )
            if project:
                payment['project_name'] = project.get('name', 'Unknown Project')
                payment['project_code'] = project.get('code', '')
                payment['project_status'] = project.get('status', '')
        
        # Add department name if available
        if payment.get('department_id'):
            dept = mongo.db.departments.find_one(
                {'_id': payment['department_id']},
                {'name': 1}
            )
            if dept:
                payment['department_name'] = dept.get('name', 'Unknown')
    
    return jsonify({
        'success': True,
        'data': serialize_document(payments)
    }), 200


@payments_bp.route('/<payment_id>', methods=['GET'])
@jwt_required()
def get_payment(payment_id):
    """Get a specific payment by ID."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    payment = mongo.db.payments.find_one({'_id': payment_id})
    
    if not payment:
        return jsonify({'success': False, 'message': 'Payment not found'}), 404
    
    # Check permissions - only the client who made the payment or admin can view
    if current_user.get('role') != 'admin' and payment['client_id'] != current_user_id:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    # Enrich with project info
    if payment.get('project_id'):
        project = mongo.db.projects.find_one(
            {'_id': payment['project_id']},
            {'name': 1, 'code': 1}
        )
        if project:
            payment['project_name'] = project.get('name')
            payment['project_code'] = project.get('code')
    
    return jsonify({
        'success': True,
        'data': serialize_document(payment)
    }), 200


@payments_bp.route('/<payment_id>/receipt', methods=['GET'])
@jwt_required()
def download_receipt(payment_id):
    """Generate and download payment receipt."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    payment = mongo.db.payments.find_one({'_id': payment_id})
    
    if not payment:
        return jsonify({'success': False, 'message': 'Payment not found'}), 404
    
    # Check permissions
    if current_user.get('role') != 'admin' and payment['client_id'] != current_user_id:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    # Generate receipt content
    receipt_content = generate_receipt_content(payment, current_user)
    
    # Create file-like object
    buffer = io.BytesIO()
    buffer.write(receipt_content.encode('utf-8'))
    buffer.seek(0)
    
    return send_file(
        buffer,
        mimetype='text/plain',
        as_attachment=True,
        download_name=f"Receipt-{payment['receipt_id']}.txt"
    )


def generate_receipt_content(payment, user):
    """Generate receipt content as text."""
    lines = []
    lines.append("=" * 60)
    lines.append(" " * 15 + "PAYMENT RECEIPT")
    lines.append("=" * 60)
    lines.append("")
    lines.append(f"Receipt ID: {payment['receipt_id']}")
    lines.append(f"Transaction ID: {payment.get('transaction_id', 'N/A')}")
    lines.append(f"Date: {payment['created_at'].strftime('%B %d, %Y at %I:%M %p')}")
    lines.append("")
    lines.append("-" * 60)
    lines.append("CUSTOMER INFORMATION")
    lines.append("-" * 60)
    lines.append(f"Name: {payment['client_name']}")
    lines.append(f"Email: {payment['client_email']}")
    lines.append("")
    lines.append("-" * 60)
    lines.append("PAYMENT DETAILS")
    lines.append("-" * 60)
    lines.append(f"Service: {payment['package_name']}")
    if payment.get('department_name'):
        lines.append(f"Department: {payment['department_name']}")
    lines.append(f"Payment Mode: {payment['payment_mode'].replace('_', ' ').title()}")
    lines.append("")
    lines.append(f"Amount Paid: ${payment['amount']:,.2f}")
    lines.append(f"Status: {payment['status'].upper()}")
    lines.append("")
    lines.append("=" * 60)
    lines.append("Thank you for your business!")
    lines.append("=" * 60)
    
    return "\n".join(lines)


@payments_bp.route('/client/<client_id>', methods=['GET'])
@jwt_required()
def get_client_payments(client_id):
    """Get all payments for a specific client (admin only)."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    if current_user.get('role') != 'admin':
        return jsonify({'success': False, 'message': 'Admin access required'}), 403
    
    payments = list(mongo.db.payments.find({
        'client_id': client_id
    }).sort('created_at', -1))
    
    return jsonify({
        'success': True,
        'data': serialize_document(payments)
    }), 200


@payments_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_payment_stats():
    """Get payment statistics (admin only)."""
    current_user_id = get_jwt_identity()
    current_user = mongo.db.users.find_one({'_id': current_user_id})
    
    if current_user.get('role') != 'admin':
        return jsonify({'success': False, 'message': 'Admin access required'}), 403
    
    # Get total revenue
    total_revenue = list(mongo.db.payments.aggregate([
        {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
    ]))
    
    # Get payments by mode
    payments_by_mode = list(mongo.db.payments.aggregate([
        {'$group': {'_id': '$payment_mode', 'count': {'$sum': 1}, 'total': {'$sum': '$amount'}}}
    ]))
    
    # Get recent payments
    recent_payments = list(mongo.db.payments.find().sort('created_at', -1).limit(10))
    
    return jsonify({
        'success': True,
        'data': {
            'total_revenue': total_revenue[0]['total'] if total_revenue else 0,
            'payments_by_mode': payments_by_mode,
            'recent_payments': serialize_document(recent_payments)
        }
    }), 200
