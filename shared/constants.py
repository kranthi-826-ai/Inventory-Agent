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
    'ITEM_NOT_FOUND': 'Item {item} not found in inventory',
    'INSUFFICIENT_STOCK': 'Insufficient stock for {item}. Available: {available}',
    'INVALID_ACTION': 'Invalid action: {action}',
    'INVALID_COMMAND': 'Could not parse command: {command}',
    'LOW_STOCK_ALERT': 'Low stock alert: {item} has only {quantity} left',
    'DB_ERROR': 'Database error occurred',
    'VOICE_PROCESSED': 'Voice command processed successfully'
}

# Multilingual action keywords
ACTION_KEYWORDS = {
    'add': ['add', 'put', 'insert', 'ఆడ్', 'చెయ్', 'పెట్టు', 'जोड़ो', 'डालो', 'रखो'],
    'remove': ['remove', 'delete', 'take', 'తీసేయ', 'తీయ', 'తొలగించు', 'हटाओ', 'निकालो', 'ले लो'],
    'update': ['update', 'change', 'set', 'అప్డేట్', 'మార్చు', 'सेट', 'बदलो', 'अपडेट'],
    'check': ['check', 'how many', 'quantity of', 'చెక్', 'ఎంత', 'चेक', 'कितना', 'मात्रा'],
    'list': ['list', 'show', 'get', 'లిస్ట్', 'చూపించు', 'सूची', 'दिखाओ', 'लिस्ट']
}

# Multilingual stop words
STOP_WORDS = {
    'en': ['and', 'also', 'the', 'a', 'an', 'of', 'in', 'to', 'for', 'with', 'please', 'can', 'you', 'i', 'want', 'need', 'successfully', 'under', 'forest', 'packets', 'packet', 'bags', 'bag'],
    'te': ['మరియు', 'కూడా', 'ఉంది', 'అయితే', 'అయిందా', 'ప్యాకెట్లు', 'ప్యాకెట్', 'బ్యాగ్స్', 'బ్యాగ్'],
    'hi': ['और', 'भी', 'का', 'की', 'के', 'से', 'में', 'पैकेट', 'बैग']
}

# Command regex patterns - FIXED: single backslashes for proper regex
COMMAND_PATTERNS = {
    'add': r'(?:\d+)(?:.add|put|insert|ఆడ్|చెయ్|పెట్టు|जोड़ो|डालो)\s+(\d+)\s+(?:bags?|units?|pcs?|pieces?|kg|grams?|ప్యాకెట్లు|पैकेट)?\s*(?:of\s+)?(.+)',
    'remove': r'(?:\d+)(?:.remove|delete|take|తీసేయ|తొలగించు|हटाओ|निकालो)\s+(\d+)\s+(?:bags?|units?|pcs?|pieces?|kg|grams?|ప్యాకెట్లు|पैकेट)?\s*(?:of\s+)?(.+)',
    'update': r'(?:\d+)(?:.update|change|set|అప్డేట్|మార్చు|सेट|बदलो)\s+(.+?)\s+(?:to|quantity to|to quantity|కు|को)\s+(\d+)',
    'check': r'(?:\d+)(?:.check|how many|quantity of|చెక్|ఎంత|चेक|कितना)\s+(.+)',
    'list': r'(?:\d+)(?:.list|show|get|లిస్ట్|చూపించు|सूची|दिखाओ)\s+(?:all|inventory)'
}
