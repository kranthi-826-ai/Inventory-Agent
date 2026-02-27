import re
import logging
from typing import Optional, Tuple, Dict
from shared.constants import COMMAND_PATTERNS, ACTIONS
from shared.models import ParsedCommand

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CommandParser:
    """Parse natural language commands into structured data"""
    
    @staticmethod
    def parse(text: str) -> Optional[ParsedCommand]:
        """
        Parse a text command into action, item, and quantity
        Returns ParsedCommand object or None if parsing fails
        """
        if not text or not text.strip():
            logger.warning("Empty command received")
            return None
        
        text = text.strip().lower()
        logger.info(f"Parsing command: {text}")
        
        # Try each action pattern
        for action, pattern in COMMAND_PATTERNS.items():
            match = re.match(pattern, text)
            if match:
                return CommandParser._create_parsed_command(action, match, text)
        
        # If no pattern matches, try to extract using flexible parsing
        return CommandParser._flexible_parse(text)
    
    @staticmethod
    def _create_parsed_command(action: str, match: re.Match, raw_text: str) -> ParsedCommand:
        """Create ParsedCommand from regex match"""
        groups = match.groups()
        
        if action in ['add', 'remove']:
            # Pattern: action quantity item
            quantity = int(groups[0])
            item = groups[1].strip()
            return ParsedCommand(
                action=action,
                item=item,
                quantity=quantity,
                raw_text=raw_text
            )
        
        elif action == 'update':
            # Pattern: update item to quantity
            item = groups[0].strip()
            quantity = int(groups[1])
            return ParsedCommand(
                action=action,
                item=item,
                quantity=quantity,
                raw_text=raw_text
            )
        
        elif action == 'check':
            # Pattern: check item
            item = groups[0].strip()
            return ParsedCommand(
                action=action,
                item=item,
                quantity=0,
                raw_text=raw_text
            )
        
        elif action == 'list':
            # Pattern: list all inventory
            return ParsedCommand(
                action=ACTIONS['LIST'],
                item='all',
                quantity=0,
                raw_text=raw_text
            )
        
        return None
    
    @staticmethod
    def _flexible_parse(text: str) -> Optional[ParsedCommand]:
        """Flexible parsing for commands that don't match exact patterns"""
        words = text.split()
        
        # Look for action words
        action_map = {
            'add': ACTIONS['ADD'],
            'put': ACTIONS['ADD'],
            'insert': ACTIONS['ADD'],
            'remove': ACTIONS['REMOVE'],
            'delete': ACTIONS['REMOVE'],
            'take': ACTIONS['REMOVE'],
            'update': ACTIONS['UPDATE'],
            'change': ACTIONS['UPDATE'],
            'set': ACTIONS['UPDATE'],
            'check': ACTIONS['CHECK'],
            'how': ACTIONS['CHECK'],
            'list': ACTIONS['LIST'],
            'show': ACTIONS['LIST']
        }
        
        # Find action
        action = None
        for word in words:
            if word in action_map:
                action = action_map[word]
                break
        
        if not action:
            logger.warning(f"No action found in command: {text}")
            return None
        
        # Extract quantity (look for numbers)
        quantity = 0
        for word in words:
            if word.isdigit():
                quantity = int(word)
                break
        
        # Extract item (everything after action and number)
        item_parts = []
        skip_next = False
        for i, word in enumerate(words):
            if skip_next:
                skip_next = False
                continue
            
            # Skip action words
            if word in action_map:
                continue
            
            # Skip numbers (they're quantity)
            if word.isdigit():
                continue
            
            # Handle "how many" pattern
            if word == 'how' and i+1 < len(words) and words[i+1] == 'many':
                skip_next = True
                continue
            
            # Handle "quantity of" pattern
            if word == 'quantity' and i+1 < len(words) and words[i+1] == 'of':
                skip_next = True
                continue
            
            item_parts.append(word)
        
        item = ' '.join(item_parts).strip() if item_parts else 'unknown'
        
        # For check actions, if no specific item, assume they want all
        if action == ACTIONS['CHECK'] and (not item or item == 'unknown'):
            action = ACTIONS['LIST']
            item = 'all'
        
        return ParsedCommand(
            action=action,
            item=item,
            quantity=quantity if quantity > 0 else 1,
            raw_text=text,
            confidence=0.7  # Lower confidence for flexible parsing
        )

# Convenience function
def parse_command(text: str) -> Optional[ParsedCommand]:
    """Main function to parse commands"""
    return CommandParser.parse(text)

# Test the parser
if __name__ == "__main__":
    test_commands = [
        "add 10 apples",
        "remove 5 bananas",
        "update oranges to 20",
        "check inventory",
        "how many laptops do we have",
        "list all items",
        "show me the inventory"
    ]
    
    for cmd in test_commands:
        result = parse_command(cmd)
        if result:
            print(f"✓ {cmd:30} → {result}")
        else:
            print(f"✗ {cmd:30} → Failed to parse")