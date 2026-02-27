import os
import sys
import logging

from flask import Flask, send_from_directory
from flask_cors import CORS

# Add parent directory to path so all modules can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.config import DEBUG, HOST, PORT, CORS_ORIGINS, LOG_LEVEL, LOG_FORMAT
from backend.routes import api_bp
from database.db_connection import init_database, check_database

# Configure logging
logging.basicConfig(level=getattr(logging, LOG_LEVEL), format=LOG_FORMAT)
logger = logging.getLogger(__name__)


def create_app():
    """Application factory"""
    app = Flask(
        __name__,
        static_folder=os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend'),
        static_url_path=''
    )

    # Configure CORS - allow all origins for development
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

    # Register blueprints
    app.register_blueprint(api_bp)

    # Serve index.html at root
    @app.route('/')
    def serve_index():
        return send_from_directory(app.static_folder, 'index.html')

    # Serve dashboard
    @app.route('/dashboard')
    def serve_dashboard():
        return send_from_directory(app.static_folder, 'dashboard.html')

    # Catch-all: serve any other frontend file
    @app.route('/<path:path>')
    def serve_frontend(path):
        try:
            return send_from_directory(app.static_folder, path)
        except Exception:
            return send_from_directory(app.static_folder, 'index.html')

    return app


def initialize_database():
    """Initialize database if it doesn't exist"""
    try:
        if not check_database():
            logger.info("Database not found. Initializing...")
            init_database()
            # Seed with initial data
            from database.seed_data import seed_database
            seed_database()
            logger.info("Database initialized and seeded successfully")
        else:
            logger.info("Database already exists")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        sys.exit(1)


if __name__ == '__main__':
    # Initialize database
    initialize_database()

    # Create and run app
    app = create_app()
    logger.info(f"Starting Voice Inventory Agent on {HOST}:{PORT}")
    logger.info(f"API:      http://{HOST}:{PORT}/api")
    logger.info(f"Frontend: http://{HOST}:{PORT}")
    app.run(debug=DEBUG, host=HOST, port=PORT)
