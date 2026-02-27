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
        try:
            query = "SELECT * FROM inventory ORDER BY updated_at DESC, id DESC"
            items = execute_query(query, fetch_all=True)
            return items or []
        except Exception as e:
            logger.error(f"Error getting all items: {e}")
            return []

    @staticmethod
    def get_item(item_name: str) -> Optional[Dict]:
        try:
            query = "SELECT * FROM inventory WHERE LOWER(name) = LOWER(?)"
            return execute_query(query, (item_name,), fetch_one=True)
        except Exception as e:
            logger.error(f"Error getting item {item_name}: {e}")
            return None

    @staticmethod
    def add_item(item_name: str, quantity: int) -> Tuple[bool, str, Optional[Dict]]:
        try:
            existing = InventoryService.get_item(item_name)
            now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

            with get_db_cursor() as cursor:
                if existing:
                    new_quantity = existing['quantity'] + quantity
                    cursor.execute(
                        "UPDATE inventory SET quantity=?, updated_at=? WHERE id=?",
                        (new_quantity, now, existing['id'])
                    )

                    cursor.execute("""
                        INSERT INTO transaction_log
                        (action, item_id, item_name, quantity_change, previous_quantity, new_quantity)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, ('add', existing['id'], item_name, quantity, existing['quantity'], new_quantity))

                else:
                    cursor.execute(
                        "INSERT INTO inventory (name, quantity, updated_at) VALUES (?, ?, ?)",
                        (item_name, quantity, now)
                    )
                    item_id = cursor.lastrowid

                    cursor.execute("""
                        INSERT INTO transaction_log
                        (action, item_id, item_name, quantity_change, new_quantity)
                        VALUES (?, ?, ?, ?, ?)
                    """, ('add', item_id, item_name, quantity, quantity))

            item = InventoryService.get_item(item_name)
            return True, MESSAGES['ITEM_ADDED'].format(quantity=quantity, item=item_name), item

        except Exception as e:
            logger.error(f"Error adding item {item_name}: {e}")
            return False, f"Error adding item: {str(e)}", None

    @staticmethod
    def remove_item(item_name: str, quantity: int) -> Tuple[bool, str, Optional[Dict]]:
        try:
            existing = InventoryService.get_item(item_name)
            if not existing:
                return False, MESSAGES['ITEM_NOT_FOUND'].format(item=item_name), None

            if existing['quantity'] < quantity:
                return False, MESSAGES['INSUFFICIENT_STOCK'].format(item=item_name, available=existing['quantity']), None

            new_quantity = existing['quantity'] - quantity
            now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

            with get_db_cursor() as cursor:
                cursor.execute(
                    "UPDATE inventory SET quantity=?, updated_at=? WHERE id=?",
                    (new_quantity, now, existing['id'])
                )

                cursor.execute("""
                    INSERT INTO transaction_log
                    (action, item_id, item_name, quantity_change, previous_quantity, new_quantity)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, ('remove', existing['id'], item_name, -quantity, existing['quantity'], new_quantity))

            item = InventoryService.get_item(item_name)
            return True, MESSAGES['ITEM_REMOVED'].format(quantity=quantity, item=item_name), item

        except Exception as e:
            logger.error(f"Error removing item {item_name}: {e}")
            return False, f"Error removing item: {str(e)}", None

    @staticmethod
    def update_item(item_name: str, new_quantity: int) -> Tuple[bool, str, Optional[Dict]]:
        try:
            existing = InventoryService.get_item(item_name)
            if not existing:
                return False, MESSAGES['ITEM_NOT_FOUND'].format(item=item_name), None

            now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

            with get_db_cursor() as cursor:
                cursor.execute(
                    "UPDATE inventory SET quantity=?, updated_at=? WHERE id=?",
                    (new_quantity, now, existing['id'])
                )

                cursor.execute("""
                    INSERT INTO transaction_log
                    (action, item_id, item_name, quantity_change, previous_quantity, new_quantity)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, ('update', existing['id'], item_name, new_quantity - existing['quantity'], existing['quantity'], new_quantity))

            item = InventoryService.get_item(item_name)
            return True, MESSAGES['ITEM_UPDATED'].format(item=item_name, quantity=new_quantity), item

        except Exception as e:
            logger.error(f"Error updating item {item_name}: {e}")
            return False, f"Error updating item: {str(e)}", None

    @staticmethod
    def get_low_stock_items(threshold: int = None) -> List[Dict]:
        threshold = threshold or InventoryService.LOW_STOCK_THRESHOLD
        try:
            return execute_query(
                "SELECT * FROM inventory WHERE quantity > 0 AND quantity < ? ORDER BY quantity ASC",
                (threshold,), fetch_all=True
            )
        except Exception as e:
            logger.error(f"Error getting low stock items: {e}")
            return []

    @staticmethod
    def get_out_of_stock_items() -> List[Dict]:
        try:
            return execute_query("SELECT * FROM inventory WHERE quantity = 0 ORDER BY name", fetch_all=True)
        except Exception as e:
            logger.error(f"Error getting out of stock items: {e}")
            return []

    @staticmethod
    def clear_all_inventory() -> Tuple[bool, str]:
        try:
            with get_db_cursor() as cursor:
                cursor.execute("DELETE FROM transaction_log")
                cursor.execute("DELETE FROM inventory")

            logger.warning("All inventory items cleared")
            return True, "All inventory items have been cleared"

        except Exception as e:
            logger.error(f"Error clearing inventory: {e}")
            return False, f"Error clearing inventory: {str(e)}"

    @staticmethod
    def delete_item_by_id(item_id: int) -> None:
        try:
            with get_db_cursor() as cursor:
                cursor.execute("SELECT name, quantity FROM inventory WHERE id=?", (item_id,))
                item = cursor.fetchone()

                if not item:
                    raise Exception("Item not found")

                item_name, quantity = item['name'], item['quantity']

                cursor.execute("DELETE FROM inventory WHERE id=?", (item_id,))

                cursor.execute("""
                    INSERT INTO transaction_log
                    (action, item_name, quantity_change, new_quantity)
                    VALUES (?, ?, ?, ?)
                """, ('delete', item_name, -quantity, 0))

                logger.info(f"Deleted item {item_name}")

        except Exception as e:
            logger.error(f"Error deleting item: {e}")
            raise Exception(str(e))


# Convenience functions
def get_inventory():
    return InventoryService.get_all_items()


def add_inventory_item(item, quantity):
    return InventoryService.add_item(item, quantity)


def remove_inventory_item(item, quantity):
    return InventoryService.remove_item(item, quantity)


def update_inventory_item(item, quantity):
    return InventoryService.update_item(item, quantity)