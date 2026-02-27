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

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
    initializePage();
});

function initializePage() {
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
    if (document.getElementById('inventoryTable')) {
        fetchInventory();
    }
    setupSpeechRecognition();
}

function setupSpeechRecognition() {
    if (!recognitionSupported || !recognition) {
        console.log('Speech recognition not available');
        return;
    }
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
        languageSelect.addEventListener('change', (e) => {
            recognition.lang = e.target.value;
            showToast(`Language changed`, 'info');
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
        stopListening();
    };
    recognition.onend = () => {
        console.log('Voice recognition ended');
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
        document.getElementById('recognizedText').textContent = 'Listening...';
        document.getElementById('previewContent').innerHTML = '<p>Speak a command...</p>';
        recognition.start();
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
}

function updateMicUI(isActive) {
    const micButton = document.getElementById('micButton');
    const waveform = document.getElementById('waveform');
    const statusBadge = document.getElementById('statusBadge');
    if (!micButton || !waveform || !statusBadge) return;
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

function parseCommand(text) {
    const previewContent = document.getElementById('previewContent');
    if (!previewContent) return;
    sendVoiceCommand({ text: text })
        .then(response => {
            if (response && response.data) {
                const parsed = response.data.parsed_command;
                previewContent.innerHTML = `
                    <div style="padding: 15px; background: rgba(16, 185, 129, 0.1); border-radius: 8px;">
                        <p><strong>Action:</strong> ${parsed.action} <strong>Item:</strong> ${parsed.item} <strong>Quantity:</strong> ${parsed.quantity}</p>
                    </div>
                `;
                showToast(response.message, 'success');
                if (window.location.pathname.includes('dashboard')) {
                    fetchInventory();
                }
            }
        })
        .catch(error => {
            previewContent.innerHTML = `<p style="color: red;">Error parsing command: ${error.message}</p>`;
        });
}

async function sendVoiceCommand(command) {
    try {
        const response = await fetch('http://localhost:5000/api/voice-command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

async function fetchInventory() {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;
    try {
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
    tableBody.innerHTML = items.map((item, idx) => `
        <tr data-id="${item.id}">
            <td>${item.name}</td>
            <td>${item.quantity}</td>
            <td><span class="status-badge ${getStatusClass(item.quantity)}">${getStatusText(item.quantity)}</span></td>
            <td>
                <button onclick="updateItemQuantity(${item.id}, 'decrease')" class="action-btn">-</button>
                <button onclick="updateItemQuantity(${item.id}, 'increase')" class="action-btn">+</button>
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
    const lowStock = items.filter(item => item.quantity > 0 && item.quantity < 5).length;
    animateCounter('totalItems', totalItems);
    animateCounter('lowStock', lowStock);
    animateCounter('recentUpdates', 5);
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
        const itemName = row.cells[0].textContent;
        const currentQty = parseInt(row.cells[1].textContent);
        let newQty = action === 'increase' ? currentQty + 1 : currentQty - 1;
        if (newQty < 0) newQty = 0;
        const response = await fetch('http://localhost:5000/api/inventory/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item: itemName, quantity: newQty })
        });
        const result = await response.json();
        if (result.status === 'success') {
            showToast(`Item ${action}d successfully!`, 'success');
            fetchInventory();
        }
    } catch (error) {
        console.error('Error updating item:', error);
        showToast('Error updating item', 'error');
    }
};

async function handleAddItem(e) {
    e.preventDefault();
    const itemName = document.getElementById('itemName').value;
    const quantity = parseInt(document.getElementById('itemQuantity').value);
    try {
        const response = await fetch('http://localhost:5000/api/inventory/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item: itemName, quantity: quantity })
        });
        const result = await response.json();
        if (result.status === 'success') {
            document.getElementById('modalOverlay').classList.remove('active');
            e.target.reset();
            showToast('Item added successfully!', 'success');
            fetchInventory();
        }
    } catch (error) {
        console.error('Error adding item:', error);
        showToast('Error adding item', 'error');
    }
}

function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;
    const rows = tableBody.getElementsByTagName('tr');
    for (let row of rows) {
        const itemName = row.cells[0].textContent.toLowerCase();
        row.style.display = itemName.includes(searchTerm) ? '' : 'none';
    }
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<p>${message}</p><button onclick="this.parentElement.remove()">×</button>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

window.showToast = showToast;
