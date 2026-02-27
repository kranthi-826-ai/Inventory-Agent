import re
import logging
from typing import Optional

from shared.constants import ACTIONS
from shared.models import ParsedCommand

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Stop words to ignore when extracting item names
STOP_WORDS = {'and', 'also', 'the', 'a', 'an', 'of', 'in', 'to', 'for', 'with', 'please', 'can', 'you', 'i', 'want', 'need', 'successfully', 'under', 'forest', 'packets', 'packet'}

class CommandParser:
    """Parse natural language commands into structured data"""
    
    @staticmethod
    def parse(text: str) -> Optional[ParsedCommand]:
        """
        Parse a text command into action, item, and quantity.
        Returns ParsedCommand object or None if parsing fails.
        """
        if not text or not text.strip():
            return None
        
        text = text.strip().lower()
        logger.info(f"Parsing command: {text}")
        
        # Try structured patterns first
        parsed = CommandParser._try_structured_parse(text)
        if parsed:
            return parsed
        
        # Fall back to flexible parsing
        return CommandParser._flexible_parse(text)
    
    @staticmethod
    def _try_structured_parse(text: str) -> Optional[ParsedCommand]:
        """Try to parse using strict patterns"""
        
        # Pattern 1: "add 10 bags of rice" or "add 10 rice"
        match = re.match(r'(?:add|put|insert)\s+(\d+)\s+(?:bags?|units?|pcs?|pieces?|kg|grams?)?\s*(?:of\s+)?([a-z\s]+?)(?:\s+and|\s+also|$)', text)
        if match:
            quantity = int(match.group(1))
            item = CommandParser._clean_item_name(match.group(2))
            return ParsedCommand(
                action='add',
                item=item,
                quantity=quantity,
                raw_text=text,
                confidence=1.0
            )
        
        # Pattern 2: "remove 5 rice" or "remove 5 bags of rice"
        match = re.match(r'(?:remove|delete|take)\s+(\d+)\s+(?:bags?|units?|pcs?)?\s*(?:of\s+)?([a-z\s]+?)(?:\s+and|\s+also|$)', text)
        if match:
            quantity = int(match.group(1))
            item = CommandParser._clean_item_name(match.group(2))
            return ParsedCommand(
                action='remove',
                item=item,
                quantity=quantity,
                raw_text=text,
                confidence=1.0
            )
        
        # Pattern 3: "update rice to 20" or "set rice quantity to 20"
        match = re.match(r'(?:update|change|set)\s+([a-z\s]+?)\s+(?:quantity\s+)?to\s+(\d+)', text)
        if match:
            item = CommandParser._clean_item_name(match.group(1))
            quantity = int(match.group(2))
            return ParsedCommand(
                action='update',
                item=item,
                quantity=quantity,
                raw_text=text,
                confidence=1.0
            )
        
        # Pattern 4: "check rice" or "how many rice"
        match = re.match(r'(?:check|how\s+many|quantity\s+of)\s+([a-z\s]+)', text)
        if match:
            item = CommandParser._clean_item_name(match.group(1))
            return ParsedCommand(
                action='check',
                item=item,
                quantity=0,
                raw_text=text,
                confidence=1.0
            )
        
        # Pattern 5: "list all" or "show inventory"
        if re.match(r'(?:list|show|get)\s+(?:all|inventory)', text):
            return ParsedCommand(
                action='list',
                item='all',
                quantity=0,
                raw_text=text,
                confidence=1.0
            )
        
        return None
    
    @staticmethod
    def _clean_item_name(raw_item: str) -> str:
        """Clean and normalize item name by removing stop words and extra spaces"""
        words = raw_item.strip().split()
        # Remove stop words and clean
        cleaned = [w for w in words if w.lower() not in STOP_WORDS and w.strip()]
        return ' '.join(cleaned).strip() if cleaned else raw_item.strip()
    
    @staticmethod
    def _flexible_parse(text: str) -> Optional[ParsedCommand]:
        """Fallback parser for less structured commands"""
        words = text.split()
        
        # Find action
        action_map = {
            'add': 'add', 'put': 'add', 'insert': 'add',
            'remove': 'remove', 'delete': 'remove', 'take': 'remove',
            'update': 'update', 'change': 'update', 'set': 'update',
            'check': 'check', 'how': 'check',
            'list': 'list', 'show': 'list'
        }
        
        action = None
        action_idx = -1
        for i, word in enumerate(words):
            if word in action_map:
                action = action_map[word]
                action_idx = i
                break
        
        if not action:
            return None
        
        # Extract quantity
        quantity = 0
        quantity_idx = -1
        for i, word in enumerate(words):
            if word.isdigit():
                quantity = int(word)
                quantity_idx = i
                break
        
        # Extract item name (words after action and quantity, before stop words)
        item_words = []
        start_idx = max(action_idx + 1, quantity_idx + 1)
        
        for i in range(start_idx, len(words)):
            word = words[i]
            # Stop at common stop words
            if word in STOP_WORDS or word in ['and', 'also']:
                break
            # Skip quantity words
            if word.isdigit() or word in ['bags', 'bag', 'units', 'unit', 'of']:
                continue
            item_words.append(word)
        
        item = ' '.join(item_words).strip()
        
        if not item:
            return None
        
        return ParsedCommand(
            action=action,
            item=item,
            quantity=quantity if quantity > 0 else 1,
            raw_text=text,
            confidence=0.7
        )

def parse_command(text: str) -> Optional[ParsedCommand]:
    """Main function to parse commands"""
    return CommandParser.parse(text)

if __name__ == "__main__":
    test_commands = [
        "add 10 bags of rice",
        "add 10 rice",
        "add 5 water bottles",
        "remove 2 rice",
        "update rice to 20",
        "check rice",
        "list all items",
        "add 100 water bottles and also add biscuit packets",
    ]
    
    for cmd in test_commands:
        result = parse_command(cmd)
        if result:
            print(f"✓ {cmd:50} → Action: {result.action}, Item: '{result.item}', Qty: {result.quantity}")
        else:
            print(f"✗ {cmd:50} → Failed to parse")
