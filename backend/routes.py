from flask import Blueprint, request, jsonify
import logging
from typing import Dict, Any

from shared.constants import STATUS, MESSAGES
from shared.models import ApiResponse, ParsedCommand
from speech_to_text import speech_to_text, process_text_command
from command_parser import parse_command
from inventory_service import InventoryService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create blueprint
api_bp = Blueprint('api', __name__, url_prefix='/api')

@api_bp.route('/voice-command', methods=['POST'])
def handle_voice_command():
    """
    Handle voice/text commands
    Expected JSON: {"text": "command"} or {"audio": "base64_audio"}
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify(ApiResponse(
                status=STATUS['ERROR'],
                message="No data provided"
            ).to_dict()), 400
        
        # Process input (text or audio)
        command_text = None
        if 'text' in data:
            command_text = process_text_command(data['text'])
            logger.info(f"Processing text command: {command_text}")
        elif 'audio' in data:
            # In production, save audio file and process
            command_text = speech_to_text()  # Mock for now
            logger.info(f"Processed audio to text: {command_text}")
        else:
            return jsonify(ApiResponse(
                status=STATUS['ERROR'],
                message="No text or audio provided"
            ).to_dict()), 400
        
        # Parse the command
        parsed: ParsedCommand = parse_command(command_text)
        
        if not parsed:
            return jsonify(ApiResponse(
                status=STATUS['ERROR'],
                message=MESSAGES['INVALID_COMMAND'].format(command=command_text)
            ).to_dict()), 400
        
        # Execute based on action
        result = execute_inventory_action(parsed)
        
        # Add parsed command to response data
        response_data = {
            'recognized_text': command_text,
            'parsed_command': {
                'action': parsed.action,
                'item': parsed.item,
                'quantity': parsed.quantity
            },
            'result': result.get('data')
        }
        
        return jsonify(ApiResponse(
            status=STATUS['SUCCESS'],
            message=result.get('message', 'Command processed successfully'),
            data=response_data
        ).to_dict()), 200
        
    except Exception as e:
        logger.error(f"Error processing voice command: {e}")
        return jsonify(ApiResponse(
            status=STATUS['ERROR'],
            message=f"Server error: {str(e)}"
        ).to_dict()), 500

@api_bp.route('/inventory', methods=['GET'])
def get_inventory():
    """Get all inventory items"""
    try:
        items = InventoryService.get_all_items()
        
        # Add status to each item
        for item in items:
            if item['quantity'] <= 0:
                item['status'] = 'out-of-stock'
            elif item['quantity'] < InventoryService.LOW_STOCK_THRESHOLD:
                item['status'] = 'low-stock'
            else:
                item['status'] = 'in-stock'
        
        return jsonify(ApiResponse(
            status=STATUS['SUCCESS'],
            message=f"Retrieved {len(items)} items",
            data=items
        ).to_dict()), 200
        
    except Exception as e:
        logger.error(f"Error getting inventory: {e}")
        return jsonify(ApiResponse(
            status=STATUS['ERROR'],
            message=MESSAGES['DB_ERROR']
        ).to_dict()), 500

@api_bp.route('/inventory/add', methods=['POST'])
def add_inventory():
    """Add item to inventory"""
    try:
        data = request.get_json()
        
        if not data or 'item' not in data or 'quantity' not in data:
            return jsonify(ApiResponse(
                status=STATUS['ERROR'],
                message="Missing item or quantity"
            ).to_dict()), 400
        
        item_name = data['item']
        quantity = int(data['quantity'])
        
        if quantity <= 0:
            return jsonify(ApiResponse(
                status=STATUS['ERROR'],
                message="Quantity must be positive"
            ).to_dict()), 400
        
        success, message, item = InventoryService.add_item(item_name, quantity)
        
        if success:
            return jsonify(ApiResponse(
                status=STATUS['SUCCESS'],
                message=message,
                data=item
            ).to_dict()), 200
        else:
            return jsonify(ApiResponse(
                status=STATUS['ERROR'],
                message=message
            ).to_dict()), 400
            
    except ValueError as e:
        return jsonify(ApiResponse(
            status=STATUS['ERROR'],
            message="Invalid quantity format"
        ).to_dict()), 400
    except Exception as e:
        logger.error(f"Error adding inventory: {e}")
        return jsonify(ApiResponse(
            status=STATUS['ERROR'],
            message=MESSAGES['DB_ERROR']
        ).to_dict()), 500

@api_bp.route('/inventory/remove', methods=['POST'])
def remove_inventory():
    """Remove item from inventory"""
    try:
        data = request.get_json()
        
        if not data or 'item' not in data or 'quantity' not in data:
            return jsonify(ApiResponse(
                status=STATUS['ERROR'],
                message="Missing item or quantity"
            ).to_dict()), 400
        
        item_name = data['item']
        quantity = int(data['quantity'])
        
        if quantity <= 0:
            return jsonify(ApiResponse(
                status=STATUS['ERROR'],
                message="Quantity must be positive"
            ).to_dict()), 400
        
        success, message, item = InventoryService.remove_item(item_name, quantity)
        
        if success:
            return jsonify(ApiResponse(
                status=STATUS['SUCCESS'],
                message=message,
                data=item
            ).to_dict()), 200
        else:
            return jsonify(ApiResponse(
                status=STATUS['ERROR'],
                message=message
            ).to_dict()), 400
            
    except ValueError:
        return jsonify(ApiResponse(
            status=STATUS['ERROR'],
            message="Invalid quantity format"
        ).to_dict()), 400
    except Exception as e:
        logger.error(f"Error removing inventory: {e}")
        return jsonify(ApiResponse(
            status=STATUS['ERROR'],
            message=MESSAGES['DB_ERROR']
        ).to_dict()), 500

@api_bp.route('/inventory/update', methods=['PUT', 'POST'])
def update_inventory():
    """Update inventory item"""
    try:
        data = request.get_json()
        
        if not data or 'item' not in data or 'quantity' not in data:
            return jsonify(ApiResponse(
                status=STATUS['ERROR'],
                message="Missing item or quantity"
            ).to_dict()), 400
        
        item_name = data['item']
        quantity = int(data['quantity'])
        
        if quantity < 0:
            return jsonify(ApiResponse(
                status=STATUS['ERROR'],
                message="Quantity cannot be negative"
            ).to_dict()), 400
        
        success, message, item = InventoryService.update_item(item_name, quantity)
        
        if success:
            return jsonify(ApiResponse(
                status=STATUS['SUCCESS'],
                message=message,
                data=item
            ).to_dict()), 200
        else:
            return jsonify(ApiResponse(
                status=STATUS['ERROR'],
                message=message
            ).to_dict()), 400
            
    except ValueError:
        return jsonify(ApiResponse(
            status=STATUS['ERROR'],
            message="Invalid quantity format"
        ).to_dict()), 400
    except Exception as e:
        logger.error(f"Error updating inventory: {e}")
        return jsonify(ApiResponse(
            status=STATUS['ERROR'],
            message=MESSAGES['DB_ERROR']
        ).to_dict()), 500

@api_bp.route('/inventory/search', methods=['GET'])
def search_inventory():
    """Search inventory items"""
    try:
        search_term = request.args.get('q', '')
        
        if not search_term:
            return jsonify(ApiResponse(
                status=STATUS['ERROR'],
                message="Search term required"
            ).to_dict()), 400
        
        items = InventoryService.search_items(search_term)
        
        return jsonify(ApiResponse(
            status=STATUS['SUCCESS'],
            message=f"Found {len(items)} items",
            data=items
        ).to_dict()), 200
        
    except Exception as e:
        logger.error(f"Error searching inventory: {e}")
        return jsonify(ApiResponse(
            status=STATUS['ERROR'],
            message=MESSAGES['DB_ERROR']
        ).to_dict()), 500

@api_bp.route('/inventory/low-stock', methods=['GET'])
def get_low_stock():
    """Get low stock items"""
    try:
        threshold = request.args.get('threshold', default=5, type=int)
        items = InventoryService.get_low_stock_items(threshold)
        
        return jsonify(ApiResponse(
            status=STATUS['SUCCESS'],
            message=f"Found {len(items)} low stock items",
            data=items
        ).to_dict()), 200
        
    except Exception as e:
        logger.error(f"Error getting low stock: {e}")
        return jsonify(ApiResponse(
            status=STATUS['ERROR'],
            message=MESSAGES['DB_ERROR']
        ).to_dict()), 500

@api_bp.route('/inventory/stats', methods=['GET'])
def get_stats():
    """Get inventory statistics"""
    try:
        stats = InventoryService.get_inventory_stats()
        
        return jsonify(ApiResponse(
            status=STATUS['SUCCESS'],
            message="Statistics retrieved",
            data=stats.to_dict()
        ).to_dict()), 200
        
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        return jsonify(ApiResponse(
            status=STATUS['ERROR'],
            message=MESSAGES['DB_ERROR']
        ).to_dict()), 500

@api_bp.route('/inventory/transactions', methods=['GET'])
def get_transactions():
    """Get recent transactions"""
    try:
        limit = request.args.get('limit', default=50, type=int)
        logs = InventoryService.get_transaction_log(limit)
        
        return jsonify(ApiResponse(
            status=STATUS['SUCCESS'],
            message=f"Retrieved {len(logs)} transactions",
            data=logs
        ).to_dict()), 200
        
    except Exception as e:
        logger.error(f"Error getting transactions: {e}")
        return jsonify(ApiResponse(
            status=STATUS['ERROR'],
            message=MESSAGES['DB_ERROR']
        ).to_dict()), 500

@api_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'message': 'Voice Inventory Agent API is running'
    }), 200

def execute_inventory_action(parsed: ParsedCommand) -> Dict[str, Any]:
    """Execute inventory action based on parsed command"""
    if parsed.action == 'add':
        success, message, data = InventoryService.add_item(parsed.item, parsed.quantity)
    elif parsed.action == 'remove':
        success, message, data = InventoryService.remove_item(parsed.item, parsed.quantity)
    elif parsed.action == 'update':
        success, message, data = InventoryService.update_item(parsed.item, parsed.quantity)
    elif parsed.action == 'check':
        data = InventoryService.get_item(parsed.item)
        if data:
            message = f"{parsed.item} has {data['quantity']} units"
            success = True
        else:
            message = MESSAGES['ITEM_NOT_FOUND'].format(item=parsed.item)
            success = False
    elif parsed.action == 'list':
        data = InventoryService.get_all_items()
        message = f"Found {len(data)} items"
        success = True
    else:
        message = MESSAGES['INVALID_ACTION'].format(action=parsed.action)
        success = False
        data = None
    
    return {
        'success': success,
        'message': message,
        'data': data
    }