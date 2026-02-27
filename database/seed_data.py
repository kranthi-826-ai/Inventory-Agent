import sqlite3
import sys
import os

# Add parent directory to path to import config
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.config import DB_PATH
from database.db_connection import get_connection

def seed_database():
    """Seed the database with initial data"""
    initial_items = [
        ('Laptop', 15),
        ('Mouse', 3),
        ('Keyboard', 0),
        ('Monitor', 8),
        ('Headset', 2),
        ('USB Cable', 25),
        ('HDMI Cable', 12),
        ('Webcam', 4),
        ('Microphone', 6),
        ('Speaker', 1)
    ]
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Clear existing data (optional - comment out if you want to keep existing)
        cursor.execute("DELETE FROM inventory")
        cursor.execute("DELETE FROM transaction_log")
        
        # Insert initial items
        for name, quantity in initial_items:
            cursor.execute("""
                INSERT INTO inventory (name, quantity) 
                VALUES (?, ?)
            """, (name, quantity))
            
            # Log the initial addition
            cursor.execute("""
                INSERT INTO transaction_log (action, item_name, quantity_change, new_quantity)
                VALUES (?, ?, ?, ?)
            """, ('initial_add', name, quantity, quantity))
        
        conn.commit()
        print(f"✅ Database seeded successfully with {len(initial_items)} items")
        
        # Print seeded items
        cursor.execute("SELECT * FROM inventory")
        items = cursor.fetchall()
        print("\n📦 Seeded Inventory:")
        for item in items:
            print(f"   {item[1]}: {item[2]}")
            
    except sqlite3.Error as e:
        print(f"❌ Error seeding database: {e}")
        conn.rollback()
    finally:
        conn.close()

def reset_database():
    """Reset the database (drop and recreate tables)"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Drop existing tables
        cursor.execute("DROP TABLE IF EXISTS transaction_log")
        cursor.execute("DROP TABLE IF EXISTS inventory")
        
        # Recreate tables using schema
        with open(os.path.join(os.path.dirname(__file__), 'schema.sql'), 'r') as f:
            schema = f.read()
            cursor.executescript(schema)
        
        conn.commit()
        print("✅ Database reset successfully")
        
        # Seed with initial data
        seed_database()
        
    except sqlite3.Error as e:
        print(f"❌ Error resetting database: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='Database seeding tool')
    parser.add_argument('--reset', action='store_true', help='Reset database before seeding')
    args = parser.parse_args()
    
    if args.reset:
        reset_database()
    else:
        seed_database()