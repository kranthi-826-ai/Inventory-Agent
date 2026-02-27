# Action types supported by the system
ACTIONS = {
    'ADD': 'add',
    'REMOVE': 'remove', 
    'UPDATE': 'update',
    'CHECK': 'check',
    'LIST': 'list'
}

# Status codes for API responses
STATUS = {
    'SUCCESS': 'success',
    'ERROR': 'error',
    'PENDING': 'pending'
}

# Messages templates
MESSAGES = {
    'ITEM_ADDED': 'Successfully added {quantity} {item}(s) to inventory',
    'ITEM_REMOVED': 'Successfully removed {quantity} {item}(s) from inventory',
    'ITEM_UPDATED': 'Successfully updated {item} quantity to {quantity}',
    'ITEM_NOT_FOUND': 'Item "{item}" not found in inventory',
    'INSUFFICIENT_STOCK': 'Insufficient stock for {item}. Available: {available}',
    'INVALID_ACTION': 'Invalid action: {action}',
    'INVALID_COMMAND': 'Could not parse command: {command}',
    'LOW_STOCK_ALERT': 'Low stock alert: {item} has only {quantity} left',
    'DB_ERROR': 'Database error occurred',
    'VOICE_PROCESSED': 'Voice command processed successfully'
}

# Command regex patterns
COMMAND_PATTERNS = {
    'add': r'(?i)(?:add|put|insert)\s+(\d+)\s+(.+)',
    'remove': r'(?i)(?:remove|delete|take)\s+(\d+)\s+(.+)',
    'update': r'(?i)(?:update|change|set)\s+(.+)\s+to\s+(\d+)',
    'check': r'(?i)(?:check|how many|quantity of)\s+(.+)',
    'list': r'(?i)(?:list|show|get)\s+(?:all|inventory)'
}