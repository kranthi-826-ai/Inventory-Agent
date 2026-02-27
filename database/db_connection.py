import sqlite3
import os
import sys
from contextlib import contextmanager

# Add project root to path so backend.config can be found
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.config import DB_PATH


def get_connection():
    """Create a database connection"""
    # Ensure directory exists
    db_dir = os.path.dirname(DB_PATH)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # Enable foreign key support
    conn.execute('PRAGMA foreign_keys = ON')
    return conn


@contextmanager
def get_db_cursor():
    """Context manager for database cursors"""
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        yield cursor
        conn.commit()
    except sqlite3.Error as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        if conn:
            conn.close()


def init_database():
    """Initialize database with schema"""
    schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
    if not os.path.exists(schema_path):
        raise FileNotFoundError(f"Schema file not found: {schema_path}")
    with open(schema_path, 'r') as f:
        schema = f.read()
    with get_db_cursor() as cursor:
        cursor.executescript(schema)
    print(f"Database initialized at: {DB_PATH}")


def check_database():
    """Check if database exists and has the inventory table"""
    if not os.path.exists(DB_PATH):
        return False
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                SELECT name FROM sqlite_master
                WHERE type='table' AND name='inventory'
            """)
            return cursor.fetchone() is not None
    except sqlite3.Error:
        return False


def execute_query(query, params=(), fetch_one=False, fetch_all=False):
    """Execute a query and return results"""
    with get_db_cursor() as cursor:
        cursor.execute(query, params)
        if fetch_one:
            result = cursor.fetchone()
            return dict(result) if result else None
        elif fetch_all:
            results = cursor.fetchall()
            return [dict(row) for row in results]
        else:
            return cursor.lastrowid
