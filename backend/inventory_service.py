import logging
from typing import List, Dict, Optional, Tuple
from datetime import datetime

from shared.models import InventoryItem, InventoryStats
from shared.constants import MESSAGES
from database.db_connection import execute_query, get_db_cursor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class InventoryService:
    """Business logic layer for inventory management"""
    
    LOW_STOCK_THRESHOLD = 5
    
    @staticmethod
    def get_all_items() -> List[Dict]:
        """Get all inventory items"""
        try:
            query = "SELECT * FROM inventory ORDER BY id DESC"
            items = execute_query(query, fetch_all=True)
            logger.info(f"Retrieved {len(items)} items from inventory")
            return items
            return []
    
    @staticmethod
    def get_item(item_name: str) -> Optional[Dict]:
        """Get a specific item by name"""
        try:
            query = "SELECT * FROM inventory WHERE LOWER(name) = LOWER(?)"
            item = execute_query(query, (item_name,), fetch_one=True)
            return item
        except Exception as e:
            logger.error(f"Error getting item {item_name}: {e}")
            return None
    
    @staticmethod
    def add_item(item_name: str, quantity: int) -> Tuple[bool, str, Optional[Dict]]:
        """
        Add quantity to an existing item or create new item
        Returns: (success, message, item_data)
        """
        try:
            # Check if item exists
            existing = InventoryService.get_item(item_name)
            
            with get_db_cursor() as cursor:
                if existing:
                    # Update existing item
                    new_quantity = existing['quantity'] + quantity
                    cursor.execute("""
                        UPDATE inventory 
                        SET quantity = ? 
                        WHERE id = ?
                    """, (new_quantity, existing['id']))
                    
                    # Log transaction
                    cursor.execute("""
                        INSERT INTO transaction_log 
                        (action, item_id, item_name, quantity_change, previous_quantity, new_quantity)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, ('add', existing['id'], item_name, quantity, existing['quantity'], new_quantity))
                    
                    item = InventoryService.get_item(item_name)
                    message = MESSAGES['ITEM_ADDED'].format(quantity=quantity, item=item_name)
                    logger.info(f"Added {quantity} to existing item: {item_name}")
                    
                else:
                    # Create new item
                    cursor.execute("""
                        INSERT INTO inventory (name, quantity) 
                        VALUES (?, ?)
                    """, (item_name, quantity))
                    
                    item_id = cursor.lastrowid
                    
                    # Log transaction
                    cursor.execute("""
                        INSERT INTO transaction_log 
                        (action, item_id, item_name, quantity_change, new_quantity)
                        VALUES (?, ?, ?, ?, ?)
                    """, ('add', item_id, item_name, quantity, quantity))
                    
                    item = InventoryService.get_item(item_name)
                    message = MESSAGES['ITEM_ADDED'].format(quantity=quantity, item=item_name)
                    logger.info(f"Created new item: {item_name} with quantity {quantity}")
                
                return True, message, item
                
        except Exception as e:
            logger.error(f"Error adding item {item_name}: {e}")
            return False, f"Error adding item: {str(e)}", None
    
    @staticmethod
    def remove_item(item_name: str, quantity: int) -> Tuple[bool, str, Optional[Dict]]:
        """Remove quantity from an item"""
        try:
            existing = InventoryService.get_item(item_name)
            
            if not existing:
                message = MESSAGES['ITEM_NOT_FOUND'].format(item=item_name)
                logger.warning(f"Item not found: {item_name}")
                return False, message, None
            
            if existing['quantity'] < quantity:
                message = MESSAGES['INSUFFICIENT_STOCK'].format(
                    item=item_name, 
                    available=existing['quantity']
                )
                logger.warning(f"Insufficient stock for {item_name}")
                return False, message, None
            
            new_quantity = existing['quantity'] - quantity
            
            with get_db_cursor() as cursor:
                cursor.execute("""
                    UPDATE inventory 
                    SET quantity = ? 
                    WHERE id = ?
                """, (new_quantity, existing['id']))
                
                # Log transaction
                cursor.execute("""
                    INSERT INTO transaction_log 
                    (action, item_id, item_name, quantity_change, previous_quantity, new_quantity)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, ('remove', existing['id'], item_name, -quantity, existing['quantity'], new_quantity))
            
            item = InventoryService.get_item(item_name)
            message = MESSAGES['ITEM_REMOVED'].format(quantity=quantity, item=item_name)
            logger.info(f"Removed {quantity} from {item_name}")
            
            # Check for low stock
            if new_quantity < InventoryService.LOW_STOCK_THRESHOLD and new_quantity > 0:
                logger.warning(MESSAGES['LOW_STOCK_ALERT'].format(item=item_name, quantity=new_quantity))
            
            return True, message, item
            
        except Exception as e:
            logger.error(f"Error removing item {item_name}: {e}")
            return False, f"Error removing item: {str(e)}", None
    
    @staticmethod
    def update_item(item_name: str, new_quantity: int) -> Tuple[bool, str, Optional[Dict]]:
        """Update item to exact quantity"""
        try:
            existing = InventoryService.get_item(item_name)
            
            if not existing:
                message = MESSAGES['ITEM_NOT_FOUND'].format(item=item_name)
                logger.warning(f"Item not found: {item_name}")
                return False, message, None
            
            if new_quantity < 0:
                return False, "Quantity cannot be negative", None
            
            with get_db_cursor() as cursor:
                cursor.execute("""
                    UPDATE inventory 
                    SET quantity = ? 
                    WHERE id = ?
                """, (new_quantity, existing['id']))
                
                # Log transaction
                cursor.execute("""
                    INSERT INTO transaction_log 
                    (action, item_id, item_name, quantity_change, previous_quantity, new_quantity)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, ('update', existing['id'], item_name, new_quantity - existing['quantity'], 
                      existing['quantity'], new_quantity))
            
            item = InventoryService.get_item(item_name)
            message = MESSAGES['ITEM_UPDATED'].format(item=item_name, quantity=new_quantity)
            logger.info(f"Updated {item_name} to quantity {new_quantity}")
            
            return True, message, item
            
        except Exception as e:
            logger.error(f"Error updating item {item_name}: {e}")
            return False, f"Error updating item: {str(e)}", None
    
    @staticmethod
    def get_low_stock_items(threshold: int = None) -> List[Dict]:
        """Get items with quantity below threshold"""
        if threshold is None:
            threshold = InventoryService.LOW_STOCK_THRESHOLD
            
        try:
            query = """
                SELECT * FROM inventory 
                WHERE quantity > 0 AND quantity < ? 
                ORDER BY quantity ASC
            """
            items = execute_query(query, (threshold,), fetch_all=True)
            logger.info(f"Found {len(items)} low stock items")
            return items
        except Exception as e:
            logger.error(f"Error getting low stock items: {e}")
            return []
    
    @staticmethod
    def get_out_of_stock_items() -> List[Dict]:
        """Get items with zero quantity"""
        try:
            query = "SELECT * FROM inventory WHERE quantity = 0 ORDER BY name"
            items = execute_query(query, fetch_all=True)
            logger.info(f"Found {len(items)} out of stock items")
            return items
        except Exception as e:
            logger.error(f"Error getting out of stock items: {e}")
            return []
    
    @staticmethod
    def get_inventory_stats() -> InventoryStats:
        """Get inventory statistics"""
        try:
            items = InventoryService.get_all_items()
            
            total_items = len(items)
            total_quantity = sum(item['quantity'] for item in items)
            low_stock = len([i for i in items if 0 < i['quantity'] < InventoryService.LOW_STOCK_THRESHOLD])
            out_of_stock = len([i for i in items if i['quantity'] == 0])
            
            # Simple category detection (based on item name patterns)
            categories = {}
            for item in items:
                # Extract category from item name (simplified)
                name = item['name'].lower()
                if any(electron in name for electron in ['laptop', 'mouse', 'keyboard', 'monitor']):
                    cat = 'Electronics'
                elif any(accessory in name for accessory in ['cable', 'adapter', 'connector']):
                    cat = 'Accessories'
                else:
                    cat = 'Other'
                
                categories[cat] = categories.get(cat, 0) + 1
            
            return InventoryStats(
                total_items=total_items,
                total_quantity=total_quantity,
                low_stock_count=low_stock,
                out_of_stock_count=out_of_stock,
                categories=categories
            )
            
        except Exception as e:
            logger.error(f"Error getting inventory stats: {e}")
            return InventoryStats(0, 0, 0, 0, {})
    
    @staticmethod
    def search_items(search_term: str) -> List[Dict]:
        """Search items by name"""
        try:
            query = """
                SELECT * FROM inventory 
                WHERE LOWER(name) LIKE LOWER(?) 
                ORDER BY name
            """
            items = execute_query(query, (f'%{search_term}%',), fetch_all=True)
            logger.info(f"Found {len(items)} items matching '{search_term}'")
            return items
        except Exception as e:
            logger.error(f"Error searching items: {e}")
            return []
    
    @staticmethod
    def get_transaction_log(limit: int = 50) -> List[Dict]:
        """Get recent transaction logs"""
        try:
            query = """
                SELECT * FROM transaction_log 
                ORDER BY timestamp DESC 
                LIMIT ?
            """
            logs = execute_query(query, (limit,), fetch_all=True)
            return logs
        except Exception as e:
            logger.error(f"Error getting transaction logs: {e}")
            return []

# Convenience functions
def get_inventory():
    return InventoryService.get_all_items()

def add_inventory_item(item, quantity):
    return InventoryService.add_item(item, quantity)

def remove_inventory_item(item, quantity):
    return InventoryService.remove_item(item, quantity)

def update_inventory_item(item, quantity):
    return InventoryService.update_item(item, quantity)
