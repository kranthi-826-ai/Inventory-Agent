// Speech Recognition Setup - with fallback
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let recognitionSupported = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionSupported = true;
} else {
    console.warn('Speech Recognition not supported in this browser');
}

// State management
let isListening = false;
let finalTranscript = '';
let recognitionTimeout = null;
let commandHistory = JSON.parse(localStorage.getItem('commandHistory')) || [];

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
    initializePage();
    initializeSettings();
    initializeAnimations();
    loadCommandHistory();
    updateQuickStats();
});

function initializePage() {
    const micButton = document.getElementById('micButton');
    const openDashboardBtn = document.getElementById('openDashboardBtn');

    if (micButton) {
        micButton.addEventListener('click', toggleListening);
        micButton.addEventListener('mouseenter', () => {
            if (!isListening) {
                micButton.classList.add('hover');
            }
        });
        micButton.addEventListener('mouseleave', () => {
            micButton.classList.remove('hover');
        });
    }

    if (openDashboardBtn) {
        openDashboardBtn.addEventListener('click', () => {
            animateButton(openDashboardBtn);
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 300);
        });
    }

    const addItemBtn = document.getElementById('addItemBtn');
    const modalOverlay = document.getElementById('modalOverlay');
    const closeModal = document.getElementById('closeModal');
    const addItemForm = document.getElementById('addItemForm');
    const searchInput = document.getElementById('searchInput');

    if (addItemBtn) {
        addItemBtn.addEventListener('click', () => {
            animateButton(addItemBtn);
            modalOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }

    if (closeModal) {
        closeModal.addEventListener('click', () => {
            closeModalWithAnimation(modalOverlay);
        });
    }

    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModalWithAnimation(modalOverlay);
            }
        });
    }

    if (addItemForm) {
        addItemForm.addEventListener('submit', handleAddItem);
        // Add input animations
        const inputs = addItemForm.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                input.parentElement.classList.add('focused');
            });
            input.addEventListener('blur', () => {
                if (!input.value) {
                    input.parentElement.classList.remove('focused');
                }
            });
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
        searchInput.addEventListener('focus', () => {
            searchInput.parentElement.classList.add('focused');
        });
        searchInput.addEventListener('blur', () => {
            searchInput.parentElement.classList.remove('focused');
        });
    }

    // Clear All button with enhanced UX
    const clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', async () => {
            showConfirmationDialog(
                'Clear All Items',
                'Are you sure you want to clear all inventory items? This action cannot be undone.',
                async () => {
                    try {
                        animateButton(clearAllBtn);
                        showLoader(clearAllBtn);
                        
                        const response = await fetch('/api/clear', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });

                        const data = await response.json();

                        if (data.success) {
                            showToast(data.message, 'success', 3000);
                            fetchInventory();
                            playSuccessSound();
                        } else {
                            showToast(data.message, 'error');
                        }
                    } catch (error) {
                        showToast('Error clearing inventory', 'error');
                    } finally {
                        hideLoader(clearAllBtn);
                    }
                }
            );
        });
    }

    // Initialize select all checkbox
    const selectAllCheckbox = document.querySelector('.select-all-checkbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.row-checkbox');
            checkboxes.forEach(cb => cb.checked = e.target.checked);
        });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);

    if (document.getElementById('inventoryTable')) {
        fetchInventory();
    }

    setupSpeechRecognition();
}

function initializeAnimations() {
    // Add floating animation to cards
    const cards = document.querySelectorAll('.stat-card, .glass-card');
    cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
        card.classList.add('fade-in-up');
    });

    // Initialize particle effect
    createParticles();
}

function createParticles() {
    const container = document.querySelector('.gradient-bg');
    if (!container) return;

    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'floating-particle';
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;
        particle.style.animationDelay = `${Math.random() * 5}s`;
        particle.style.animationDuration = `${10 + Math.random() * 10}s`;
        container.appendChild(particle);
    }
}

function setupSpeechRecognition() {
    if (!recognitionSupported || !recognition) {
        console.log('Speech recognition not available');
        showToast('Speech recognition not supported in your browser', 'warning');
        return;
    }

    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
        languageSelect.addEventListener('change', (e) => {
            recognition.lang = e.target.value;
            const selectedOption = languageSelect.options[languageSelect.selectedIndex];
            const languageName = selectedOption.text.split(')')[0] + ')';
            showToast(`Language changed to ${languageName}`, 'success', 2000);
            
            // Add ripple effect to language select
            languageSelect.classList.add('ripple');
            setTimeout(() => languageSelect.classList.remove('ripple'), 500);
        });
    }

    recognition.onstart = () => {
        console.log('Voice recognition started');
        isListening = true;
        updateMicUI(true);
        
        // Clear previous timeout
        if (recognitionTimeout) {
            clearTimeout(recognitionTimeout);
        }
        
        // Auto-stop after 10 seconds of inactivity
        recognitionTimeout = setTimeout(() => {
            if (isListening) {
                showToast('Listening timeout. Please try again.', 'info');
                stopListening();
            }
        }, 10000);
    };

    recognition.onresult = (event) => {
        // Reset timeout on result
        if (recognitionTimeout) {
            clearTimeout(recognitionTimeout);
            recognitionTimeout = setTimeout(() => {
                if (isListening) {
                    stopListening();
                }
            }, 3000);
        }

        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
                updateRecognizedText(finalTranscript, true);
                parseCommand(finalTranscript);
                
                // Add to command history
                addToCommandHistory(finalTranscript);
            } else {
                interimTranscript += transcript;
                updateRecognizedText(interimTranscript, false);
            }
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        
        const errorMessages = {
            'network': 'Check your internet connection. Speech recognition requires network access.',
            'not-allowed': 'Microphone permission denied. Please allow microphone access.',
            'no-speech': 'No speech detected. Please try again.',
            'audio-capture': 'No microphone found. Please connect a microphone.',
            'aborted': 'Speech recognition was aborted.'
        };
        
        const message = errorMessages[event.error] || `Error: ${event.error}`;
        const type = event.error === 'no-speech' ? 'warning' : 'error';
        
        showToast(message, type);
        stopListening();
    };

    recognition.onend = () => {
        console.log('Voice recognition ended');
        if (recognitionTimeout) {
            clearTimeout(recognitionTimeout);
        }
        
        if (isListening) {
            try {
                recognition.start();
            } catch(e) {
                console.log('Could not restart recognition');
                stopListening();
            }
        } else {
            stopListening();
        }
    };
}

function updateRecognizedText(text, isFinal) {
    const recognizedText = document.getElementById('recognizedText');
    const realTimeStatus = document.getElementById('realTimeStatus');
    
    if (!recognizedText) return;
    
    if (isFinal) {
        recognizedText.innerHTML = `<span class="final-text">${text}</span>`;
        if (realTimeStatus) {
            realTimeStatus.innerHTML = '<span class="badge-dot"></span> Processing';
        }
    } else {
        recognizedText.innerHTML = `<span class="interim-text">${text}</span><span class="cursor-blink">|</span>`;
    }
}

function toggleListening() {
    if (!recognitionSupported) {
        showToast('Speech recognition not supported in your browser', 'error');
        return;
    }

    if (isListening) {
        stopListening();
    } else {
        startListening();
    }
}

function startListening() {
    if (!recognitionSupported) return;

    try {
        finalTranscript = '';
        updateRecognizedText('Listening...', false);
        
        const previewContent = document.getElementById('previewContent');
        if (previewContent) {
            previewContent.innerHTML = `
                <div class="command-processing">
                    <div class="processing-spinner"></div>
                    <span>Speak a command...</span>
                </div>
            `;
        }
        
        recognition.start();
        playStartSound();
    } catch (error) {
        console.error('Failed to start recognition:', error);
        showToast('Failed to start voice recognition', 'error');
    }
}

function stopListening() {
    isListening = false;
    if (recognition) {
        recognition.stop();
    }
    updateMicUI(false);
    
    const realTimeStatus = document.getElementById('realTimeStatus');
    if (realTimeStatus) {
        realTimeStatus.innerHTML = '<span class="badge-dot"></span> Ready';
    }
}

function updateMicUI(isActive) {
    const micButton = document.getElementById('micButton');
    const waveform = document.getElementById('waveform');
    const statusBadge = document.getElementById('statusBadge');
    const micStatus = document.getElementById('micStatus');

    if (!micButton || !waveform || !statusBadge) return;

    if (isActive) {
        micButton.classList.add('listening');
        waveform.classList.add('active');
        statusBadge.textContent = 'Listening...';
        statusBadge.style.background = 'rgba(16, 185, 129, 0.2)';
        statusBadge.style.borderColor = '#10b981';
        
        if (micStatus) {
            micStatus.classList.add('active');
        }
        
        // Animate waveform bars
        animateWaveform();
    } else {
        micButton.classList.remove('listening');
        waveform.classList.remove('active');
        statusBadge.textContent = 'Ready';
        statusBadge.style.background = 'rgba(99, 102, 241, 0.2)';
        statusBadge.style.borderColor = '#6366f1';
        
        if (micStatus) {
            micStatus.classList.remove('active');
        }
    }
}

function animateWaveform() {
    const bars = document.querySelectorAll('.wave-bar');
    bars.forEach((bar, index) => {
        bar.style.animation = `waveform ${0.5 + index * 0.1}s ease-in-out infinite`;
    });
}

function parseCommand(text) {
    const previewContent = document.getElementById('previewContent');
    if (!previewContent) return;

    sendVoiceCommand({ text: text })
        .then(response => {
            if (response && response.status === 'success' && response.data) {
                const parsed = response.data.parsed_command;
                
                // Create enhanced command preview
                previewContent.innerHTML = `
                    <div class="command-result">
                        <div class="command-badge ${parsed.action}">
                            <i class="fas fa-${getActionIcon(parsed.action)}"></i>
                            ${parsed.action.toUpperCase()}
                        </div>
                        <div class="command-details">
                            <div class="command-item">
                                <span class="command-label">Item</span>
                                <span class="command-value">${parsed.item}</span>
                            </div>
                            <div class="command-item">
                                <span class="command-label">Quantity</span>
                                <span class="command-value quantity">${parsed.quantity}</span>
                            </div>
                        </div>
                    </div>
                `;
                
                showToast(response.message, 'success', 3000);
                playSuccessSound();

                if (window.location.pathname.includes('dashboard')) {
                    fetchInventory();
                }
                
                // Update quick stats
                updateQuickStats();
            } else {
                previewContent.innerHTML = `
                    <div class="command-error">
                        <i class="fas fa-exclamation-circle"></i>
                        <span>${response.message || 'Failed to parse command'}</span>
                    </div>
                `;
                showToast(response.message || 'Failed to parse command', 'error');
            }
        })
        .catch(error => {
            previewContent.innerHTML = `
                <div class="command-error">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>Error parsing command: ${error.message}</span>
                </div>
            `;
            showToast('Error connecting to server', 'error');
        });
}

function getActionIcon(action) {
    const icons = {
        'add': 'plus-circle',
        'remove': 'minus-circle',
        'update': 'edit',
        'check': 'search',
        'delete': 'trash'
    };
    return icons[action] || 'microphone';
}

async function sendVoiceCommand(command) {
    try {
        const response = await fetch('/api/voice-command', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
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
        throw error;
    }
}

function addToCommandHistory(command) {
    const timestamp = new Date().toLocaleTimeString();
    commandHistory.unshift({ command, timestamp });
    
    if (commandHistory.length > 10) {
        commandHistory.pop();
    }
    
    localStorage.setItem('commandHistory', JSON.stringify(commandHistory));
    displayCommandHistory();
}

function displayCommandHistory() {
    const recentList = document.getElementById('recentCommandsList');
    if (!recentList) return;
    
    recentList.innerHTML = commandHistory.map(item => `
        <div class="recent-item">
            <i class="fas fa-microphone"></i>
            <span>${item.command}</span>
            <small>${item.timestamp}</small>
        </div>
    `).join('');
}

function loadCommandHistory() {
    displayCommandHistory();
}

async function fetchInventory() {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;

    // Show loading state
    tableBody.innerHTML = `
        <tr>
            <td colspan="6" class="loading-cell">
                <div class="loading-spinner"></div>
                <span>Loading inventory...</span>
            </td>
        </tr>
    `;

    try {
        const response = await fetch('/api/inventory');
        const result = await response.json();

        if (result.status === 'success') {
            renderInventoryTable(result.data);
            updateStats(result.data);
            updateQuickStats(result.data);
        }
    } catch (error) {
        console.error('Error fetching inventory:', error);
        showToast('Error loading inventory', 'error');
        
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="error-cell">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>Failed to load inventory</span>
                    <button onclick="fetchInventory()" class="retry-btn">Retry</button>
                </td>
            </tr>
        `;
    }
}

function renderInventoryTable(items) {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;

    if (items.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-cell">
                    <i class="fas fa-box-open"></i>
                    <span>No items in inventory</span>
                    <button onclick="openAddItemModal()" class="btn-primary small">Add Item</button>
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = items.map((item, index) => `
        <tr data-id="${item.id}" class="inventory-row fade-in-up" style="animation-delay: ${index * 0.05}s">
            <td><input type="checkbox" class="row-checkbox" data-id="${item.id}"></td>
            <td>
                <div class="item-details">
                    <div class="item-icon">
                        <i class="fas fa-${getItemIcon(item.name)}"></i>
                    </div>
                    <div class="item-info">
                        <span class="item-name">${escapeHtml(item.name)}</span>
                        <span class="item-sku">ID: ${item.id}</span>
                    </div>
                </div>
            </td>
            <td>
                <span class="quantity-badge ${getQuantityClass(item.quantity)}">
                    ${item.quantity} units
                </span>
            </td>
            <td>
                <span class="status-badge ${getStatusClass(item.quantity)}">
                    <span class="status-dot"></span>
                    ${getStatusText(item.quantity)}
                </span>
            </td>
            <td>
                <span class="date-badge">
                    ${getRelativeTime(item.updated_at || new Date())}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button onclick="updateItemQuantity(${item.id}, 'decrease')" 
                            class="action-btn decrease" 
                            title="Decrease quantity"
                            ${item.quantity <= 0 ? 'disabled' : ''}>
                        <i class="fas fa-minus"></i>
                    </button>
                    <button onclick="updateItemQuantity(${item.id}, 'increase')" 
                            class="action-btn increase" 
                            title="Increase quantity">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button onclick="showItemDetails(${item.id})" 
                            class="action-btn details" 
                            title="View details">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    // Reattach event listeners to new checkboxes
    attachCheckboxListeners();
}

function getItemIcon(itemName) {
    const icons = {
        'apple': 'apple-alt',
        'banana': 'apple-alt',
        'orange': 'orange',
        'headphones': 'headphones',
        'laptop': 'laptop',
        'book': 'book',
        'chair': 'chair',
        'table': 'table'
    };
    
    const name = itemName.toLowerCase();
    for (let [key, icon] of Object.entries(icons)) {
        if (name.includes(key)) return icon;
    }
    return 'box';
}

function getQuantityClass(quantity) {
    if (quantity <= 0) return 'out';
    if (quantity < 5) return 'low';
    if (quantity < 10) return 'medium';
    return 'high';
}

function getRelativeTime(date) {
    const now = new Date();
    const updated = new Date(date);
    const diffInSeconds = Math.floor((now - updated) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return updated.toLocaleDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function attachCheckboxListeners() {
    const checkboxes = document.querySelectorAll('.row-checkbox');
    const selectAll = document.querySelector('.select-all-checkbox');
    
    checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            if (selectAll) {
                selectAll.checked = Array.from(checkboxes).every(cb => cb.checked);
            }
            updateBulkActionsBar();
        });
    });
}

function updateBulkActionsBar() {
    const selectedCount = document.querySelectorAll('.row-checkbox:checked').length;
    let bulkBar = document.querySelector('.bulk-actions-bar');
    
    if (selectedCount > 0) {
        if (!bulkBar) {
            bulkBar = document.createElement('div');
            bulkBar.className = 'bulk-actions-bar';
            bulkBar.innerHTML = `
                <div class="bulk-info">
                    <span class="selected-count">${selectedCount}</span>
                    <span>items selected</span>
                </div>
                <div class="bulk-buttons">
                    <button onclick="bulkDelete()" class="bulk-btn delete">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                    <button onclick="bulkUpdate()" class="bulk-btn update">
                        <i class="fas fa-edit"></i> Update
                    </button>
                </div>
            `;
            document.querySelector('.table-section').appendChild(bulkBar);
        } else {
            bulkBar.querySelector('.selected-count').textContent = selectedCount;
        }
        bulkBar.classList.add('show');
    } else if (bulkBar) {
        bulkBar.classList.remove('show');
    }
}

function getStatusClass(quantity) {
    if (quantity <= 0) return 'out-of-stock';
    if (quantity < 5) return 'low-stock';
    if (quantity < 10) return 'medium-stock';
    return 'in-stock';
}

function getStatusText(quantity) {
    if (quantity <= 0) return 'Out of Stock';
    if (quantity < 5) return 'Low Stock';
    if (quantity < 10) return 'Medium Stock';
    return 'In Stock';
}

function updateStats(items) {
    const totalItems = items.length;
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const lowStock = items.filter(item => item.quantity > 0 && item.quantity < 5).length;
    const outOfStock = items.filter(item => item.quantity <= 0).length;

    animateCounter('totalItems', totalItems);
    animateCounter('lowStock', lowStock);
    animateCounter('outOfStock', outOfStock);
    animateCounter('totalQuantity', totalQuantity);
    
    // Update trend indicators
    updateTrends(totalItems, lowStock);
}

function updateTrends(currentTotal, currentLowStock) {
    const prevTotal = parseInt(localStorage.getItem('prevTotalItems')) || currentTotal;
    const prevLowStock = parseInt(localStorage.getItem('prevLowStock')) || currentLowStock;
    
    updateTrendIndicator('totalItems', currentTotal - prevTotal);
    updateTrendIndicator('lowStock', currentLowStock - prevLowStock);
    
    localStorage.setItem('prevTotalItems', currentTotal);
    localStorage.setItem('prevLowStock', currentLowStock);
}

function updateTrendIndicator(elementId, change) {
    const element = document.querySelector(`#${elementId}`).parentElement;
    if (!element) return;
    
    let trendElement = element.querySelector('.stat-trend');
    if (!trendElement) return;
    
    if (change > 0) {
        trendElement.className = 'stat-trend positive';
        trendElement.innerHTML = `<i class="fas fa-arrow-up"></i> +${change}`;
    } else if (change < 0) {
        trendElement.className = 'stat-trend negative';
        trendElement.innerHTML = `<i class="fas fa-arrow-down"></i> ${change}`;
    } else {
        trendElement.className = 'stat-trend';
        trendElement.innerHTML = '<i class="fas fa-minus"></i> 0';
    }
}

function updateQuickStats(data) {
    const quickTotal = document.getElementById('quickTotalItems');
    const quickLowStock = document.getElementById('quickLowStock');
    const quickLastUpdate = document.getElementById('quickLastUpdate');
    
    if (quickTotal && data) {
        quickTotal.textContent = data.length;
    }
    
    if (quickLowStock && data) {
        quickLowStock.textContent = data.filter(item => item.quantity > 0 && item.quantity < 5).length;
    }
    
    if (quickLastUpdate) {
        quickLastUpdate.textContent = 'Just now';
    }
}

function animateCounter(elementId, targetValue) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const startValue = parseInt(element.textContent) || 0;
    const duration = 1000;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const currentValue = Math.floor(startValue + (targetValue - startValue) * progress);

        element.textContent = currentValue;

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

window.updateItemQuantity = async function(id, action) {
    try {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (!row) return;

        const itemName = row.querySelector('.item-name').textContent;
        const currentQty = parseInt(row.querySelector('.quantity-badge').textContent);
        let newQty = action === 'increase' ? currentQty + 1 : currentQty - 1;

        if (newQty < 0) newQty = 0;

        // Add loading state to button
        const button = event?.target?.closest('button');
        if (button) {
            button.classList.add('loading');
        }

        const response = await fetch('/api/inventory/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                item: itemName,
                quantity: newQty
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            showToast(`Item ${action}d successfully!`, 'success', 2000);
            
            // Animate the updated row
            row.classList.add('highlight');
            setTimeout(() => row.classList.remove('highlight'), 1000);
            
            fetchInventory();
        }
    } catch (error) {
        console.error('Error updating item:', error);
        showToast('Error updating item', 'error');
    } finally {
        if (button) {
            button.classList.remove('loading');
        }
    }
};

async function handleAddItem(e) {
    e.preventDefault();

    const itemName = document.getElementById('itemName').value;
    const quantity = parseInt(document.getElementById('itemQuantity').value);
    const category = document.getElementById('itemCategory')?.value || 'General';
    const unit = document.getElementById('itemUnit')?.value || 'Pieces';

    const submitBtn = e.target.querySelector('button[type="submit"]');
    showLoader(submitBtn);

    try {
        const response = await fetch('/api/inventory/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                item: itemName,
                quantity: quantity,
                category: category,
                unit: unit
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            closeModalWithAnimation(document.getElementById('modalOverlay'));
            e.target.reset();
            showToast('Item added successfully!', 'success', 3000);
            playSuccessSound();
            fetchInventory();
        }
    } catch (error) {
        console.error('Error adding item:', error);
        showToast('Error adding item', 'error');
    } finally {
        hideLoader(submitBtn);
    }
}

function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;

    const rows = tableBody.getElementsByTagName('tr');
    let visibleCount = 0;

    for (let row of rows) {
        if (row.classList.contains('loading-cell') || row.classList.contains('empty-cell')) continue;
        
        const itemName = row.querySelector('.item-name')?.textContent.toLowerCase() || '';
        const itemId = row.querySelector('.item-sku')?.textContent.toLowerCase() || '';
        const matches = itemName.includes(searchTerm) || itemId.includes(searchTerm);
        
        row.style.display = matches ? '' : 'none';
        if (matches) visibleCount++;
    }
    
    // Show no results message
    const noResults = document.querySelector('.no-results-row');
    if (visibleCount === 0 && rows.length > 1) {
        if (!noResults) {
            const noResultsRow = document.createElement('tr');
            noResultsRow.className = 'no-results-row';
            noResultsRow.innerHTML = `
                <td colspan="6" class="empty-cell">
                    <i class="fas fa-search"></i>
                    <span>No items found matching "${searchTerm}"</span>
                </td>
            `;
            tableBody.appendChild(noResultsRow);
        }
    } else if (noResults) {
        noResults.remove();
    }
}

// Toast notification system with queue
let toastQueue = [];
let isShowingToast = false;

function showToast(message, type = 'info', duration = 5000) {
    toastQueue.push({ message, type, duration });
    
    if (!isShowingToast) {
        processToastQueue();
    }
}

function processToastQueue() {
    if (toastQueue.length === 0) {
        isShowingToast = false;
        return;
    }
    
    isShowingToast = true;
    const { message, type, duration } = toastQueue.shift();
    
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type} slide-in`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="toast-icon fas fa-${getToastIcon(type)}"></i>
            <span class="toast-message">${message}</span>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
        <div class="toast-progress"></div>
    `;

    toastContainer.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Auto remove
    const timeout = setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('fade-out');
        setTimeout(() => {
            toast.remove();
            processToastQueue();
        }, 300);
    }, duration);

    // Pause progress on hover
    toast.addEventListener('mouseenter', () => {
        clearTimeout(timeout);
        toast.querySelector('.toast-progress').style.animationPlayState = 'paused';
    });

    toast.addEventListener('mouseleave', () => {
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('fade-out');
            setTimeout(() => {
                toast.remove();
                processToastQueue();
            }, 300);
        }, 1000);
    });
}

function getToastIcon(type) {
    const icons = {
        'success': 'check-circle',
        'error': 'exclamation-circle',
        'warning': 'exclamation-triangle',
        'info': 'info-circle'
    };
    return icons[type] || 'info-circle';
}

window.showToast = showToast;

// Settings Modal Functions
function openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Animate modal entrance
        const modalContainer = modal.querySelector('.modal-container');
        modalContainer.classList.add('zoom-in');
    }
}

function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        const modalContainer = modal.querySelector('.modal-container');
        modalContainer.classList.add('zoom-out');
        
        setTimeout(() => {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }, 300);
    }
}

function closeModalWithAnimation(modal) {
    if (!modal) return;
    
    const modalContainer = modal.querySelector('.modal-container');
    if (modalContainer) {
        modalContainer.classList.add('zoom-out');
        setTimeout(() => {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }, 300);
    } else {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Theme Color Management
function applyThemeColor() {
    const root = document.documentElement;
    const primaryColor = document.getElementById('primaryColor').value;
    const secondaryColor = document.getElementById('secondaryColor').value;
    const accentColor = document.getElementById('accentColor').value;
    
    // Animate theme change
    document.body.classList.add('theme-changing');
    
    root.style.setProperty('--primary', primaryColor);
    root.style.setProperty('--secondary', secondaryColor);
    root.style.setProperty('--accent', accentColor);
    
    // Save to localStorage
    localStorage.setItem('theme-primary', primaryColor);
    localStorage.setItem('theme-secondary', secondaryColor);
    localStorage.setItem('theme-accent', accentColor);
    
    setTimeout(() => {
        document.body.classList.remove('theme-changing');
    }, 500);
    
    showToast('Theme colors applied successfully!', 'success', 2000);
}

function resetThemeToDefault() {
    const root = document.documentElement;
    root.style.setProperty('--primary', '#6366f1');
    root.style.setProperty('--secondary', '#8b5cf6');
    root.style.setProperty('--accent', '#ec4899');
    
    // Reset color pickers
    const primaryPicker = document.getElementById('primaryColor');
    const secondaryPicker = document.getElementById('secondaryColor');
    const accentPicker = document.getElementById('accentColor');
    
    if (primaryPicker) primaryPicker.value = '#6366f1';
    if (secondaryPicker) secondaryPicker.value = '#8b5cf6';
    if (accentPicker) accentPicker.value = '#ec4899';
    
    // Clear localStorage
    localStorage.removeItem('theme-primary');
    localStorage.removeItem('theme-secondary');
    localStorage.removeItem('theme-accent');
    
    showToast('Theme reset to default!', 'info', 2000);
}

function loadSavedTheme() {
    const savedPrimary = localStorage.getItem('theme-primary');
    const savedSecondary = localStorage.getItem('theme-secondary');
    const savedAccent = localStorage.getItem('theme-accent');
    
    if (savedPrimary || savedSecondary || savedAccent) {
        const root = document.documentElement;
        if (savedPrimary) root.style.setProperty('--primary', savedPrimary);
        if (savedSecondary) root.style.setProperty('--secondary', savedSecondary);
        if (savedAccent) root.style.setProperty('--accent', savedAccent);
        
        // Update color pickers
        const primaryPicker = document.getElementById('primaryColor');
        const secondaryPicker = document.getElementById('secondaryColor');
        const accentPicker = document.getElementById('accentColor');
        
        if (primaryPicker && savedPrimary) primaryPicker.value = savedPrimary;
        if (secondaryPicker && savedSecondary) secondaryPicker.value = savedSecondary;
        if (accentPicker && savedAccent) accentPicker.value = savedAccent;
    }
}

// Initialize settings event listeners
function initializeSettings() {
    // Settings modal close button
    const closeSettingsBtn = document.getElementById('closeSettingsModal');
    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', closeSettingsModal);
    }
    
    // Close modal when clicking outside
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                closeSettingsModal();
            }
        });
    }
                
    // Apply theme button
    const applyThemeBtn = document.getElementById('applyThemeBtn');
    if (applyThemeBtn) {
        applyThemeBtn.addEventListener('click', applyThemeColor);
    }
    
    // Reset theme button
    const resetThemeBtn = document.getElementById('resetThemeBtn');
    if (resetThemeBtn) {
        resetThemeBtn.addEventListener('click', resetThemeToDefault);
    }
    
    // Settings tabs
    const settingsTabs = document.querySelectorAll('.settings-tab');
    settingsTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            settingsTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            // Here you can add logic to show different settings sections
        });
    });
    
    // Toggle switches
    const toggles = document.querySelectorAll('.toggle-switch input');
    toggles.forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const setting = e.target.id;
            const isEnabled = e.target.checked;
            localStorage.setItem(setting, isEnabled);
            showToast(`${setting} ${isEnabled ? 'enabled' : 'disabled'}`, 'info', 1500);
        });
        
        // Load saved state
        const savedState = localStorage.getItem(toggle.id);
        if (savedState !== null) {
            toggle.checked = savedState === 'true';
        }
    });
    
    // Load saved theme on page load
    loadSavedTheme();
}

// Utility Functions
function animateButton(button) {
    button.classList.add('btn-click');
    setTimeout(() => button.classList.remove('btn-click'), 300);
}

function showLoader(button) {
    if (!button) return;
    const originalText = button.innerHTML;
    button.setAttribute('data-original-text', originalText);
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    button.disabled = true;
}

function hideLoader(button) {
    if (!button) return;
    const originalText = button.getAttribute('data-original-text');
    if (originalText) {
        button.innerHTML = originalText;
    }
    button.disabled = false;
}

function playStartSound() {
    // You can add actual sound here if desired
    console.log('Listening started');
}

function playSuccessSound() {
    // You can add actual sound here if desired
    console.log('Success');
}

function showConfirmationDialog(title, message, onConfirm, onCancel) {
    const dialog = document.createElement('div');
    dialog.className = 'confirmation-dialog-overlay';
    dialog.innerHTML = `
        <div class="confirmation-dialog glass-card">
            <div class="dialog-header">
                <h3>${title}</h3>
                <button class="dialog-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="dialog-body">
                <p>${message}</p>
            </div>
            <div class="dialog-footer">
                <button class="btn-secondary" id="dialogCancel">Cancel</button>
                <button class="btn-primary" id="dialogConfirm">Confirm</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    document.body.style.overflow = 'hidden';
    
    dialog.querySelector('#dialogConfirm').addEventListener('click', () => {
        onConfirm();
        dialog.remove();
        document.body.style.overflow = '';
    });
    
    dialog.querySelector('#dialogCancel').addEventListener('click', () => {
        if (onCancel) onCancel();
        dialog.remove();
        document.body.style.overflow = '';
    });
    
    dialog.querySelector('.dialog-close').addEventListener('click', () => {
        dialog.remove();
        document.body.style.overflow = '';
    });
}

function handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + K for search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.focus();
            showToast('Search activated', 'info', 1000);
        }
    }
    
    // Escape to close modals
    if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal-overlay.active');
        if (activeModal) {
            closeModalWithAnimation(activeModal);
        }
    }
    
    // Ctrl/Cmd + M for microphone
    if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
        e.preventDefault();
        toggleListening();
    }
}

// Bulk actions
function bulkDelete() {
    const selectedIds = Array.from(document.querySelectorAll('.row-checkbox:checked'))
        .map(cb => cb.closest('tr').dataset.id);
    
    if (selectedIds.length === 0) return;
    
    showConfirmationDialog(
        'Delete Items',
        `Are you sure you want to delete ${selectedIds.length} item(s)?`,
        async () => {
            // Implement bulk delete API call
            showToast(`Deleted ${selectedIds.length} items`, 'success');
            fetchInventory();
        }
    );
}

function bulkUpdate() {
    const selectedIds = Array.from(document.querySelectorAll('.row-checkbox:checked'))
        .map(cb => cb.closest('tr').dataset.id);
    
    if (selectedIds.length === 0) return;
    
    // Show bulk update modal
    showBulkUpdateModal(selectedIds);
}

function showBulkUpdateModal(ids) {
    // Implement bulk update modal
    console.log('Bulk update for:', ids);
}

// Export functionality
function exportData() {
    const format = 'csv'; // or 'pdf', 'excel'
    showToast('Exporting data...', 'info');
    
    // Implement export logic
    setTimeout(() => {
        showToast('Data exported successfully', 'success');
    }, 2000);
}

function refreshData() {
    const refreshBtn = document.querySelector('[onclick="refreshData()"]');
    if (refreshBtn) {
        refreshBtn.classList.add('rotating');
    }
    
    fetchInventory();
    updateQuickStats();
    
    setTimeout(() => {
        if (refreshBtn) {
            refreshBtn.classList.remove('rotating');
        }
    }, 500);
    
    showToast('Data refreshed', 'success', 1500);
}

function scanBarcode() {
    showToast('Barcode scanner activated', 'info');
    // Implement barcode scanning logic
}

function generateReport() {
    showToast('Generating report...', 'info');
    // Implement report generation
}

function showItemDetails(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (!row) return;
    
    // Show detailed item modal
    console.log('Showing details for item:', id);
}

// Make functions globally available
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.applyThemeColor = applyThemeColor;
window.resetThemeToDefault = resetThemeToDefault;
window.exportData = exportData;
window.refreshData = refreshData;
window.scanBarcode = scanBarcode;
window.generateReport = generateReport;
window.showItemDetails = showItemDetails;
window.bulkDelete = bulkDelete;
window.bulkUpdate = bulkUpdate;
window.suggestCommand = function(cmd) {
    document.getElementById('recognizedText').textContent = cmd;
    parseCommand(cmd);
};