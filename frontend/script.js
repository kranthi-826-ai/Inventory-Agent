// Audio elements
const successSound = new Audio('../assets/success.mp3');
const alertSound = new Audio('../assets/alert.mp3');

// State management
let isListening = false;
let mockInventory = [
    { id: 1, name: 'Laptop', quantity: 15, status: 'in-stock' },
    { id: 2, name: 'Mouse', quantity: 3, status: 'low-stock' },
    { id: 3, name: 'Keyboard', quantity: 0, status: 'out-of-stock' },
    { id: 4, name: 'Monitor', quantity: 8, status: 'in-stock' },
    { id: 5, name: 'Headset', quantity: 2, status: 'low-stock' }
];

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
    initializePage();
});

function initializePage() {
    // Voice page elements
    const micButton = document.getElementById('micButton');
    const openDashboardBtn = document.getElementById('openDashboardBtn');
    
    if (micButton) {
        micButton.addEventListener('click', toggleListening);
    }
    
    if (openDashboardBtn) {
        openDashboardBtn.addEventListener('click', () => {
            window.location.href = 'dashboard.html';
        });
    }
    
    // Dashboard elements
    const addItemBtn = document.getElementById('addItemBtn');
    const modalOverlay = document.getElementById('modalOverlay');
    const closeModal = document.getElementById('closeModal');
    const addItemForm = document.getElementById('addItemForm');
    const searchInput = document.getElementById('searchInput');
    
    if (addItemBtn) {
        addItemBtn.addEventListener('click', () => {
            modalOverlay.classList.add('active');
        });
    }
    
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            modalOverlay.classList.remove('active');
        });
    }
    
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.classList.remove('active');
            }
        });
    }
    
    if (addItemForm) {
        addItemForm.addEventListener('submit', handleAddItem);
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
    
    // Initialize dashboard if on dashboard page
    if (document.getElementById('inventoryTable')) {
        initializeDashboard();
    }
    
    // Add ripple effect to buttons
    addRippleEffect();
}

// Voice Functions
function toggleListening() {
    const micButton = document.getElementById('micButton');
    const waveform = document.getElementById('waveform');
    const statusBadge = document.getElementById('statusBadge');
    
    isListening = !isListening;
    
    if (isListening) {
        micButton.classList.add('listening');
        waveform.classList.add('active');
        statusBadge.textContent = 'Listening...';
        statusBadge.style.background = 'rgba(16, 185, 129, 0.2)';
        statusBadge.style.borderColor = '#10b981';
        
        // Simulate speech recognition
        simulateSpeechRecognition();
    } else {
        micButton.classList.remove('listening');
        waveform.classList.remove('active');
        statusBadge.textContent = 'Ready';
        statusBadge.style.background = 'rgba(99, 102, 241, 0.2)';
        statusBadge.style.borderColor = '#6366f1';
    }
}

function simulateSpeechRecognition() {
    const recognizedText = document.getElementById('recognizedText');
    const previewContent = document.getElementById('previewContent');
    
    // Mock speech recognition sequence
    const mockPhrases = [
        'Add',
        'Add 10',
        'Add 10 laptops',
        'Add 10 laptops to inventory'
    ];
    
    let index = 0;
    const interval = setInterval(() => {
        if (!isListening || index >= mockPhrases.length) {
            clearInterval(interval);
            if (isListening) {
                // Parse final command
                parseCommand(mockPhrases[mockPhrases.length - 1]);
            }
            return;
        }
        
        recognizedText.textContent = mockPhrases[index];
        index++;
    }, 1000);
}

function parseCommand(text) {
    const previewContent = document.getElementById('previewContent');
    const statusBadge = document.getElementById('statusBadge');
    
    // Simple mock parsing
    const words = text.toLowerCase().split(' ');
    let action = 'unknown';
    let item = 'unknown';
    let quantity = 0;
    
    if (text.includes('add')) {
        action = 'add';
        // Extract quantity (basic parsing)
        const quantityMatch = text.match(/\d+/);
        if (quantityMatch) {
            quantity = parseInt(quantityMatch[0]);
        }
        // Extract item (remove numbers and common words)
        item = text.replace(/\d+/g, '').replace('add', '').trim();
    }
    
    previewContent.innerHTML = `
        <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
            <span style="color: var(--primary);">Action: ${action}</span>
            <span style="color: var(--secondary);">Item: ${item}</span>
            <span style="color: var(--accent);">Quantity: ${quantity}</span>
        </div>
    `;
    
    // Show success notification
    showToast('Command recognized successfully!', 'success');
    successSound.play().catch(e => console.log('Audio play failed:', e));
    
    // Simulate API call
    sendVoiceCommand({ action, item, quantity });
}

// API Integration
async function sendVoiceCommand(command) {
    try {
        // Show loading state
        const statusBadge = document.getElementById('statusBadge');
        statusBadge.textContent = 'Processing...';
        
        // Mock API call
        const response = await mockApiCall('/voice-command', command);
        
        if (response.success) {
            showToast('Command executed successfully!', 'success');
            successSound.play().catch(e => console.log('Audio play failed:', e));
            
            // Update inventory if on dashboard
            if (window.location.pathname.includes('dashboard')) {
                fetchInventory();
            }
        }
    } catch (error) {
        showToast('Error processing command', 'error');
        alertSound.play().catch(e => console.log('Audio play failed:', e));
    } finally {
        const statusBadge = document.getElementById('statusBadge');
        if (statusBadge) {
            statusBadge.textContent = 'Ready';
        }
        isListening = false;
        document.getElementById('micButton')?.classList.remove('listening');
        document.getElementById('waveform')?.classList.remove('active');
    }
}

// Dashboard Functions
function initializeDashboard() {
    fetchInventory();
    animateStats();
    startRealtimeUpdates();
}

function fetchInventory() {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;
    
    // Show loading state
    tableBody.innerHTML = Array(3).fill(0).map(() => `
        <tr>
            <td><div class="shimmer" style="height: 20px; width: 100px;"></div></td>
            <td><div class="shimmer" style="height: 20px; width: 50px;"></div></td>
            <td><div class="shimmer" style="height: 20px; width: 80px;"></div></td>
            <td><div class="shimmer" style="height: 20px; width: 60px;"></div></td>
        </tr>
    `).join('');
    
    // Simulate API call
    setTimeout(() => {
        renderInventoryTable(mockInventory);
        updateStats();
    }, 1000);
}

function renderInventoryTable(items) {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = items.map(item => `
        <tr data-id="${item.id}">
            <td>${item.name}</td>
            <td>${item.quantity}</td>
            <td><span class="status-badge ${item.status}">${formatStatus(item.status)}</span></td>
            <td>
                <button class="btn-primary" style="padding: 0.5rem 1rem;" onclick="updateItemQuantity(${item.id}, 'decrease')">-</button>
                <button class="btn-primary" style="padding: 0.5rem 1rem;" onclick="updateItemQuantity(${item.id}, 'increase')">+</button>
            </td>
        </tr>
    `).join('');
}

function formatStatus(status) {
    return status.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function updateStats() {
    const totalItems = mockInventory.reduce((sum, item) => sum + item.quantity, 0);
    const lowStock = mockInventory.filter(item => item.status === 'low-stock').length;
    const recentUpdates = Math.floor(Math.random() * 10) + 1; // Mock recent updates
    
    animateCounter('totalItems', totalItems);
    animateCounter('lowStock', lowStock);
    animateCounter('recentUpdates', recentUpdates);
}

function animateCounter(elementId, targetValue) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const startValue = parseInt(element.textContent) || 0;
    const duration = 2000;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.floor(startValue + (targetValue - startValue) * easeOutQuart);
        
        element.textContent = currentValue;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

function animateStats() {
    // Trigger counter animations for all stats
    const stats = ['totalItems', 'lowStock', 'recentUpdates'];
    stats.forEach(stat => {
        const element = document.getElementById(stat);
        if (element) {
            const targetValue = parseInt(element.textContent) || 0;
            element.textContent = '0';
            animateCounter(stat, targetValue);
        }
    });
}

// Search functionality
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const filteredItems = mockInventory.filter(item => 
        item.name.toLowerCase().includes(searchTerm)
    );
    renderInventoryTable(filteredItems);
}

// Add item handling
async function handleAddItem(e) {
    e.preventDefault();
    
    const itemName = document.getElementById('itemName').value;
    const quantity = parseInt(document.getElementById('itemQuantity').value);
    
    const newItem = {
        id: mockInventory.length + 1,
        name: itemName,
        quantity: quantity,
        status: quantity > 10 ? 'in-stock' : quantity > 0 ? 'low-stock' : 'out-of-stock'
    };
    
    // Optimistic UI update
    mockInventory.push(newItem);
    renderInventoryTable(mockInventory);
    updateStats();
    
    // Close modal
    document.getElementById('modalOverlay').classList.remove('active');
    e.target.reset();
    
    // Show success message
    showToast('Item added successfully!', 'success');
    successSound.play().catch(e => console.log('Audio play failed:', e));
    
    // Highlight new row
    highlightRow(newItem.id);
}

// Update item quantity
window.updateItemQuantity = async function(id, action) {
    const item = mockInventory.find(i => i.id === id);
    if (!item) return;
    
    // Optimistic update
    if (action === 'increase') {
        item.quantity++;
    } else if (action === 'decrease' && item.quantity > 0) {
        item.quantity--;
    }
    
    // Update status based on quantity
    if (item.quantity > 10) {
        item.status = 'in-stock';
    } else if (item.quantity > 0) {
        item.status = 'low-stock';
    } else {
        item.status = 'out-of-stock';
    }
    
    renderInventoryTable(mockInventory);
    updateStats();
    highlightRow(id);
    
    showToast(`Item ${action}d successfully!`, 'success');
}

function highlightRow(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (row) {
        row.classList.add('highlight');
        setTimeout(() => row.classList.remove('highlight'), 1000);
    }
}

// Toast notifications
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer;">×</button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// Real-time updates simulation
function startRealtimeUpdates() {
    setInterval(() => {
        // Randomly update an item to simulate real-time changes
        if (Math.random() > 0.7) {
            const randomIndex = Math.floor(Math.random() * mockInventory.length);
            const item = mockInventory[randomIndex];
            const oldQuantity = item.quantity;
            
            // Random quantity change
            item.quantity += Math.floor(Math.random() * 3) - 1;
            item.quantity = Math.max(0, item.quantity);
            
            // Update status
            if (item.quantity > 10) {
                item.status = 'in-stock';
            } else if (item.quantity > 0) {
                item.status = 'low-stock';
            } else {
                item.status = 'out-of-stock';
            }
            
            if (oldQuantity !== item.quantity) {
                renderInventoryTable(mockInventory);
                updateStats();
                highlightRow(item.id);
                showToast(`${item.name} quantity updated to ${item.quantity}`, 'info');
            }
        }
    }, 10000);
}

// Ripple effect
function addRippleEffect() {
    document.querySelectorAll('.btn-primary').forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            ripple.className = 'btn-ripple';
            
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            
            ripple.style.width = ripple.style.height = `${size}px`;
            ripple.style.left = `${e.clientX - rect.left - size/2}px`;
            ripple.style.top = `${e.clientY - rect.top - size/2}px`;
            
            this.appendChild(ripple);
            
            setTimeout(() => ripple.remove(), 600);
        });
    });
}

// Mock API function
async function mockApiCall(endpoint, data) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({ success: true, data });
        }, 1000);
    });
}

// Make functions globally available
window.showToast = showToast;