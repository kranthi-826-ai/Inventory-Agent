from flask import Flask, send_from_directory
from flask_cors import CORS
import logging
import os
import sys

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.config import DEBUG, HOST, PORT, CORS_ORIGINS, LOG_LEVEL, LOG_FORMAT
from backend.routes import api_bp
from database.db_connection import init_database, check_database

# Configure logging
logging.basicConfig(level=getattr(logging, LOG_LEVEL), format=LOG_FORMAT)
logger = logging.getLogger(__name__)

def create_app():
    """Application factory"""
    app = Flask(__name__, 
                static_folder='../frontend',
                static_url_path='')
    
    # Configure CORS
    CORS(app, origins=CORS_ORIGINS, supports_credentials=True)
    
    # Register blueprints
    app.register_blueprint(api_bp)
    
    # Serve frontend
    @app.route('/')
    def serve_index():
        return send_from_directory('../frontend', 'index.html')
    
    @app.route('/dashboard')
    def serve_dashboard():
        return send_from_directory('../frontend', 'dashboard.html')
    
    @app.route('/<path:path>')
    def serve_frontend(path):
        return send_from_directory('../frontend', path)
    
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
    
    logger.info(f"Starting Voice Inventory Agent backend on {HOST}:{PORT}")
    logger.info(f"API endpoints available at http://{HOST}:{PORT}/api")
    logger.info(f"Frontend available at http://{HOST}:{PORT}")
    
    app.run(debug=DEBUG, host=HOST, port=PORT)