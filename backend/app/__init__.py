from flask import Flask, request
from flask_pymongo import PyMongo
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
from config.config import config
import os

# Initialize extensions
mongo = PyMongo()
jwt = JWTManager()
socketio = SocketIO(cors_allowed_origins="*")

def create_app(config_name='default'):
    """Application factory pattern."""
    app = Flask(__name__)
    app.url_map.strict_slashes = False
    app.config.from_object(config[config_name])
    
    # Initialize extensions with app
    mongo.init_app(app)
    jwt.init_app(app)
    socketio.init_app(app, async_mode='eventlet')
    
    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.users import users_bp
    from app.routes.departments import departments_bp
    from app.routes.tasks import tasks_bp
    from app.routes.projects import projects_bp
    from app.routes.chat import chat_bp
    from app.routes.accounting import accounting_bp
    from app.routes.dashboard import dashboard_bp
    from app.routes.clients import clients_bp
    from app.routes.reports import reports_bp
    from app.routes.upload import upload_bp
    from app.routes.services import services_bp
    from app.routes.requirements import requirements_bp
    from app.routes.reports_daily import daily_reports_bp
    from app.routes.payments import payments_bp
    from app.routes.ai_chatbot import ai_chatbot_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(departments_bp, url_prefix='/api/departments')
    app.register_blueprint(tasks_bp, url_prefix='/api/tasks')
    app.register_blueprint(projects_bp, url_prefix='/api/projects')
    app.register_blueprint(chat_bp, url_prefix='/api/chat')
    app.register_blueprint(accounting_bp, url_prefix='/api/accounting')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    app.register_blueprint(clients_bp, url_prefix='/api/clients')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')
    app.register_blueprint(upload_bp, url_prefix='/api/upload')
    app.register_blueprint(services_bp, url_prefix='/api/services')
    app.register_blueprint(requirements_bp, url_prefix='/api/requirements')
    app.register_blueprint(daily_reports_bp, url_prefix='/api/daily-reports')
    app.register_blueprint(payments_bp, url_prefix='/api/payments')
    app.register_blueprint(ai_chatbot_bp, url_prefix='/api/ai-chatbot')
    
    # Create uploads directory
    import os
    uploads_dir = os.path.join(app.root_path, '..', app.config['UPLOAD_FOLDER'])
    os.makedirs(uploads_dir, exist_ok=True)
    
    # Serve uploaded files statically
    from flask import send_from_directory
    @app.route('/uploads/<path:filename>')
    def serve_upload(filename):
        return send_from_directory(uploads_dir, filename)
    
    # Handle CORS - both preflight and regular requests
    @app.before_request
    def handle_cors():
        if request.method == 'OPTIONS':
            response = app.make_response('')
            response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,Accept,X-Requested-With'
            response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS,PATCH'
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            return response

    @app.after_request
    def add_cors_headers(response):
        # Only add headers if not already present (avoid duplicates)
        if 'Access-Control-Allow-Origin' not in response.headers:
            response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'
        if 'Access-Control-Allow-Headers' not in response.headers:
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,Accept,X-Requested-With'
        if 'Access-Control-Allow-Methods' not in response.headers:
            response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS,PATCH'
        if 'Access-Control-Allow-Credentials' not in response.headers:
            response.headers['Access-Control-Allow-Credentials'] = 'true'
        return response
    
    # Register error handlers
    register_error_handlers(app)
    
    return app

def register_error_handlers(app):
    """Register global error handlers."""
    def cors_response(data, status_code):
        """Helper to add CORS headers to error responses."""
        from flask import jsonify
        response = jsonify(data)
        response.status_code = status_code
        response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,Accept,X-Requested-With'
        response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS,PATCH'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        return response

    @app.errorhandler(400)
    def bad_request(error):
        return cors_response({'success': False, 'message': 'Bad request', 'error': str(error)}, 400)
    
    @app.errorhandler(401)
    def unauthorized(error):
        return cors_response({'success': False, 'message': 'Unauthorized', 'error': str(error)}, 401)
    
    @app.errorhandler(403)
    def forbidden(error):
        return cors_response({'success': False, 'message': 'Forbidden', 'error': str(error)}, 403)
    
    @app.errorhandler(404)
    def not_found(error):
        return cors_response({'success': False, 'message': 'Resource not found', 'error': str(error)}, 404)
    
    @app.errorhandler(500)
    def internal_error(error):
        return cors_response({'success': False, 'message': 'Internal server error', 'error': str(error)}, 500)
    
    @app.errorhandler(Exception)
    def handle_exception(error):
        """Catch-all exception handler to ensure CORS headers on all errors."""
        import traceback
        print(f"Unhandled exception: {traceback.format_exc()}")
        return cors_response({'success': False, 'message': 'Internal server error', 'error': str(error)}, 500)
