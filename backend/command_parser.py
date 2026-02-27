import re
import logging
from typing import Optional

from shared.constants import ACTIONS, ACTION_KEYWORDS, STOP_WORDS
from shared.models import ParsedCommand

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class CommandParser:
    """Parse natural language commands in multiple languages into structured data"""

    @staticmethod
    def parse(text: str) -> Optional[ParsedCommand]:
        """
        Parse a text command into action, item, and quantity.
        Returns ParsedCommand object or None if parsing fails.
        Supports English, Telugu, and Hindi.
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
        """Try to parse using strict patterns for multilingual support"""

        # Pattern 1: "add 10 rice" or "10 బిస్కెట్లు ఆడ్ చెయ్" or "10 पैकेट जोड़ो"
        for action_type in ['add', 'remove', 'update']:
            keywords = ACTION_KEYWORDS[action_type]
            # Build regex pattern from keywords
            keyword_pattern = '|'.join([re.escape(k) for k in keywords])
            
            if action_type in ['add', 'remove']:
                # Pattern: [quantity] [units] [item] [action] OR [action] [quantity] [units] [item]
                pattern1 = rf'(\d+)\s*(?:[\u0C00-\u0C7F\u0900-\u097Fa-z]+?\s+)?([\u0C00-\u0C7F\u0900-\u097Fa-z\s]+?)\s*({keyword_pattern})'
                pattern2 = rf'({keyword_pattern})\s+(\d+)\s*(?:[\u0C00-\u0C7F\u0900-\u097Fa-z]+?\s+)?([\u0C00-\u0C7F\u0900-\u097Fa-z\s]+)'
                
                match = re.search(pattern1, text, re.IGNORECASE)
                if not match:
                    match = re.search(pattern2, text, re.IGNORECASE)
                    if match:
                        # Reorder groups for pattern2
                        quantity = match.group(2)
                        item = match.group(3)
                    else:
                        continue
                else:
                    quantity = match.group(1)
                    item = match.group(2)
                
                if match:
                    quantity = int(quantity)
                    item = CommandParser._clean_item_name(item)
                    if item:
                        return ParsedCommand(
                            action=action_type,
                            item=item,
                            quantity=quantity,
                            raw_text=text,
                            confidence=1.0
                        )

        return None

    @staticmethod
    def _clean_item_name(raw_item: str) -> str:
        """Clean and normalize item name by removing stop words and extra spaces"""
        if not raw_item:
            return ''
        
        # Combine all stop words from all languages
        all_stop_words = set()
        for lang_stops in STOP_WORDS.values():
            all_stop_words.update(lang_stops)
        
        words = raw_item.strip().split()
        # Remove stop words and clean
        cleaned = [w for w in words if w.lower() not in all_stop_words and w.strip()]
        return ' '.join(cleaned).strip() if cleaned else raw_item.strip()

    @staticmethod
    def _flexible_parse(text: str) -> Optional[ParsedCommand]:
        """Fallback parser for less structured commands - multilingual"""
        words = text.split()

        # Find action using multilingual keywords
        action = None
        action_idx = -1
        for i, word in enumerate(words):
            for action_type, keywords in ACTION_KEYWORDS.items():
                if word.lower() in [k.lower() for k in keywords]:
                    action = action_type
                    action_idx = i
                    break
            if action:
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

        # Extract item name (words that are not action, not quantity, not stop words)
        all_stop_words = set()
        for lang_stops in STOP_WORDS.values():
            all_stop_words.update([s.lower() for s in lang_stops])
        
        # Collect all action keywords
        all_action_keywords = set()
        for keywords in ACTION_KEYWORDS.values():
            all_action_keywords.update([k.lower() for k in keywords])
        
        item_words = []
        for i, word in enumerate(words):
            # Skip action words, quantity, and stop words
            if (word.lower() in all_action_keywords or 
                word.isdigit() or 
                word.lower() in all_stop_words):
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
        "10 బిస్కెట్ ప్యాకెట్లు ఆడ్ చెయ్",
        "10 पैकेट बिस्कुट जोड़ो",
        "remove 2 rice",
        "5 నూనె తీసేయ",
        "update rice to 20",
        "check rice",
        "list all items",
    ]
    for cmd in test_commands:
        result = parse_command(cmd)
        if result:
            print(f"✓ {cmd:50} → Action: {result.action}, Item: '{result.item}', Qty: {result.quantity}")
        else:
            print(f"✗ {cmd:50} → Failed to parse")
