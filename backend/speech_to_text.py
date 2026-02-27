import logging
import os
import random
from typing import Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SpeechToText:
    """Mock speech recognition service"""
    
    # Mock responses for different input patterns
    MOCK_RESPONSES = {
        'add': [
            "add 10 laptops",
            "add 5 mice",
            "add 3 keyboards",
            "add 15 monitors"
        ],
        'remove': [
            "remove 2 headsets",
            "remove 5 cables",
            "remove 1 webcam"
        ],
        'update': [
            "update laptop quantity to 20",
            "change mouse to 10",
            "set keyboard to 5"
        ],
        'check': [
            "how many laptops do we have",
            "check mouse quantity",
            "quantity of monitors"
        ]
    }
    
    @staticmethod
    def convert_audio_to_text(audio_file_path: Optional[str] = None) -> str:
        """
        Mock function to convert speech to text
        In production, this would use a real speech recognition service
        """
        try:
            # Simulate processing delay
            import time
            time.sleep(1)
            
            # If audio file is provided, mock processing based on filename
            if audio_file_path and os.path.exists(audio_file_path):
                logger.info(f"Processing audio file: {audio_file_path}")
                
                # Mock: Extract intent from filename or generate random response
                filename = os.path.basename(audio_file_path).lower()
                
                if 'add' in filename:
                    return random.choice(SpeechToText.MOCK_RESPONSES['add'])
                elif 'remove' in filename:
                    return random.choice(SpeechToText.MOCK_RESPONSES['remove'])
                elif 'update' in filename:
                    return random.choice(SpeechToText.MOCK_RESPONSES['update'])
                elif 'check' in filename:
                    return random.choice(SpeechToText.MOCK_RESPONSES['check'])
            
            # Default mock response
            return random.choice([
                "add 5 apples",
                "check inventory",
                "update orange quantity to 10"
            ])
            
        except Exception as e:
            logger.error(f"Error in speech to text conversion: {e}")
            return ""

    @staticmethod
    def process_text_input(text: str) -> str:
        """Process direct text input (for testing without audio)"""
        logger.info(f"Processing text input: {text}")
        return text.strip()

# Convenience functions
def speech_to_text(audio_file: Optional[str] = None) -> str:
    """Main function to convert speech to text"""
    return SpeechToText.convert_audio_to_text(audio_file)

def process_text_command(text: str) -> str:
    """Process text command directly"""
    return SpeechToText.process_text_input(text)