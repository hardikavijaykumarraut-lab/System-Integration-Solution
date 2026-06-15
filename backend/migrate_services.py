"""
Migration script to move hardcoded services to database
Run this script once to populate the database with default services
"""

from app import create_app, mongo
from datetime import datetime
from app.utils.helpers import generate_unique_id

def migrate_services():
    """Migrate hardcoded services to database"""
    
    app = create_app()
    
    with app.app_context():
        # Default services data
        DEFAULT_SERVICES = {
            'dept_web_dev': [
                {
                    'name': 'Basic Website',
                    'description': '5-page responsive website with basic SEO',
                    'price': 15000,
                    'duration_days': 14,
                    'features': ['5 Pages', 'Responsive Design', 'Basic SEO', 'Contact Form', '1 Month Support']
                },
                {
                    'name': 'Business Website',
                    'description': '10-page website with CMS and advanced features',
                    'price': 35000,
                    'duration_days': 30,
                    'features': ['10 Pages', 'CMS Integration', 'Advanced SEO', 'Blog', 'Analytics', '3 Months Support']
                },
                {
                    'name': 'E-Commerce Platform',
                    'description': 'Full-featured online store with payment integration',
                    'price': 75000,
                    'duration_days': 45,
                    'features': ['Product Catalog', 'Shopping Cart', 'Payment Gateway', 'Order Management', 'Inventory', '6 Months Support']
                },
                {
                    'name': 'Custom Web Application',
                    'description': 'Tailored web application with custom features',
                    'price': 100000,
                    'duration_days': 60,
                    'features': ['Custom Features', 'API Integration', 'Database Design', 'Admin Panel', 'Scalable Architecture', '12 Months Support']
                }
            ],
            'dept_digital_mkt': [
                {
                    'name': 'Starter Marketing Package',
                    'description': 'Social media setup and basic content strategy',
                    'price': 10000,
                    'duration_days': 30,
                    'features': ['Social Media Setup', 'Content Calendar', '4 Posts/Week', 'Basic Analytics', 'Monthly Report']
                },
                {
                    'name': 'Growth Marketing Package',
                    'description': 'Comprehensive digital marketing with paid ads',
                    'price': 25000,
                    'duration_days': 30,
                    'features': ['Everything in Starter', 'Google Ads Setup', 'Facebook/Instagram Ads', 'SEO Optimization', 'Lead Generation', 'Weekly Reports']
                },
                {
                    'name': 'Enterprise Marketing',
                    'description': 'Full-scale digital marketing with dedicated manager',
                    'price': 50000,
                    'duration_days': 30,
                    'features': ['Everything in Growth', 'Dedicated Manager', 'Influencer Marketing', 'Email Campaigns', 'Video Marketing', 'Daily Monitoring', 'Strategy Calls']
                }
            ],
            'dept_placement': [
                {
                    'name': 'Basic Recruitment',
                    'description': 'Candidate sourcing for 3 positions',
                    'price': 20000,
                    'duration_days': 30,
                    'features': ['3 Positions', 'Candidate Sourcing', 'Resume Screening', 'Interview Coordination', 'Replacement Guarantee']
                },
                {
                    'name': 'Standard Recruitment',
                    'description': 'End-to-end recruitment for 5 positions',
                    'price': 40000,
                    'duration_days': 45,
                    'features': ['5 Positions', 'Job Posting', 'Candidate Sourcing', 'Technical Screening', 'Background Verification', '3 Months Replacement']
                },
                {
                    'name': 'Premium Talent Acquisition',
                    'description': 'Executive search and bulk hiring solutions',
                    'price': 80000,
                    'duration_days': 60,
                    'features': ['Unlimited Positions', 'Executive Search', 'Headhunting', 'Salary Benchmarking', 'Employer Branding', '6 Months Support', 'Dedicated Recruiter']
                }
            ]
        }
        
        print("Starting services migration...")
        
        # Check if services already exist
        existing_services = list(mongo.db.services.find())
        if existing_services:
            print(f"Found {len(existing_services)} existing services. Skipping migration.")
            return
        
        # Get departments
        departments = list(mongo.db.departments.find())
        dept_map = {dept['_id']: dept for dept in departments}
        
        services_added = 0
        
        for dept_id, services in DEFAULT_SERVICES.items():
            if dept_id in dept_map:
                print(f"Adding services for {dept_map[dept_id]['name']}...")
                
                for service_data in services:
                    service = {
                        '_id': generate_unique_id(),
                        'name': service_data['name'],
                        'description': service_data['description'],
                        'price': service_data['price'],
                        'duration_days': service_data['duration_days'],
                        'features': service_data['features'],
                        'department_id': dept_id,
                        'is_active': True,
                        'created_at': datetime.utcnow(),
                        'updated_at': datetime.utcnow()
                    }
                    
                    mongo.db.services.insert_one(service)
                    services_added += 1
                    print(f"  - Added: {service_data['name']}")
            else:
                print(f"Department {dept_id} not found, skipping services...")
        
        print(f"Migration completed! Added {services_added} services.")

if __name__ == "__main__":
    migrate_services()
