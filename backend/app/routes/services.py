from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app import mongo
from app.utils.helpers import serialize_document

services_bp = Blueprint('services', __name__)

# Default services for each department
DEFAULT_SERVICES = {
    'dept_web_dev': [
        {
            'id': 'web_basic',
            'name': 'Basic Website',
            'description': '5-page responsive website with basic SEO',
            'price': 15000,
            'duration_days': 14,
            'features': ['5 Pages', 'Responsive Design', 'Basic SEO', 'Contact Form', '1 Month Support']
        },
        {
            'id': 'web_business',
            'name': 'Business Website',
            'description': '10-page website with CMS and advanced features',
            'price': 35000,
            'duration_days': 30,
            'features': ['10 Pages', 'CMS Integration', 'Advanced SEO', 'Blog', 'Analytics', '3 Months Support']
        },
        {
            'id': 'web_ecommerce',
            'name': 'E-Commerce Platform',
            'description': 'Full-featured online store with payment integration',
            'price': 75000,
            'duration_days': 45,
            'features': ['Product Catalog', 'Shopping Cart', 'Payment Gateway', 'Order Management', 'Inventory', '6 Months Support']
        },
        {
            'id': 'web_custom',
            'name': 'Custom Web Application',
            'description': 'Tailored web application with custom features',
            'price': 100000,
            'duration_days': 60,
            'features': ['Custom Features', 'API Integration', 'Database Design', 'Admin Panel', 'Scalable Architecture', '12 Months Support']
        }
    ],
    'dept_digital_mkt': [
        {
            'id': 'dm_starter',
            'name': 'Starter Marketing Package',
            'description': 'Social media setup and basic content strategy',
            'price': 10000,
            'duration_days': 30,
            'features': ['Social Media Setup', 'Content Calendar', '4 Posts/Week', 'Basic Analytics', 'Monthly Report']
        },
        {
            'id': 'dm_growth',
            'name': 'Growth Marketing Package',
            'description': 'Comprehensive digital marketing with paid ads',
            'price': 25000,
            'duration_days': 30,
            'features': ['Everything in Starter', 'Google Ads Setup', 'Facebook/Instagram Ads', 'SEO Optimization', 'Lead Generation', 'Weekly Reports']
        },
        {
            'id': 'dm_enterprise',
            'name': 'Enterprise Marketing',
            'description': 'Full-scale digital marketing with dedicated manager',
            'price': 50000,
            'duration_days': 30,
            'features': ['Everything in Growth', 'Dedicated Manager', 'Influencer Marketing', 'Email Campaigns', 'Video Marketing', 'Daily Monitoring', 'Strategy Calls']
        }
    ],
    'dept_placement': [
        {
            'id': 'place_basic',
            'name': 'Basic Recruitment',
            'description': 'Candidate sourcing for 3 positions',
            'price': 20000,
            'duration_days': 30,
            'features': ['3 Positions', 'Candidate Sourcing', 'Resume Screening', 'Interview Coordination', 'Replacement Guarantee']
        },
        {
            'id': 'place_standard',
            'name': 'Standard Recruitment',
            'description': 'End-to-end recruitment for 5 positions',
            'price': 40000,
            'duration_days': 45,
            'features': ['5 Positions', 'Job Posting', 'Candidate Sourcing', 'Technical Screening', 'Background Verification', '3 Months Replacement']
        },
        {
            'id': 'place_premium',
            'name': 'Premium Talent Acquisition',
            'description': 'Executive search and bulk hiring solutions',
            'price': 80000,
            'duration_days': 60,
            'features': ['Unlimited Positions', 'Executive Search', 'Headhunting', 'Salary Benchmarking', 'Employer Branding', '6 Months Support', 'Dedicated Recruiter']
        }
    ]
}

@services_bp.route('', methods=['GET'])
def get_services():
    """Get all services with packages."""
    department_id = request.args.get('department_id')
    
    if department_id:
        services = list(mongo.db.services.find({
            'department_id': department_id,
            'is_active': True
        }).sort('price', 1))
    else:
        # Return all services grouped by department
        departments = list(mongo.db.departments.find({'is_active': True}))
        services = {}
        
        for dept in departments:
            dept_services = list(mongo.db.services.find({
                'department_id': dept['_id'],
                'is_active': True
            }).sort('price', 1))
            services[dept['_id']] = dept_services
    
    return jsonify({
        'success': True,
        'data': serialize_document(services)
    }), 200

@services_bp.route('/departments', methods=['GET'], strict_slashes=False)
def get_service_departments():
    """Get departments that offer services."""
    departments = list(mongo.db.departments.find({'is_active': True}))
    
    result = []
    for dept in departments:
        service_count = mongo.db.services.count_documents({
            'department_id': dept['_id'],
            'is_active': True
        })
        
        result.append({
            'id': dept['_id'],
            'name': dept['name'],
            'code': dept['code'],
            'description': dept['description'],
            'icon': dept.get('icon', 'building'),
            'color': dept.get('color', '#3B82F6'),
            'service_count': service_count
        })
    
    return jsonify({
        'success': True,
        'data': result
    }), 200

@services_bp.route('/packages/<package_id>', methods=['GET'])
def get_package_details(package_id):
    """Get details of a specific package."""
    service = mongo.db.services.find_one({'_id': package_id})
    
    if service:
        return jsonify({
            'success': True,
            'data': serialize_document(service)
        }), 200
    
    return jsonify({
        'success': False,
        'message': 'Package not found'
    }), 404
