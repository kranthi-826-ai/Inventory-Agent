// API Configuration
const API_BASE_URL = 'http://localhost:5000/api'; // Update with your backend URL

// API Configuration Object
const API_CONFIG = {
    baseURL: API_BASE_URL,
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000,
    cacheDuration: 5 * 60 * 1000, // 5 minutes
    enableLogging: true,
    defaultHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
};

// Cache Management
const apiCache = new Map();

// Request Queue for managing concurrent requests
class RequestQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
    }

    async add(request) {
        return new Promise((resolve, reject) => {
            this.queue.push({ request, resolve, reject });
            this.process();
        });
    }

    async process() {
        if (this.processing || this.queue.length === 0) return;
        
        this.processing = true;
        const { request, resolve, reject } = this.queue.shift();

        try {
            const result = await request();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.processing = false;
            this.process();
        }
    }
}

const requestQueue = new RequestQueue();

// Enhanced Error Class
class APIError extends Error {
    constructor(message, status, data = null) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.data = data;
        this.timestamp = new Date().toISOString();
    }
}

// Retry mechanism with exponential backoff
async function retryOperation(operation, maxAttempts = API_CONFIG.retryAttempts) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            
            if (attempt === maxAttempts) break;
            
            // Don't retry on certain status codes
            if (error.status === 401 || error.status === 403 || error.status === 404) {
                break;
            }
            
            const delay = API_CONFIG.retryDelay * Math.pow(2, attempt - 1);
            console.log(`Retry attempt ${attempt}/${maxAttempts} after ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError;
}

// Request interceptor for logging and headers
async function requestInterceptor(url, options) {
    const startTime = performance.now();
    
    // Add request ID for tracking
    const requestId = Math.random().toString(36).substring(7);
    
    // Enhanced headers
    const enhancedOptions = {
        ...options,
        headers: {
            ...API_CONFIG.defaultHeaders,
            ...options.headers,
            'X-Request-ID': requestId,
            'X-Request-Time': new Date().toISOString()
        }
    };

    if (API_CONFIG.enableLogging) {
        console.log(`[API Request ${requestId}]`, {
            url,
            method: options.method || 'GET',
            timestamp: new Date().toISOString()
        });
    }

    return { url, options: enhancedOptions, requestId, startTime };
}

// Response interceptor for logging and error handling
async function responseInterceptor(response, requestId, startTime) {
    const duration = performance.now() - startTime;
    
    if (API_CONFIG.enableLogging) {
        console.log(`[API Response ${requestId}]`, {
            status: response.status,
            statusText: response.statusText,
            duration: `${duration.toFixed(2)}ms`,
            timestamp: new Date().toISOString()
        });
    }

    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            errorData = { message: response.statusText };
        }
        
        throw new APIError(
            errorData.message || `HTTP error! status: ${response.status}`,
            response.status,
            errorData
        );
    }

    // Add duration header for tracking
    response.duration = duration;
    
    return response;
}

// Enhanced fetch with timeout, retry, and interceptors
async function enhancedFetch(url, options = {}) {
    const { url: interceptedUrl, options: interceptedOptions, requestId, startTime } = 
        await requestInterceptor(url, options);

    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);
    
    try {
        const response = await fetch(interceptedUrl, {
            ...interceptedOptions,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return await responseInterceptor(response, requestId, startTime);
    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            throw new APIError('Request timeout', 408);
        }
        
        throw error;
    }
}

// Cache management functions
function getCached(key) {
    if (apiCache.has(key)) {
        const { data, timestamp } = apiCache.get(key);
        if (Date.now() - timestamp < API_CONFIG.cacheDuration) {
            return data;
        }
        apiCache.delete(key);
    }
    return null;
}

function setCached(key, data) {
    apiCache.set(key, {
        data,
        timestamp: Date.now()
    });
}

function clearCache(pattern) {
    if (pattern) {
        const regex = new RegExp(pattern);
        for (const key of apiCache.keys()) {
            if (regex.test(key)) {
                apiCache.delete(key);
            }
        }
    } else {
        apiCache.clear();
    }
}

// WebSocket Connection for real-time updates
class WebSocketManager {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.listeners = new Map();
    }

    connect() {
        try {
            this.ws = new WebSocket('ws://localhost:5000/ws');
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.reconnectAttempts = 0;
            };

            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.notifyListeners(data.type, data);
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.reconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('WebSocket connection failed:', error);
            this.reconnect();
        }
    }

    reconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            setTimeout(() => this.connect(), delay);
        }
    }

    addListener(type, callback) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }
        this.listeners.get(type).add(callback);
    }

    removeListener(type, callback) {
        if (this.listeners.has(type)) {
            this.listeners.get(type).delete(callback);
        }
    }

    notifyListeners(type, data) {
        if (this.listeners.has(type)) {
            this.listeners.get(type).forEach(callback => callback(data));
        }
    }

    send(type, data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, ...data }));
        }
    }
}

const wsManager = new WebSocketManager();

// API Service Object - Enhanced
const API = {
    // Voice command endpoint with retry and queue
    async sendVoiceCommand(commandData) {
        const cacheKey = `voice-${JSON.stringify(commandData)}`;
        
        return requestQueue.add(async () => {
            return retryOperation(async () => {
                try {
                    const response = await enhancedFetch(`${API_CONFIG.baseURL}/voice-command`, {
                        method: 'POST',
                        body: JSON.stringify(commandData)
                    });

                    const data = await response.json();
                    
                    // Cache successful responses for 1 minute
                    setCached(cacheKey, data);
                    
                    return {
                        ...data,
                        _metadata: {
                            duration: response.duration,
                            cached: false,
                            timestamp: new Date().toISOString()
                        }
                    };
                } catch (error) {
                    if (error instanceof APIError) {
                        throw error;
                    }
                    throw new APIError(error.message, 500);
                }
            });
        });
    },

    // Get all inventory items with caching
    async getInventory(options = {}) {
        const { forceRefresh = false, useCache = true } = options;
        const cacheKey = 'inventory-all';
        
        if (useCache && !forceRefresh) {
            const cached = getCached(cacheKey);
            if (cached) {
                return {
                    ...cached,
                    _metadata: {
                        cached: true,
                        timestamp: new Date().toISOString()
                    }
                };
            }
        }

        return requestQueue.add(async () => {
            return retryOperation(async () => {
                try {
                    const response = await enhancedFetch(`${API_CONFIG.baseURL}/inventory`);
                    const data = await response.json();
                    
                    if (data.status === 'success') {
                        setCached(cacheKey, data);
                        
                        // Also cache individual items
                        if (data.data) {
                            data.data.forEach(item => {
                                setCached(`item-${item.id}`, item);
                            });
                        }
                    }
                    
                    return {
                        ...data,
                        _metadata: {
                            duration: response.duration,
                            cached: false,
                            timestamp: new Date().toISOString()
                        }
                    };
                } catch (error) {
                    if (error instanceof APIError) {
                        throw error;
                    }
                    throw new APIError(error.message, 500);
                }
            });
        });
    },

    // Get single inventory item
    async getInventoryItem(itemId, options = {}) {
        const { forceRefresh = false, useCache = true } = options;
        const cacheKey = `item-${itemId}`;
        
        if (useCache && !forceRefresh) {
            const cached = getCached(cacheKey);
            if (cached) {
                return {
                    status: 'success',
                    data: cached,
                    _metadata: {
                        cached: true,
                        timestamp: new Date().toISOString()
                    }
                };
            }
        }

        try {
            const response = await enhancedFetch(`${API_CONFIG.baseURL}/inventory/${itemId}`);
            const data = await response.json();
            
            if (data.status === 'success' && data.data) {
                setCached(cacheKey, data.data);
            }
            
            return data;
        } catch (error) {
            console.error('Error fetching inventory item:', error);
            throw error;
        }
    },

    // Add item to inventory with optimistic update
    async addInventoryItem(itemData) {
        return requestQueue.add(async () => {
            return retryOperation(async () => {
                try {
                    // Generate optimistic ID for UI
                    const optimisticId = `temp-${Date.now()}`;
                    
                    const response = await enhancedFetch(`${API_CONFIG.baseURL}/inventory/add`, {
                        method: 'POST',
                        body: JSON.stringify(itemData)
                    });

                    const data = await response.json();
                    
                    if (data.status === 'success') {
                        // Clear relevant caches
                        clearCache('inventory-');
                        clearCache('stats');
                        
                        // Notify via WebSocket
                        wsManager.send('inventory-updated', { action: 'add', item: data.data });
                        
                        return {
                            ...data,
                            _metadata: {
                                optimisticId,
                                duration: response.duration,
                                timestamp: new Date().toISOString()
                            }
                        };
                    }
                    
                    return data;
                } catch (error) {
                    if (error instanceof APIError) {
                        throw error;
                    }
                    throw new APIError(error.message, 500);
                }
            });
        });
    },

    // Bulk add items
    async bulkAddInventoryItems(items) {
        return requestQueue.add(async () => {
            return retryOperation(async () => {
                try {
                    const response = await enhancedFetch(`${API_CONFIG.baseURL}/inventory/bulk-add`, {
                        method: 'POST',
                        body: JSON.stringify({ items })
                    });

                    const data = await response.json();
                    
                    if (data.status === 'success') {
                        clearCache('inventory-');
                        clearCache('stats');
                        wsManager.send('inventory-bulk-updated', { action: 'bulk-add', count: items.length });
                    }
                    
                    return data;
                } catch (error) {
                    if (error instanceof APIError) {
                        throw error;
                    }
                    throw new APIError(error.message, 500);
                }
            });
        });
    },

    // Remove item from inventory
    async removeInventoryItem(itemId) {
        return requestQueue.add(async () => {
            return retryOperation(async () => {
                try {
                    const response = await enhancedFetch(`${API_CONFIG.baseURL}/inventory/remove`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ id: itemId })
                    });

                    const data = await response.json();
                    
                    if (data.status === 'success') {
                        // Clear caches
                        clearCache('inventory-');
                        clearCache('stats');
                        apiCache.delete(`item-${itemId}`);
                        
                        // Notify via WebSocket
                        wsManager.send('inventory-updated', { action: 'remove', itemId });
                    }
                    
                    return data;
                } catch (error) {
                    if (error instanceof APIError) {
                        throw error;
                    }
                    throw new APIError(error.message, 500);
                }
            });
        });
    },

    // Update inventory item
    async updateInventoryItem(itemId, updateData) {
        return requestQueue.add(async () => {
            return retryOperation(async () => {
                try {
                    const response = await enhancedFetch(`${API_CONFIG.baseURL}/inventory/update`, {
                        method: 'PUT',
                        body: JSON.stringify({ id: itemId, ...updateData })
                    });

                    const data = await response.json();
                    
                    if (data.status === 'success') {
                        // Clear caches
                        clearCache('inventory-');
                        clearCache('stats');
                        apiCache.delete(`item-${itemId}`);
                        
                        // Notify via WebSocket
                        wsManager.send('inventory-updated', { action: 'update', itemId, data: updateData });
                    }
                    
                    return data;
                } catch (error) {
                    if (error instanceof APIError) {
                        throw error;
                    }
                    throw new APIError(error.message, 500);
                }
            });
        });
    },

    // Search inventory with debouncing support
    async searchInventory(searchTerm, options = {}) {
        const { useCache = true } = options;
        const cacheKey = `search-${searchTerm}`;
        
        if (useCache && searchTerm.length > 2) {
            const cached = getCached(cacheKey);
            if (cached) {
                return {
                    ...cached,
                    _metadata: {
                        cached: true,
                        timestamp: new Date().toISOString()
                    }
                };
            }
        }

        try {
            const response = await enhancedFetch(
                `${API_CONFIG.baseURL}/inventory/search?q=${encodeURIComponent(searchTerm)}`
            );
            const data = await response.json();
            
            if (searchTerm.length > 2) {
                setCached(cacheKey, data);
            }
            
            return data;
        } catch (error) {
            console.error('Error searching inventory:', error);
            throw error;
        }
    },

    // Get low stock items
    async getLowStockItems(threshold = 5, options = {}) {
        const { forceRefresh = false } = options;
        const cacheKey = `low-stock-${threshold}`;
        
        if (!forceRefresh) {
            const cached = getCached(cacheKey);
            if (cached) {
                return {
                    ...cached,
                    _metadata: {
                        cached: true,
                        timestamp: new Date().toISOString()
                    }
                };
            }
        }

        try {
            const response = await enhancedFetch(
                `${API_CONFIG.baseURL}/inventory/low-stock?threshold=${threshold}`
            );
            const data = await response.json();
            
            setCached(cacheKey, data);
            
            return data;
        } catch (error) {
            console.error('Error fetching low stock items:', error);
            throw error;
        }
    },

    // Get inventory statistics
    async getInventoryStats(options = {}) {
        const { forceRefresh = false } = options;
        const cacheKey = 'stats';
        
        if (!forceRefresh) {
            const cached = getCached(cacheKey);
            if (cached) {
                return {
                    ...cached,
                    _metadata: {
                        cached: true,
                        timestamp: new Date().toISOString()
                    }
                };
            }
        }

        try {
            const response = await enhancedFetch(`${API_CONFIG.baseURL}/inventory/stats`);
            const data = await response.json();
            
            setCached(cacheKey, data);
            
            return {
                ...data,
                _metadata: {
                    duration: response.duration,
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            console.error('Error fetching inventory stats:', error);
            throw error;
        }
    },

    // Export inventory data
    async exportInventory(format = 'json') {
        try {
            const response = await enhancedFetch(
                `${API_CONFIG.baseURL}/inventory/export?format=${format}`
            );
            
            if (format === 'json') {
                return await response.json();
            } else {
                const blob = await response.blob();
                return blob;
            }
        } catch (error) {
            console.error('Error exporting inventory:', error);
            throw error;
        }
    },

    // Import inventory data
    async importInventory(data, format = 'json') {
        try {
            const response = await enhancedFetch(`${API_CONFIG.baseURL}/inventory/import`, {
                method: 'POST',
                headers: {
                    'Content-Type': format === 'json' ? 'application/json' : 'text/csv'
                },
                body: format === 'json' ? JSON.stringify(data) : data
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                clearCache('inventory-');
                clearCache('stats');
                wsManager.send('inventory-imported', { count: result.count });
            }
            
            return result;
        } catch (error) {
            console.error('Error importing inventory:', error);
            throw error;
        }
    },

    // Clear all inventory
    async clearInventory() {
        try {
            const response = await enhancedFetch(`${API_CONFIG.baseURL}/clear`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            
            if (data.success) {
                clearCache();
                wsManager.send('inventory-cleared', {});
            }
            
            return data;
        } catch (error) {
            console.error('Error clearing inventory:', error);
            throw error;
        }
    },

    // Health check
    async healthCheck() {
        try {
            const response = await enhancedFetch(`${API_CONFIG.baseURL}/health`, {
                method: 'GET',
                timeout: 5000 // Shorter timeout for health check
            });
            
            return await response.json();
        } catch (error) {
            console.error('Health check failed:', error);
            return {
                status: 'error',
                message: 'API is unavailable'
            };
        }
    },

    // Get API version
    async getVersion() {
        try {
            const response = await enhancedFetch(`${API_CONFIG.baseURL}/version`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching version:', error);
            throw error;
        }
    },

    // Cache management
    cache: {
        get: getCached,
        set: setCached,
        clear: clearCache,
        
        // Get cache stats
        stats() {
            return {
                size: apiCache.size,
                keys: Array.from(apiCache.keys()),
                entries: Array.from(apiCache.entries()).map(([key, value]) => ({
                    key,
                    age: Date.now() - value.timestamp,
                    expired: Date.now() - value.timestamp > API_CONFIG.cacheDuration
                }))
            };
        }
    },

    // WebSocket management
    websocket: {
        connect: () => wsManager.connect(),
        disconnect: () => wsManager.ws?.close(),
        addListener: (type, callback) => wsManager.addListener(type, callback),
        removeListener: (type, callback) => wsManager.removeListener(type, callback),
        send: (type, data) => wsManager.send(type, data)
    },

    // Configuration
    config: {
        setBaseURL: (url) => { API_CONFIG.baseURL = url; },
        setTimeout: (timeout) => { API_CONFIG.timeout = timeout; },
        setRetryAttempts: (attempts) => { API_CONFIG.retryAttempts = attempts; },
        setCacheDuration: (duration) => { API_CONFIG.cacheDuration = duration; },
        enableLogging: (enable) => { API_CONFIG.enableLogging = enable; },
        getConfig: () => ({ ...API_CONFIG })
    },

    // Error types for checking
    errors: {
        APIError,
        isAPIError: (error) => error instanceof APIError
    }
};

// Initialize WebSocket connection
if (typeof window !== 'undefined') {
    // Auto-connect WebSocket in browser environment
    setTimeout(() => {
        try {
            wsManager.connect();
        } catch (e) {
            console.log('WebSocket connection skipped');
        }
    }, 1000);
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}

// Make API globally available
window.API = API;

// Add global error handler for unhandled promise rejections
if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (event) => {
        if (event.reason instanceof APIError) {
            console.error('Unhandled API Error:', {
                message: event.reason.message,
                status: event.reason.status,
                data: event.reason.data,
                timestamp: event.reason.timestamp
            });
        }
    });
}