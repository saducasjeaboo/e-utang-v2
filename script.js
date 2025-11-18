// script.js

document.addEventListener('DOMContentLoaded', () => {

    // --- State ---
    let currentPage = 'debtors';
    let currentDebtorId = null;
    let debtorsCache = []; // For search filtering

    // --- Selectors ---
    const pageContent = document.getElementById('page-content');
    const navButtons = document.querySelectorAll('.nav-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const searchBtn = document.getElementById('search-btn');
    const searchBar = document.getElementById('search-bar');
    const searchInput = document.getElementById('search-input');
    const closeSearchBtn = document.getElementById('close-search');
    const modalOverlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalConfirm = document.getElementById('modal-confirm');
    const modalCancel = document.getElementById('modal-cancel');
    const toast = document.getElementById('toast');

    // --- Modal & Toast Functions ---
    let confirmCallback = null;
    
    function showModal({ title, message, confirmText = 'Confirm', confirmClass = 'btn-danger' }, callback) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalConfirm.textContent = confirmText;
        modalConfirm.className = `btn ${confirmClass}`;
        modalOverlay.classList.remove('hidden');
        confirmCallback = callback;
    }

    function hideModal() {
        modalOverlay.classList.add('hidden');
        confirmCallback = null;
    }

    modalConfirm.addEventListener('click', () => {
        if (confirmCallback) {
            confirmCallback();
        }
        hideModal();
    });
    modalCancel.addEventListener('click', hideModal);

    function showToast(message, type = 'success', duration = 3000) {
        toast.textContent = message;
        toast.className = type; // 'success' or 'error'
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }

    // --- API Helper ---
    async function apiCall(formData) {
        try {
            const response = await fetch('api.php', {
                method: 'POST',
                body: formData
            });
            if (response.status === 401) {
                // Not authenticated, redirect to login
                window.location.href = 'login.php';
                return null;
            }
            const result = await response.json();
            if (!result.success) {
                showToast(result.message || 'An API error occurred.', 'error');
                return null;
            }
            return result;
        } catch (error) {
            console.error('API Call Failed:', error);
            showToast('Network error or server is down.', 'error');
            return null;
        }
    }

    // --- Theme ---
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            themeToggle.innerHTML = `<span class="material-icons-outlined">light_mode</span>`;
        } else {
            document.body.classList.remove('dark-mode');
            themeToggle.innerHTML = `<span class="material-icons-outlined">dark_mode</span>`;
        }
    }

    function toggleTheme() {
        const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    }

    themeToggle.addEventListener('click', toggleTheme);

    // --- Search ---
    searchBtn.addEventListener('click', () => {
        searchBar.classList.remove('hidden');
        searchBtn.classList.add('hidden');
        searchInput.focus();
    });

    closeSearchBtn.addEventListener('click', () => {
        searchBar.classList.add('hidden');
        searchBtn.classList.remove('hidden');
        searchInput.value = '';
        filterDebtors(''); // Clear filter
    });

    searchInput.addEventListener('keyup', (e) => {
        filterDebtors(e.target.value);
    });

    function filterDebtors(searchTerm) {
        const term = searchTerm.toLowerCase();
        const list = document.getElementById('debtor-list');
        if (!list) return;

        const cards = list.querySelectorAll('.debtor-card');
        cards.forEach(card => {
            const name = card.dataset.name.toLowerCase();
            if (name.includes(term)) {
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        });
    }

    // --- Date Formatter ---
    function formatDate(dateString) {
        // Input: 'YYYY-MM-DD HH:MM:SS'
        const date = new Date(dateString);
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const yyyy = date.getFullYear();
        return `${mm}/${dd}/${yyyy}`;
    }

    // --- Navigation Router ---
    function navigateTo(page, params = {}) {
        currentPage = page;
        currentDebtorId = params.id || null;
        
        // Update nav buttons
        navButtons.forEach(btn => {
            if (btn.dataset.page === page) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Show/hide search
        if (page === 'debtors') {
            searchBtn.classList.remove('hidden');
        } else {
            searchBtn.classList.add('hidden');
            searchBar.classList.add('hidden');
            searchInput.value = '';
        }

        // Load page content
        pageContent.innerHTML = '<h2>Loading...</h2>'; // Placeholder
        switch (page) {
            case 'debtors':
                loadDebtorsPage();
                break;
            case 'details':
                loadDebtorDetailsPage(currentDebtorId);
                break;
            case 'calculator':
                loadCalculatorPage();
                break;
            case 'settings':
                loadSettingsPage();
                break;
            case 'trash':
                loadTrashPage();
                break;
        }
    }

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            navigateTo(btn.dataset.page);
        });
    });

    // --- Page Loaders ---

    // 1. Debtors Page
    async function loadDebtorsPage() {
        const formData = new FormData();
        formData.append('action', 'get_debtors');
        const data = await apiCall(formData);
        
        if (!data) return;
        debtorsCache = data.debtors; // Cache for searching

        let content = `
            <div id="add-debtor-form">
                <input type="text" id="new-debtor-name" placeholder="Enter new debtor's name...">
                <button id="add-debtor-btn" class="btn btn-primary">Add</button>
            </div>
            <div id="debtor-list">
                ${debtorsCache.length === 0 ? '<p class="text-muted">No debtors found. Add one above!</p>' : ''}
                ${debtorsCache.map(d => `
                    <div class="card debtor-card" data-id="${d.id}" data-name="${d.name}">
                        <div class="debtor-info">
                            <div class="debtor-name">${d.name}</div>
                            <div class="debtor-date">Added: ${formatDate(d.date_added)}</div>
                        </div>
                        <div class="debtor-status status-${d.status.toLowerCase()}">${d.status}</div>
                        <button class="btn-icon btn-delete-debtor" data-id="${d.id}" data-name="${d.name}">
                            <span class="material-icons-outlined">delete</span>
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
        pageContent.innerHTML = content;
        addDebtorsPageListeners();
    }

    function addDebtorsPageListeners() {
        // Add new debtor
        document.getElementById('add-debtor-btn').addEventListener('click', async () => {
            const name = document.getElementById('new-debtor-name').value.trim();
            if (!name) {
                showToast('Please enter a name.', 'error');
                return;
            }
            
            const formData = new FormData();
            formData.append('action', 'add_debtor');
            formData.append('name', name);
            const data = await apiCall(formData);

            if (data) {
                showToast('Debtor added successfully!', 'success');
                // Add to top of list
                const list = document.getElementById('debtor-list');
                const newCard = document.createElement('div');
                newCard.className = 'card debtor-card';
                newCard.dataset.id = data.debtor.id;
                newCard.dataset.name = data.debtor.name;
                newCard.innerHTML = `
                    <div class="debtor-info">
                        <div class="debtor-name">${data.debtor.name}</div>
                        <div class="debtor-date">Added: ${formatDate(data.debtor.date_added)}</div>
                    </div>
                    <div class="debtor-status status-${data.debtor.status.toLowerCase()}">${data.debtor.status}</div>
                    <button class="btn-icon btn-delete-debtor" data-id="${data.debtor.id}" data-name="${data.debtor.name}">
                        <span class="material-icons-outlined">delete</span>
                    </button>
                `;
                list.prepend(newCard);
                document.getElementById('new-debtor-name').value = '';
                // Re-add listeners to the new card's buttons
                addCardListeners(newCard);
            }
        });

        // Add listeners to all cards
        document.querySelectorAll('.debtor-card').forEach(card => {
            addCardListeners(card);
        });
    }
    
    function addCardListeners(card) {
        // Click card to see details
        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-delete-debtor')) return; // Don't navigate if delete is clicked
            navigateTo('details', { id: card.dataset.id });
        });

        // Delete button
        card.querySelector('.btn-delete-debtor').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click
            const id = e.currentTarget.dataset.id;
            const name = e.currentTarget.dataset.name;
            
            showModal({
                title: 'Delete Debtor?',
                message: `Are you sure you want to move "${name}" to the trash? This will not delete their items yet.`
            }, async () => {
                const formData = new FormData();
                formData.append('action', 'delete_debtor');
                formData.append('id', id);
                const data = await apiCall(formData);
                if (data) {
                    showToast(data.message, 'success');
                    card.remove(); // Remove from UI
                }
            });
        });
    }

    // 2. Debtor Details Page
    async function loadDebtorDetailsPage(id) {
        const data = await apiCall(new FormData()); // Fails, need to use GET
        
        // Use GET for fetching details
        try {
            const response = await fetch(`api.php?action=get_debtor_details&id=${id}`);
            if (response.status === 401) {
                window.location.href = 'login.php';
                return;
            }
            const data = await response.json();

            if (!data.success) {
                showToast(data.message, 'error');
                navigateTo('debtors'); // Go back if debtor not found
                return;
            }

            const { debtor, items } = data;
            const totalOwedFormatted = debtor.total_owed.toFixed(2);

            let content = `
                <div class="page-header">
                    <button class="btn-icon btn-back">
                        <span class="material-icons-outlined">arrow_back</span>
                    </button>
                    <h2>${debtor.name}</h2>
                </div>
                <h3 id="total-owed">Total Owed: <span class="status-unpaid">₱${totalOwedFormatted}</span></h3>
                
                <div id="add-item-form" class="card">
                    <h4>Add New Item</h4>
                    <div class="form-row">
                        <div class="input-group">
                            <label for="item-name">Item Name</label>
                            <input type="text" id="item-name" placeholder="e.g., Coke">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="input-group">
                            <label for="item-qty">Quantity</label>
                            <input type="number" id="item-qty" placeholder="1" value="1">
                        </div>
                        <div class="input-group">
                            <label for="item-price">Price (each)</label>
                            <input type="number" id="item-price" placeholder="15.00">
                        </div>
                    </div>
                    <button id="add-item-btn" class="btn btn-primary">Add Item</button>
                </div>

                <div class="details-actions">
                    <button id="btn-pay-all" class="btn btn-success" data-id="${debtor.id}">Paid All</button>
                </div>

                <div id="item-list">
                    ${items.length === 0 ? '<p class="text-muted">No items found for this debtor.</p>' : ''}
                    ${items.map(item => renderItemCard(item)).join('')}
                </div>
            `;
            pageContent.innerHTML = content;
            addDetailsPageListeners(debtor.id);

        } catch (error) {
            console.error(error);
            showToast('Failed to load debtor details.', 'error');
        }
    }
    
    function renderItemCard(item) {
        const itemTotal = (item.quantity * item.price).toFixed(2);
        return `
            <div class="card item-card ${item.is_paid ? 'paid' : ''}" data-id="${item.id}">
                <div class="item-info">
                    <div class="item-name">${item.item_name}</div>
                    <div class="item-details">
                        ${item.quantity} x ₱${Number(item.price).toFixed(2)}
                        &bull; ${formatDate(item.date_added)}
                    </div>
                </div>
                <div class="item-price">₱${itemTotal}</div>
                <div class="item-actions">
                    <button class="btn btn-toggle-paid ${item.is_paid ? 'btn-warning' : 'btn-success'}" data-id="${item.id}">
                        ${item.is_paid ? 'Mark Unpaid' : 'Mark Paid'}
                    </button>
                    <button class="btn btn-danger btn-delete-item" data-id="${item.id}">
                        Trash
                    </button>
                </div>
            </div>
        `;
    }

    function addDetailsPageListeners(debtorId) {
        // Back button
        pageContent.querySelector('.btn-back').addEventListener('click', () => {
            navigateTo('debtors');
        });

        // Add Item
        pageContent.querySelector('#add-item-btn').addEventListener('click', async () => {
            const name = pageContent.querySelector('#item-name').value;
            const qty = pageContent.querySelector('#item-qty').value;
            const price = pageContent.querySelector('#item-price').value;

            if (!name || !qty || !price) {
                showToast('Please fill all item fields.', 'error');
                return;
            }

            const formData = new FormData();
            formData.append('action', 'add_item');
            formData.append('debtor_id', debtorId);
            formData.append('item_name', name);
            formData.append('quantity', qty);
            formData.append('price', price);
            
            const data = await apiCall(formData);
            if (data) {
                showToast('Item added!', 'success');
                // Just reload the whole page for simplicity to update total
                loadDebtorDetailsPage(debtorId); 
            }
        });

        // Pay All
        pageContent.querySelector('#btn-pay-all').addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            showModal({
                title: 'Mark All Paid?',
                message: 'Are you sure you want to mark all unpaid items as paid?',
                confirmClass: 'btn-success'
            }, async () => {
                const formData = new FormData();
                formData.append('action', 'mark_all_paid');
                formData.append('debtor_id', id);
                const data = await apiCall(formData);
                if (data) {
                    loadDebtorDetailsPage(id); // Reload
                }
            });
        });
        
        // Item button listeners
        pageContent.querySelectorAll('.item-card').forEach(card => {
            addItemCardListeners(card, debtorId);
        });
    }
    
    function addItemCardListeners(card, debtorId) {
        // Toggle Paid
        card.querySelector('.btn-toggle-paid').addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            const formData = new FormData();
            formData.append('action', 'toggle_item_paid');
            formData.append('id', id);
            const data = await apiCall(formData);
            if (data) {
                loadDebtorDetailsPage(debtorId); // Reload
            }
        });

        // Delete Item (Move to Trash)
        card.querySelector('.btn-delete-item').addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            showModal({
                title: 'Trash Item?',
                message: 'Are you sure you want to move this item to the trash?'
            }, async () => {
                const formData = new FormData();
                formData.append('action', 'delete_item');
                formData.append('id', id);
                const data = await apiCall(formData);
                if (data) {
                    showToast(data.message, 'success');
                    loadDebtorDetailsPage(debtorId); // Reload
                }
            });
        });
    }

    // 3. Calculator Page
    function loadCalculatorPage() {
        let displayValue = '0';
        let firstOperand = null;
        let operator = null;
        let waitingForSecondOperand = false;

        let content = `
            <h2>Calculator</h2>
            <div id="calculator">
                <input type="text" id="calc-display" value="0" disabled>
                <div id="calc-keys">
                    <button class="btn" data-key="clear">AC</button>
                    <button class="btn operator" data-key="sign">+/-</button>
                    <button class="btn operator" data-key="%">%</button>
                    <button class="btn operator" data-key="/">÷</button>
                    
                    <button class="btn" data-key="7">7</button>
                    <button class="btn" data-key="8">8</button>
                    <button class="btn" data-key="9">9</button>
                    <button class="btn operator" data-key="*">×</button>
                    
                    <button class="btn" data-key="4">4</button>
                    <button class="btn" data-key="5">5</button>
                    <button class="btn" data-key="6">6</button>
                    <button class="btn operator" data-key="-">−</button>
                    
                    <button class="btn" data-key="1">1</button>
                    <button class="btn" data-key="2">2</button>
                    <button class="btn" data-key="3">3</button>
                    <button class="btn operator" data-key="+">+</button>
                    
                    <button class="btn" data-key="0">0</button>
                    <button class="btn" data-key=".">.</button>
                    <button class="btn equals" data-key="=">=</button>
                </div>
            </div>
        `;
        pageContent.innerHTML = content;

        const display = pageContent.querySelector('#calc-display');
        
        function updateDisplay() {
            display.value = displayValue;
        }

        pageContent.querySelector('#calc-keys').addEventListener('click', (e) => {
            const key = e.target.dataset.key;
            if (!key) return;

            if (/\d/.test(key)) { // Digit
                if (waitingForSecondOperand) {
                    displayValue = key;
                    waitingForSecondOperand = false;
                } else {
                    displayValue = displayValue === '0' ? key : displayValue + key;
                }
            } else if (key === '.') { // Decimal
                if (!displayValue.includes('.')) {
                    displayValue += '.';
                }
            } else if (key === 'clear') { // Clear
                displayValue = '0';
                firstOperand = null;
                operator = null;
                waitingForSecondOperand = false;
            } else if (key === 'sign') { // Toggle Sign
                displayValue = String(parseFloat(displayValue) * -1);
            } else if (key === '%') { // Percent
                displayValue = String(parseFloat(displayValue) / 100);
            } else if (key === '=') { // Equals
                if (firstOperand !== null && operator) {
                    const secondOperand = parseFloat(displayValue);
                    let result = 0;
                    if (operator === '+') result = firstOperand + secondOperand;
                    else if (operator === '-') result = firstOperand - secondOperand;
                    else if (operator === '*') result = firstOperand * secondOperand;
                    else if (operator === '/') result = firstOperand / secondOperand;
                    displayValue = String(result);
                    firstOperand = null;
                    operator = null;
                }
            } else { // Operator
                if (firstOperand === null) {
                    firstOperand = parseFloat(displayValue);
                } else if (operator) {
                    // Chain operation
                    const secondOperand = parseFloat(displayValue);
                    let result = 0;
                    if (operator === '+') result = firstOperand + secondOperand;
                    else if (operator === '-') result = firstOperand - secondOperand;
                    else if (operator === '*') result = firstOperand * secondOperand;
                    else if (operator === '/') result = firstOperand / secondOperand;
                    displayValue = String(result);
                    firstOperand = result;
                }
                operator = key;
                waitingForSecondOperand = true;
            }
            updateDisplay();
        });
    }

    // 4. Settings Page
    async function loadSettingsPage() {
        const formData = new FormData();
        formData.append('action', 'get_settings');
        const data = await apiCall(formData);
        
        if (!data) return;
        const storeName = data.settings.value;

        let content = `
            <h2>Settings</h2>
            <div id="settings-page">
                <div class="card">
                    <h3>Store Details</h3>
                    <img src="https://via.placeholder.com/100" alt="Store Logo" style="display:block; margin: 0 auto 16px; border-radius: 50%;">
                    <div class="input-group">
                        <label for="store-name">Store Name</label>
                        <input type="text" id="store-name" value="${storeName}">
                    </div>
                    <button id="save-store-name" class="btn btn-primary">Save Store Name</button>
                </div>

                <div class="card">
                    <h3>Security</h3>
                    <div class="input-group">
                        <label for="new-password">New Password</label>
                        <input type="password" id="new-password" placeholder="Enter new password">
                    </div>
                    <button id="save-password" class="btn btn-primary">Update Password</button>
                </div>

                <div class="card settings-buttons">
                    <h3>System</h3>
                    <button id="btn-trash" class="btn">
                        <span class="material-icons-outlined">delete_forever</span> Trash Bin
                    </button>
                    <a href="https://saducasjeaboo.github.io/my-web/" target="_blank" class="btn">
                        <span class="material-icons-outlined">code</span> Developer
                    </a>
                    <button id="btn-logout" class="btn btn-danger">
                        <span class="material-icons-outlined">logout</span> Logout
                    </button>
                </div>
            </div>
        `;
        pageContent.innerHTML = content;
        addSettingsPageListeners();
    }

    function addSettingsPageListeners() {
        // Save Store Name
        pageContent.querySelector('#save-store-name').addEventListener('click', async () => {
            const name = pageContent.querySelector('#store-name').value;
            const formData = new FormData();
            formData.append('action', 'update_settings');
            formData.append('store_name', name);
            const data = await apiCall(formData);
            if (data) {
                showToast(data.message, 'success');
                // Update login page subtitle (in background, not visible)
                document.getElementById('login-store-name').textContent = name;
            }
        });

        // Save Password
        pageContent.querySelector('#save-password').addEventListener('click', async () => {
            const pass = pageContent.querySelector('#new-password').value;
            if (pass.length < 4) {
                showToast('Password must be at least 4 characters.', 'error');
                return;
            }
            showModal({
                title: 'Update Password?',
                message: 'Are you sure you want to change your password? You will be logged out.'
            }, async () => {
                const formData = new FormData();
                formData.append('action', 'update_password');
                formData.append('new_password', pass);
                const data = await apiCall(formData);
                if (data) {
                    showToast(data.message, 'success');
                    setTimeout(() => window.location.href = 'login.php', 1500);
                }
            });
        });

        // Go to Trash
        pageContent.querySelector('#btn-trash').addEventListener('click', () => {
            navigateTo('trash');
        });

        // Logout
        pageContent.querySelector('#btn-logout').addEventListener('click', () => {
            showModal({
                title: 'Logout?',
                message: 'Are you sure you want to log out?'
            }, async () => {
                await apiCall(new FormData()); // Fails, need action
                const formData = new FormData();
                formData.append('action', 'logout');
                await apiCall(formData);
                window.location.href = 'login.php';
            });
        });
    }

    // 5. Trash Page
    async function loadTrashPage() {
        const formData = new FormData();
        formData.append('action', 'get_trash');
        const data = await apiCall(formData);
        if (!data) return;

        let content = `
            <div class="page-header">
                <button class="btn-icon btn-back">
                    <span class="material-icons-outlined">arrow_back</span>
                </button>
                <h2>Trash Bin</h2>
            </div>
            
            <h3>Trashed Debtors</h3>
            <div class="trash-list" id="trash-debtors">
                ${data.debtors.length === 0 ? '<p class="text-muted">No trashed debtors.</p>' : ''}
                ${data.debtors.map(d => `
                    <div class="card" data-id="${d.id}">
                        <div class="trash-info">
                            <strong>${d.name}</strong>
                            <div class="debtor-date">Trashed: ${formatDate(d.date_added)}</div>
                        </div>
                        <div class="trash-actions">
                            <button class="btn-icon btn-restore-debtor" title="Restore" data-id="${d.id}">
                                <span class="material-icons-outlined">restore</span>
                            </button>
                            <button class="btn-icon btn-perm-delete-debtor" title="Delete Permanently" data-id="${d.id}" data-name="${d.name}">
                                <span class="material-icons-outlined">delete_forever</span>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>

            <h3 style="margin-top: 24px;">Trashed Items</h3>
            <div class="trash-list" id="trash-items">
                ${data.items.length === 0 ? '<p class="text-muted">No trashed items.</p>' : ''}
                ${data.items.map(item => `
                    <div class="card" data-id="${item.id}">
                        <div class="trash-info">
                            <strong>${item.item_name}</strong> (₱${(item.quantity * item.price).toFixed(2)})
                            <div class="item-debtor-name">From: ${item.debtor_name}</div>
                        </div>
                        <div class="trash-actions">
                            <button class="btn-icon btn-restore-item" title="Restore" data-id="${item.id}">
                                <span class="material-icons-outlined">restore</span>
                            </button>
                            <button class="btn-icon btn-perm-delete-item" title="Delete Permanently" data-id="${item.id}">
                                <span class="material-icons-outlined">delete_forever</span>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        pageContent.innerHTML = content;
        addTrashPageListeners();
    }
    
    function addTrashPageListeners() {
        // Back button
        pageContent.querySelector('.btn-back').addEventListener('click', () => {
            navigateTo('settings');
        });

        // Debtor Actions
        pageContent.querySelectorAll('.btn-restore-debtor').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                const formData = new FormData();
                formData.append('action', 'restore_debtor');
                formData.append('id', id);
                if (await apiCall(formData)) {
                    showToast('Debtor restored!', 'success');
                    e.currentTarget.closest('.card').remove();
                }
            });
        });
        pageContent.querySelectorAll('.btn-perm-delete-debtor').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const name = e.currentTarget.dataset.name;
                showModal({
                    title: 'Delete Permanently?',
                    message: `This will permanently delete "${name}" and ALL their associated items. This action cannot be undone.`
                }, async () => {
                    const formData = new FormData();
                    formData.append('action', 'perm_delete_debtor');
                    formData.append('id', id);
                    if (await apiCall(formData)) {
                        showToast('Debtor permanently deleted.', 'success');
                        e.currentTarget.closest('.card').remove();
                    }
                });
            });
        });

        // Item Actions
        pageContent.querySelectorAll('.btn-restore-item').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                const formData = new FormData();
                formData.append('action', 'restore_item');
                formData.append('id', id);
                if (await apiCall(formData)) {
                    showToast('Item restored!', 'success');
                    e.currentTarget.closest('.card').remove();
                }
            });
        });
        pageContent.querySelectorAll('.btn-perm-delete-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                showModal({
                    title: 'Delete Permanently?',
                    message: 'This will permanently delete this item. This action cannot be undone.'
                }, async () => {
                    const formData = new FormData();
                    formData.append('action', 'perm_delete_item');
                    formData.append('id', id);
                    if (await apiCall(formData)) {
                        showToast('Item permanently deleted.', 'success');
                        e.currentTarget.closest('.card').remove();
                    }
                });
            });
        });
    }

    // --- Initial Load ---
    function init() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        applyTheme(savedTheme);
        navigateTo('debtors'); // Load the default page
    }

    init();
});
