// API Configuration
const API_BASE_URL = 'http://localhost:5000/api'; // Update with your backend URL

// API Service Object
const API = {
    // Voice command endpoint
    async sendVoiceCommand(commandData) {
        try {
            const response = await fetch(`${API_BASE_URL}/voice-command`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(commandData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error sending voice command:', error);
            throw error;
        }
    },

    // Get all inventory items
    async getInventory() {
        try {
            const response = await fetch(`${API_BASE_URL}/inventory`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching inventory:', error);
            throw error;
        }
    },

    // Add item to inventory
    async addInventoryItem(itemData) {
        try {
            const response = await fetch(`${API_BASE_URL}/inventory/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(itemData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error adding inventory item:', error);
            throw error;
        }
    },

    // Remove item from inventory
    async removeInventoryItem(itemId) {
        try {
            const response = await fetch(`${API_BASE_URL}/inventory/remove`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id: itemId })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error removing inventory item:', error);
            throw error;
        }
    },

    // Update inventory item
    async updateInventoryItem(itemId, updateData) {
        try {
            const response = await fetch(`${API_BASE_URL}/inventory/update`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id: itemId, ...updateData })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error updating inventory item:', error);
            throw error;
        }
    },

    // Search inventory
    async searchInventory(searchTerm) {
        try {
            const response = await fetch(`${API_BASE_URL}/inventory/search?q=${encodeURIComponent(searchTerm)}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error searching inventory:', error);
            throw error;
        }
    },

    // Get low stock items
    async getLowStockItems(threshold = 5) {
        try {
            const response = await fetch(`${API_BASE_URL}/inventory/low-stock?threshold=${threshold}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching low stock items:', error);
            throw error;
        }
    },

    // Get inventory statistics
    async getInventoryStats() {
        try {
            const response = await fetch(`${API_BASE_URL}/inventory/stats`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching inventory stats:', error);
            throw error;
        }
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}

// Make API globally available
window.API = API;