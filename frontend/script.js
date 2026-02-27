// Audio elements
const successSound = new Audio('../assets/success.mp3');
const alertSound = new Audio('../assets/alert.mp3');

// Speech Recognition Setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = false;
recognition.interimResults = true;
recognition.lang = 'en-US'; // Will make this configurable for multiple languages

// State management
let isListening = false;
let finalTranscript = '';

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
        fetchInventory();
    }
    
    // Set up speech recognition events
    setupSpeechRecognition();
}

// Speech Recognition Setup
function setupSpeechRecognition() {
    // Update language when selector changes
const languageSelect = document.getElementById('languageSelect');
if (languageSelect) {
    languageSelect.addEventListener('change', (e) => {
        recognition.lang = e.target.value;
        showToast(`Language changed to ${e.target.options[e.target.selectedIndex].text}`, 'info');
    });
}
    recognition.onstart = () => {
        console.log('Voice recognition started');
        isListening = true;
        updateMicUI(true);
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
                document.getElementById('recognizedText').textContent = finalTranscript;
                
                // Parse the final command
                parseCommand(finalTranscript);
            } else {
                interimTranscript += transcript;
                document.getElementById('recognizedText').textContent = interimTranscript + '...';
            }
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        showToast(`Error: ${event.error}`, 'error');
        alertSound.play().catch(e => console.log('Audio play failed:', e));
        stopListening();
    };

    recognition.onend = () => {
        console.log('Voice recognition ended');
        if (isListening) {
            // If we're still supposed to be listening, restart
            recognition.start();
        } else {
            stopListening();
        }
    };
}

// Toggle listening state
function toggleListening() {
    if (isListening) {
        stopListening();
    } else {
        startListening();
    }
}

function startListening() {
    try {
        finalTranscript = '';
        document.getElementById('recognizedText').textContent = 'Listening...';
        document.getElementById('previewContent').innerHTML = '<span class="placeholder-text">Speak a command...</span>';
        recognition.start();
    } catch (error) {
        console.error('Failed to start recognition:', error);
        showToast('Failed to start voice recognition', 'error');
    }
}

function stopListening() {
    isListening = false;
    recognition.stop();
    updateMicUI(false);
}

function updateMicUI(isActive) {
    const micButton = document.getElementById('micButton');
    const waveform = document.getElementById('waveform');
    const statusBadge = document.getElementById('statusBadge');
    
    if (isActive) {
        micButton.classList.add('listening');
        waveform.classList.add('active');
        statusBadge.textContent = 'Listening...';
        statusBadge.style.background = 'rgba(16, 185, 129, 0.2)';
        statusBadge.style.borderColor = '#10b981';
    } else {
        micButton.classList.remove('listening');
        waveform.classList.remove('active');
        statusBadge.textContent = 'Ready';
        statusBadge.style.background = 'rgba(99, 102, 241, 0.2)';
        statusBadge.style.borderColor = '#6366f1';
    }
}

// Parse the voice command
function parseCommand(text) {
    const previewContent = document.getElementById('previewContent');
    
    // Send to backend for parsing
    sendVoiceCommand({ text: text })
        .then(response => {
            if (response && response.data) {
                const parsed = response.data.parsed_command;
                previewContent.innerHTML = `
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                        <span style="color: var(--primary);">Action: ${parsed.action}</span>
                        <span style="color: var(--secondary);">Item: ${parsed.item}</span>
                        <span style="color: var(--accent);">Quantity: ${parsed.quantity}</span>
                    </div>
                `;
                
                showToast(response.message, 'success');
                successSound.play().catch(e => console.log('Audio play failed:', e));
                
                // Refresh inventory if on dashboard
                if (window.location.pathname.includes('dashboard')) {
                    fetchInventory();
                }
            }
        })
        .catch(error => {
            previewContent.innerHTML = `
                <span style="color: var(--error);">Error parsing command: ${error.message}</span>
            `;
        });
}

// API Integration
async function sendVoiceCommand(command) {
    try {
        const response = await fetch('http://localhost:5000/api/voice-command', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(command)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error sending voice command:', error);
        showToast('Error connecting to server', 'error');
        alertSound.play().catch(e => console.log('Audio play failed:', e));
        throw error;
    }
}

// Dashboard Functions
async function fetchInventory() {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;
    
    try {
        // Show loading state
        tableBody.innerHTML = Array(3).fill(0).map(() => `
            <tr>
                <td><div class="shimmer" style="height: 20px; width: 100px;"></div></td>
                <td><div class="shimmer" style="height: 20px; width: 50px;"></div></td>
                <td><div class="shimmer" style="height: 20px; width: 80px;"></div></td>
                <td><div class="shimmer" style="height: 20px; width: 60px;"></div></td>
            </tr>
        `).join('');
        
        const response = await fetch('http://localhost:5000/api/inventory');
        const result = await response.json();
        
        if (result.status === 'success') {
            renderInventoryTable(result.data);
            updateStats(result.data);
        }
    } catch (error) {
        console.error('Error fetching inventory:', error);
        showToast('Error loading inventory', 'error');
    }
}

function renderInventoryTable(items) {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = items.map(item => `
        <tr data-id="${item.id}">
            <td>${item.name}</td>
            <td>${item.quantity}</td>
            <td><span class="status-badge ${item.status || getStatusClass(item.quantity)}">${getStatusText(item.quantity)}</span></td>
            <td>
                <button class="btn-primary" style="padding: 0.5rem 1rem;" onclick="updateItemQuantity(${item.id}, 'decrease')">-</button>
                <button class="btn-primary" style="padding: 0.5rem 1rem;" onclick="updateItemQuantity(${item.id}, 'increase')">+</button>
            </td>
        </tr>
    `).join('');
}

function getStatusClass(quantity) {
    if (quantity <= 0) return 'out-of-stock';
    if (quantity < 5) return 'low-stock';
    return 'in-stock';
}

function getStatusText(quantity) {
    if (quantity <= 0) return 'Out of Stock';
    if (quantity < 5) return 'Low Stock';
    return 'In Stock';
}

function updateStats(items) {
    const totalItems = items.length;
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const lowStock = items.filter(item => item.quantity > 0 && item.quantity < 5).length;
    
    animateCounter('totalItems', totalItems);
    animateCounter('lowStock', lowStock);
    animateCounter('recentUpdates', Math.floor(Math.random() * 10) + 1);
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
        
        const easeOutQuart = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.floor(startValue + (targetValue - startValue) * easeOutQuart);
        
        element.textContent = currentValue;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

// Update item quantity (for manual dashboard updates)
window.updateItemQuantity = async function(id, action) {
    try {
        // Get current item info
        const row = document.querySelector(`tr[data-id="${id}"]`);
        const itemName = row.cells[0].textContent;
        const currentQty = parseInt(row.cells[1].textContent);
        
        let newQty = action === 'increase' ? currentQty + 1 : currentQty - 1;
        if (newQty < 0) newQty = 0;
        
        // Send update to backend
        const response = await fetch('http://localhost:5000/api/inventory/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                item: itemName,
                quantity: newQty
            })
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            showToast(`Item ${action}d successfully!`, 'success');
            successSound.play().catch(e => console.log('Audio play failed:', e));
            fetchInventory(); // Refresh the list
        }
    } catch (error) {
        console.error('Error updating item:', error);
        showToast('Error updating item', 'error');
        alertSound.play().catch(e => console.log('Audio play failed:', e));
    }
};

// Handle adding item via modal
async function handleAddItem(e) {
    e.preventDefault();
    
    const itemName = document.getElementById('itemName').value;
    const quantity = parseInt(document.getElementById('itemQuantity').value);
    
    try {
        const response = await fetch('http://localhost:5000/api/inventory/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                item: itemName,
                quantity: quantity
            })
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            document.getElementById('modalOverlay').classList.remove('active');
            e.target.reset();
            showToast('Item added successfully!', 'success');
            successSound.play().catch(e => console.log('Audio play failed:', e));
            fetchInventory(); // Refresh the list
        }
    } catch (error) {
        console.error('Error adding item:', error);
        showToast('Error adding item', 'error');
        alertSound.play().catch(e => console.log('Audio play failed:', e));
    }
}

// Search functionality
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const tableBody = document.getElementById('tableBody');
    const rows = tableBody.getElementsByTagName('tr');
    
    for (let row of rows) {
        const itemName = row.cells[0].textContent.toLowerCase();
        if (itemName.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
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
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// Add ripple effect to buttons
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

// Make functions globally available
window.showToast = showToast;
window.updateItemQuantity = updateItemQuantity;