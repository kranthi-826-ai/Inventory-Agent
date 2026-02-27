#!/usr/bin/env python3
"""
Main entry point for Voice Inventory Agent
Run this file to start both backend and frontend servers
"""

import os
import sys
import subprocess
import time
import webbrowser
from threading import Thread

def run_backend():
    """Run Flask backend server"""
    print("🚀 Starting backend server...")
    os.environ['FLASK_APP'] = 'backend/app.py'
    os.environ['FLASK_ENV'] = 'development'
    
    # Run Flask
    subprocess.run([sys.executable, 'backend/app.py'])

def open_browser():
    """Open browser after a short delay"""
    time.sleep(3)
    print("🌐 Opening browser...")
    webbrowser.open('http://localhost:5000')

def setup_database():
    """Initialize database"""
    print("🗄️ Setting up database...")
    try:
        from database.seed_data import reset_database
        reset_database()
        print("✅ Database setup complete")
    except Exception as e:
        print(f"❌ Database setup failed: {e}")
        return False
    return True

def install_requirements():
    """Install required packages"""
    print("📦 Installing requirements...")
    try:
        subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'])
        print("✅ Requirements installed")
    except Exception as e:
        print(f"❌ Failed to install requirements: {e}")
        return False
    return True

if __name__ == '__main__':
    print("=" * 50)
    print("🎤 Voice Inventory Agent")
    print("=" * 50)
    
    # Install requirements
    if not install_requirements():
        response = input("Continue anyway? (y/n): ")
        if response.lower() != 'y':
            sys.exit(1)
    
    # Setup database
    setup_database()
    
    # Open browser in separate thread
    Thread(target=open_browser).start()
    
    # Run backend
    run_backend()