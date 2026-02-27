import os

# Base directory of the application (backend folder)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Database configuration - stored in database/ folder at project root
DB_PATH = os.path.join(BASE_DIR, '..', 'database', 'inventory.db')

# App configuration
DEBUG = True
HOST = '0.0.0.0'
PORT = 5000

# Audio settings
ALLOWED_AUDIO_EXTENSIONS = {'wav', 'mp3', 'ogg'}
MAX_AUDIO_SIZE = 10 * 1024 * 1024  # 10MB

# Inventory settings
LOW_STOCK_THRESHOLD = 5  # Items below this quantity are considered low stock

# Logging configuration
LOG_LEVEL = 'INFO'
LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'

# CORS settings - allow frontend dev servers and the Flask server itself
CORS_ORIGINS = [
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:3000',
    '*'
]
