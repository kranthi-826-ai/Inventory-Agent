from dataclasses import dataclass
from typing import Optional, List, Dict, Any
from datetime import datetime

@dataclass
class VoiceCommand:
    """Model for voice command input"""
    audio_file: Optional[str] = None
    text: Optional[str] = None
    timestamp: datetime = datetime.now()

@dataclass
class ParsedCommand:
    """Model for parsed command structure"""
    action: str
    item: str
    quantity: int = 1
    confidence: float = 1.0
    raw_text: str = ""

@dataclass
class InventoryItem:
    """Model for inventory items"""
    id: Optional[int]
    name: str
    quantity: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'quantity': self.quantity,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    @property
    def status(self) -> str:
        if self.quantity <= 0:
            return 'out-of-stock'
        elif self.quantity < 5:  # Low stock threshold
            return 'low-stock'
        else:
            return 'in-stock'

@dataclass
class ApiResponse:
    """Standard API response model"""
    status: str
    message: str
    data: Optional[Any] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'status': self.status,
            'message': self.message,
            'data': self.data
        }

@dataclass
class InventoryStats:
    """Inventory statistics model"""
    total_items: int
    total_quantity: int
    low_stock_count: int
    out_of_stock_count: int
    categories: Dict[str, int]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'total_items': self.total_items,
            'total_quantity': self.total_quantity,
            'low_stock_count': self.low_stock_count,
            'out_of_stock_count': self.out_of_stock_count,
            'categories': self.categories
        }