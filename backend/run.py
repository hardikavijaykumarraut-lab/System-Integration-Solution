#!/usr/bin/env python3
"""
System Integration Solution - Flask Backend
Main entry point for the application.
"""

import os
import sys
from app import create_app, socketio

# Create the application instance
app = create_app(os.getenv('FLASK_ENV', 'development'))

if __name__ == '__main__':
    # Run with SocketIO support for real-time chat
    socketio.run(
        app,
        host=os.getenv('HOST', '0.0.0.0'),
        port=int(os.getenv('PORT', 5000)),
        debug=app.config.get('DEBUG', True),
        use_reloader=True
    )
