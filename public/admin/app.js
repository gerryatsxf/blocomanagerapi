// API Configuration
const API_BASE = window.location.origin;
let authToken = localStorage.getItem('adminToken');
let currentView = 'dashboard';
let currentPage = 1;
let grantTimer = null;
let grantExpiresAt = null;

// Confirmation Modal
function showConfirmModal(message, title = 'Confirm Action') {
    return new Promise((resolve) => {
        document.getElementById('confirmModalTitle').textContent = title;
        document.getElementById('confirmModalMessage').textContent = message;
        const modal = document.getElementById('confirmModal');
        const btn = document.getElementById('confirmModalBtn');
        modal.style.display = 'flex';
        const cleanup = () => { modal.style.display = 'none'; btn.replaceWith(btn.cloneNode(true)); };
        document.getElementById('confirmModalBtn').addEventListener('click', () => { cleanup(); resolve(true); });
        modal.addEventListener('click', (e) => { if (e.target === modal) { cleanup(); resolve(false); } }, { once: true });
        window._closeConfirmModal = () => { cleanup(); resolve(false); };
    });
}
function closeConfirmModal() { if (window._closeConfirmModal) window._closeConfirmModal(); }

// Toast Notification System
function showToast(message, type = 'info', title = null) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    const titles = {
        success: title || 'Success',
        error: title || 'Error',
        warning: title || 'Warning',
        info: title || 'Info'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${icons[type]}</div>
        <div class="toast-content">
            <div class="toast-title">${titles[type]}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.classList.add('toast-fadeout');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// DOM Elements
const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const usersView = document.getElementById('usersView');
const tenantsView = document.getElementById('tenantsView');
const productsView = document.getElementById('productsView');
const settingsView = document.getElementById('settingsView');
const googleGrantsView = document.getElementById('googleGrantsView');
const sidebar = document.querySelector('.sidebar');
const mainContent = document.querySelector('.main-content');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check for Google OAuth callback parameters
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const error = urlParams.get('error');
    const success = urlParams.get('success');
    const view = urlParams.get('view');
    
    if (error) {
        const loginError = document.getElementById('loginError');
        if (loginError) {
            loginError.textContent = decodeURIComponent(error);
            loginError.classList.add('active');
        }
        // If authenticated and has view parameter, show that view with error
        if (authToken && view) {
            showAdminPanel();
            switchView(view);
            showToast(decodeURIComponent(error), 'error');
        }
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (success) {
        // Success message (e.g., from Google email setup)
        if (authToken) {
            showAdminPanel();
            if (view) {
                switchView(view);
            }
            showToast(decodeURIComponent(success), 'success');
        }
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (token) {
        // Google login successful
        console.log('Google OAuth token received, storing and loading dashboard...');
        localStorage.setItem('adminToken', token);
        authToken = token;
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        showAdminPanel();
        loadDashboard();
    } else if (authToken) {
        console.log('Existing token found, loading dashboard...');
        showAdminPanel();
        loadDashboard();
    } else {
        console.log('No token found, showing login...');
        showLogin();
    }
    
    setupEventListeners();
});

function setupEventListeners() {
    // Login
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    document.getElementById('googleLoginBtn')?.addEventListener('click', handleGoogleLogin);
    
    // Super Admin Grant
    document.getElementById('requestCodeBtn')?.addEventListener('click', handleRequestCode);
    document.getElementById('submitGrantBtn')?.addEventListener('click', handleGrantSuperAdmin);
    
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const view = e.target.dataset.view;
            switchView(view);
        });
    });
    
    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
    
    // Refresh buttons
    document.getElementById('refreshUsers')?.addEventListener('click', () => loadUsers());
    document.getElementById('refreshTenants')?.addEventListener('click', () => loadTenants());
    document.getElementById('refreshProducts')?.addEventListener('click', () => loadProducts());
    document.getElementById('addProductBtn')?.addEventListener('click', () => showAddProductModal());
    document.getElementById('addUserBtn')?.addEventListener('click', () => showAddUserModal());
    document.getElementById('addTenantBtn')?.addEventListener('click', () => showAddTenantModal());
    
    // Bulk delete users
    document.getElementById('selectAllUsers')?.addEventListener('change', handleSelectAllUsers);
    document.getElementById('bulkDeleteUsersBtn')?.addEventListener('click', handleBulkDeleteUsers);
    
    // Modal
    document.getElementById('closeModal')?.addEventListener('click', closeModal);
    document.getElementById('editModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'editModal') closeModal();
    });
}

// Super Admin Grant Functions
async function handleRequestCode() {
    const btn = document.getElementById('requestCodeBtn');
    const errorEl = document.getElementById('grantError');
    const form = document.getElementById('grantCodeForm');
    
    btn.disabled = true;
    btn.textContent = 'Sending...';
    errorEl.classList.remove('active');
    
    try {
        const response = await fetch(`${API_BASE}/admin/request-superadmin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to request code');
        }
        
        const data = await response.json();
        
        // Show form and start timer
        form.style.display = 'block';
        btn.style.display = 'none';
        grantExpiresAt = Date.now() + (5 * 60 * 1000); // 5 minutes
        startGrantTimer();
        
        showToast(data.message, 'success', 'Verification Code Sent');
        
    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.add('active');
        btn.disabled = false;
        btn.textContent = 'Request Verification Code';
    }
}

function startGrantTimer() {
    const timerEl = document.getElementById('timerDisplay');
    
    if (grantTimer) clearInterval(grantTimer);
    
    grantTimer = setInterval(() => {
        const remaining = grantExpiresAt - Date.now();
        
        if (remaining <= 0) {
            clearInterval(grantTimer);
            timerEl.textContent = '00:00 - CODE EXPIRED';
            timerEl.className = 'timer-display expired';
            document.getElementById('submitGrantBtn').disabled = true;
            return;
        }
        
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        if (remaining < 60000) {
            timerEl.className = 'timer-display warning';
        } else {
            timerEl.className = 'timer-display';
        }
    }, 1000);
}

async function handleGrantSuperAdmin() {
    const code = document.getElementById('grantCode').value;
    const targetEmail = document.getElementById('grantTargetEmail').value;
    const errorEl = document.getElementById('grantError');
    const successEl = document.getElementById('grantSuccess');
    const btn = document.getElementById('submitGrantBtn');
    
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
        errorEl.textContent = 'Please enter a valid 6-digit code';
        errorEl.classList.add('active');
        return;
    }
    
    if (!targetEmail) {
        errorEl.textContent = 'Please enter target email';
        errorEl.classList.add('active');
        return;
    }
    
    btn.disabled = true;
    btn.textContent = 'Granting...';
    errorEl.classList.remove('active');
    successEl.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE}/admin/grant-superadmin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, targetEmail }),
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to grant super admin');
        }
        
        const data = await response.json();
        
        // Clear timer
        if (grantTimer) clearInterval(grantTimer);
        
        // Show success
        successEl.textContent = data.message;
        successEl.style.display = 'block';
        
        // Clear form
        document.getElementById('grantCode').value = '';
        document.getElementById('grantTargetEmail').value = '';
        
        setTimeout(() => {
            document.getElementById('grantCodeForm').style.display = 'none';
            document.getElementById('requestCodeBtn').style.display = 'block';
            successEl.style.display = 'none';
        }, 5000);
        
    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.add('active');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Grant Super Admin';
    }
}

// Auth Functions
function handleGoogleLogin() {
    // Redirect to Google OAuth login endpoint
    window.location.href = `${API_BASE}/auth/google/login`;
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    
    try {
        // First, create a session
        const sessionRes = await fetch(`${API_BASE}/auth/session`, {
            method: 'POST',
        });
        const sessionData = await sessionRes.json();
        
        // Then login
        const loginRes = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionData.access_token}`,
            },
            body: JSON.stringify({ email, password }),
        });
        
        if (!loginRes.ok) {
            throw new Error('Invalid credentials');
        }
        
        const loginData = await loginRes.json();
        authToken = loginData.access_token;
        localStorage.setItem('adminToken', authToken);
        
        // Verify super admin access
        try {
            await apiCall('/admin/dashboard/stats');
            showAdminPanel();
            loadDashboard();
        } catch (err) {
            localStorage.removeItem('adminToken');
            authToken = null;
            throw new Error('Access denied. Super admin role required.');
        }
        
    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.add('active');
    }
}

function handleLogout() {
    localStorage.removeItem('adminToken');
    authToken = null;
    showLogin();
}

// Utility functions for notifications
function showError(message) {
    console.error(message);
    showToast(message, 'error');
}

function showSuccess(message) {
    console.log(message);
    showToast(message, 'success');
}

function showLogin() {
    loginView.style.display = 'block';
    dashboardView.style.display = 'none';
    usersView.style.display = 'none';
    tenantsView.style.display = 'none';
    productsView.style.display = 'none';
    sidebar.style.display = 'none';
    mainContent.querySelector('.header').style.display = 'none';
}

function showAdminPanel() {
    loginView.style.display = 'none';
    sidebar.style.display = 'flex';
    mainContent.querySelector('.header').style.display = 'flex';
}

// API Helper
async function apiCall(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        ...options.headers,
    };
    
    console.log(`API Call: ${endpoint}`);
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    });
    
    console.log(`API Response [${endpoint}]: ${response.status} ${response.statusText}`);
    
    if (response.status === 401 || response.status === 403) {
        console.error('Auth failed, logging out...');
        handleLogout();
        throw new Error('Session expired or unauthorized');
    }
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error [${endpoint}]:`, errorText);
        throw new Error(`API Error: ${response.statusText}`);
    }
    
    return response.json();
}

// View Switching
function switchView(view) {
    currentView = view;
    currentPage = 1;
    
    // Update nav - only highlight if it's a main view (not tenantDetail)
    if (view !== 'tenantDetail') {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
    }
    
    // Update title
    const titles = {
        dashboard: 'Dashboard',
        users: 'User Management',
        tenants: 'Tenant Management',
        tenantDetail: 'Tenant Details',
        products: 'Product Management',
        googleGrants: 'Google OAuth Grants',
        settings: 'Settings',
    };
    document.getElementById('pageTitle').textContent = titles[view] || 'Admin Panel';
    
    // Show view
    dashboardView.style.display = view === 'dashboard' ? 'block' : 'none';
    usersView.style.display = view === 'users' ? 'block' : 'none';
    tenantsView.style.display = view === 'tenants' ? 'block' : 'none';
    const tenantDetailView = document.getElementById('tenantDetailView');
    if (tenantDetailView) {
        tenantDetailView.style.display = view === 'tenantDetail' ? 'block' : 'none';
    }
    productsView.style.display = view === 'products' ? 'block' : 'none';
    googleGrantsView.style.display = view === 'googleGrants' ? 'block' : 'none';
    settingsView.style.display = view === 'settings' ? 'block' : 'none';
    
    // Load data
    switch (view) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'users':
            loadUsers();
            break;
        case 'tenants':
            loadTenants();
            break;
        case 'products':
            loadProducts();
            break;
        case 'googleGrants':
            loadGoogleGrants();
            break;
        case 'settings':
            loadSettings();
            break;
        // tenantDetail is loaded by viewTenantDetails function
    }
}

// Dashboard
async function loadDashboard() {
    console.log('Loading dashboard with token:', authToken ? 'present' : 'missing');
    try {
        const stats = await apiCall('/admin/dashboard/stats');
        console.log('Dashboard stats loaded:', stats);
        
        document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
        document.getElementById('totalTenants').textContent = '4'; // Static for now
        document.getElementById('activeSessions').textContent = '-';
        
    } catch (error) {
        console.error('Failed to load dashboard:', error);
        // Show error to user
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-error';
        errorDiv.textContent = `Dashboard error: ${error.message}`;
        document.querySelector('.dashboard-stats')?.prepend(errorDiv);
    }
}

// Users
async function loadUsers(page = 1) {
    try {
        const data = await apiCall(`/admin/users?page=${page}&limit=50`);
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '';
        
        // Reset selection
        document.getElementById('selectAllUsers').checked = false;
        updateBulkDeleteButton();
        
        data.data.forEach(user => {
            const row = document.createElement('tr');
            const isSuperAdmin = user.role === 'super_admin';
            row.innerHTML = `
                <td>
                    <input type="checkbox" 
                           class="user-checkbox" 
                           data-user-id="${user._id}" 
                           ${isSuperAdmin ? 'disabled title="Super admins cannot be bulk deleted"' : ''}
                           onchange="updateBulkDeleteButton()">
                </td>
                <td>${user.email}</td>
                <td>${user.firstName || ''} ${user.lastName || ''}</td>
                <td><span class="badge badge-${getRoleBadge(user.role)}">${user.role || 'user'}</span></td>
                <td><span class="badge badge-${user.emailVerified ? 'success' : 'danger'}">${user.emailVerified ? 'Yes' : 'No'}</span></td>
                <td>${formatDate(user.createdAt)}</td>
                <td class="action-btns">
                    <button class="btn btn-secondary btn-sm" onclick="viewUser('${user._id}')">View</button>
                    <button class="btn btn-secondary btn-sm" onclick="editUser('${user._id}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteUser('${user._id}', '${user.email}')">Delete</button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        renderPagination('usersPagination', data.pagination, loadUsers);
        
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

async function viewUser(userId) {
    try {
        const [user, activity] = await Promise.all([
            apiCall(`/admin/users/${userId}`),
            apiCall(`/admin/users/${userId}/activity`),
        ]);
        
        const modal = document.getElementById('editModal');
        document.getElementById('modalTitle').textContent = 'User Details';
        document.getElementById('modalBody').innerHTML = `
            <div class="form-group">
                <strong>Email:</strong> ${user.email}
            </div>
            <div class="form-group">
                <strong>Name:</strong> ${user.firstName || ''} ${user.lastName || ''}
            </div>
            <div class="form-group">
                <strong>Role:</strong> <span class="badge badge-${getRoleBadge(user.role)}">${user.role || 'user'}</span>
            </div>
            <div class="form-group">
                <strong>Email Verified:</strong> ${user.emailVerified ? 'Yes' : 'No'}
            </div>
            <div class="form-group">
                <strong>Created:</strong> ${formatDate(user.createdAt)}
            </div>
            <div class="form-group">
                <strong>Sessions:</strong> ${activity.sessions.length}
            </div>
            <h4 style="margin-top: 1.5rem; margin-bottom: 1rem;">Recent Activity</h4>
            ${activity.sessions.slice(0, 5).map(session => `
                <div style="padding: 0.5rem; margin-bottom: 0.5rem; background: var(--bg-dark); border-radius: 6px;">
                    <strong>Tenant:</strong> ${session.tenant}<br>
                    <strong>Created:</strong> ${formatDate(session.createdAt)}
                </div>
            `).join('') || 'No activity'}
        `;
        modal.classList.add('active');
        
    } catch (error) {
        console.error('Failed to view user:', error);
        showToast('Failed to load user details', 'error');
    }
}

async function editUser(userId) {
    try {
        const user = await apiCall(`/admin/users/${userId}`);
        
        const modal = document.getElementById('editModal');
        document.getElementById('modalTitle').textContent = 'Edit User';
        document.getElementById('modalBody').innerHTML = `
            <form id="editUserForm">
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="editEmail" value="${user.email}" disabled>
                </div>
                <div class="form-group">
                    <label>First Name</label>
                    <input type="text" id="editFirstName" value="${user.firstName || ''}">
                </div>
                <div class="form-group">
                    <label>Last Name</label>
                    <input type="text" id="editLastName" value="${user.lastName || ''}">
                </div>
                <div class="form-group">
                    <label>Role</label>
                    <select id="editRole">
                        <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                        <option value="tenantAdmin" ${user.role === 'tenantAdmin' ? 'selected' : ''}>Tenant Admin</option>
                        <option value="superAdmin" ${user.role === 'superAdmin' ? 'selected' : ''}>Super Admin</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary">Save Changes</button>
            </form>
        `;
        
        document.getElementById('editUserForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const updates = {
                firstName: document.getElementById('editFirstName').value,
                lastName: document.getElementById('editLastName').value,
            };
            
            const newRole = document.getElementById('editRole').value;
            
            try {
                await apiCall(`/admin/users/${userId}`, {
                    method: 'PATCH',
                    body: JSON.stringify(updates),
                });
                
                if (newRole !== user.role) {
                    await apiCall(`/admin/users/${userId}/role`, {
                        method: 'PATCH',
                        body: JSON.stringify({ role: newRole }),
                    });
                }
                
                closeModal();
                loadUsers(currentPage);
                showToast('User updated successfully', 'success');
            } catch (error) {
                showToast('Failed to update user: ' + error.message, 'error');
            }
        });
        
        modal.classList.add('active');
        
    } catch (error) {
        console.error('Failed to edit user:', error);
        showToast('Failed to load user details', 'error');
    }
}

function showAddUserModal() {
    const modal = document.getElementById('editModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.textContent = 'Add New User';
    modalBody.innerHTML = `
        <form id="userForm" onsubmit="handleUserSubmit(event)">
            <div class="form-group">
                <label>Email *</label>
                <input type="email" id="userEmail" required placeholder="user@example.com">
            </div>
            <div class="form-group">
                <label>First Name</label>
                <input type="text" id="userFirstName" placeholder="John">
            </div>
            <div class="form-group">
                <label>Last Name</label>
                <input type="text" id="userLastName" placeholder="Doe">
            </div>
            <div class="form-group">
                <label>Role *</label>
                <select id="userRole" required>
                    <option value="user">User</option>
                    <option value="tenantAdmin">Tenant Admin</option>
                    <option value="superAdmin">Super Admin</option>
                </select>
            </div>
            <div class="form-group">
                <label>Temporary Password *</label>
                <input type="text" id="userPassword" required minlength="8" placeholder="TempPass123!">
                <small style="color: var(--text-secondary); font-size: 0.85rem;">Minimum 8 characters. Will be sent to user's email.</small>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Create User & Send Invite</button>
            </div>
        </form>
    `;
    modal.classList.add('active');
}

async function handleUserSubmit(event) {
    event.preventDefault();
    
    const email = document.getElementById('userEmail').value;
    const firstName = document.getElementById('userFirstName').value;
    const lastName = document.getElementById('userLastName').value;
    const role = document.getElementById('userRole').value;
    const temporaryPassword = document.getElementById('userPassword').value;
    
    try {
        const response = await apiCall('/admin/users/invite', {
            method: 'POST',
            body: JSON.stringify({
                email,
                firstName: firstName || undefined,
                lastName: lastName || undefined,
                role,
                temporaryPassword,
            }),
        });
        
        closeModal();
        loadUsers(currentPage);
        
        // Show appropriate message based on whether email was sent
        if (response.emailSent) {
            showToast('Invitation email sent to ' + email, 'success', 'User Created');
        } else {
            let message = '⚠️ User created successfully, but email could NOT be sent.\n\n';
            message += 'Credentials:\n';
            message += 'Email: ' + (response.credentials?.email || email) + '\n';
            message += 'Password: ' + (response.credentials?.temporaryPassword || temporaryPassword) + '\n\n';
            message += '💡 To enable email sending:\n';
            message += '1. Go to Settings tab\n';
            message += '2. Click "Connect Google Account"\n';
            message += '3. Complete the authorization\n\n';
            message += 'Please save these credentials and share them with the user manually.';
            showToast(message, 'warning', 'Email Not Sent');
        }
    } catch (error) {
        showToast('Failed to create user: ' + error.message, 'error');
    }
}

async function deleteUser(userId, email) {
    if (!await showConfirmModal(`Are you sure you want to delete user ${email}? This action cannot be undone.`, 'Delete User')) {
        return;
    }
    
    try {
        await apiCall(`/admin/users/${userId}`, { method: 'DELETE' });
        loadUsers(currentPage);
        showToast('User deleted successfully', 'success');
    } catch (error) {
        showToast('Failed to delete user: ' + error.message, 'error');
    }
}

// Tenants
function showAddTenantModal() {
    const modal = document.getElementById('editModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.textContent = 'Add New Tenant';
    modalBody.innerHTML = `
        <form id="tenantForm" onsubmit="handleTenantSubmit(event)">
            <div class="form-group">
                <label>Tenant ID *</label>
                <input type="text" id="tenantId" required pattern="[a-z0-9]+" placeholder="newcompany" minlength="3" maxlength="50">
                <small style="color: var(--text-secondary); font-size: 0.85rem;">Lowercase alphanumeric only, no spaces (e.g., "newcompany")</small>
            </div>
            <div class="form-group">
                <label>Domain *</label>
                <input type="text" id="tenantDomain" required pattern="[a-z0-9]+([\\-\\.]{1}[a-z0-9]+)*\\.[a-z]{2,}" placeholder="newcompany.com">
                <small style="color: var(--text-secondary); font-size: 0.85rem;">Valid domain format (e.g., "newcompany.com")</small>
            </div>
            <div class="form-group">
                <label>Name *</label>
                <input type="text" id="tenantName" required minlength="2" maxlength="100" placeholder="New Company Inc.">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="tenantDescription" maxlength="500" placeholder="Brief description of the tenant..."></textarea>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Create Tenant</button>
            </div>
        </form>
    `;
    modal.classList.add('active');
}

async function handleTenantSubmit(event) {
    event.preventDefault();
    
    const tenantId = document.getElementById('tenantId').value.toLowerCase();
    const domain = document.getElementById('tenantDomain').value.toLowerCase();
    const name = document.getElementById('tenantName').value;
    const description = document.getElementById('tenantDescription').value;
    
    try {
        await apiCall('/admin/tenants', {
            method: 'POST',
            body: JSON.stringify({
                tenantId,
                domain,
                name,
                description: description || undefined,
            }),
        });
        
        closeModal();
        loadTenants();
        showToast('Tenant ID: ' + tenantId + '\nDomain: ' + domain, 'success', 'Tenant Created Successfully');
    } catch (error) {
        showToast('Failed to create tenant: ' + error.message, 'error');
    }
}
async function loadTenants() {
    try {
        const data = await apiCall('/admin/tenants');
        const grid = document.getElementById('tenantGrid');
        grid.innerHTML = '';
        
        data.data.forEach(tenant => {
            const card = document.createElement('div');
            card.className = 'tenant-card';
            card.innerHTML = `
                <h3>${tenant.name}</h3>
                <p>${tenant.description}</p>
                <div><strong>Domain:</strong> ${tenant.domain}</div>
                <div><strong>ID:</strong> ${tenant.tenantId}</div>
                <div class="tenant-stats">
                    <div class="tenant-stat">
                        <strong>${tenant.userCount || 0}</strong>
                        <span>Users</span>
                    </div>
                    <div class="tenant-stat">
                        <strong>${tenant.sessionCount || 0}</strong>
                        <span>Sessions</span>
                    </div>
                </div>
                <button class="btn btn-secondary btn-sm" style="margin-top: 1rem; width: 100%;" onclick="viewTenantDetails('${tenant.tenantId}')">View Details</button>
            `;
            grid.appendChild(card);
        });
        
    } catch (error) {
        console.error('Failed to load tenants:', error);
    }
}

async function viewTenantDetails(tenantId) {
    try {
        const data = await apiCall(`/admin/tenants/${tenantId}`);
        
        // Store current tenant ID for admin management
        window.currentTenantId = tenantId;
        
        // Populate the form fields
        document.getElementById('detailTenantId').value = data.tenant.tenantId;
        document.getElementById('detailTenantId').dataset.original = data.tenant.tenantId;
        document.getElementById('detailTenantDomain').value = data.tenant.domain;
        document.getElementById('detailTenantName').value = data.tenant.name;
        document.getElementById('detailTenantDescription').value = data.tenant.description || '';
        
        // Update title
        document.getElementById('tenantDetailTitle').textContent = `${data.tenant.name} Details`;
        
        // Update deployment status
        updateDeploymentStatus(data.tenant);
        
        // Update storage provider select
        const storageProviderSelect = document.getElementById('storageProviderSelect');
        if (storageProviderSelect) {
            storageProviderSelect.value = data.tenant.storageProvider || 'local';
        }
        
        // Update statistics
        document.getElementById('detailUserCount').textContent = data.users.length;
        document.getElementById('detailSessionCount').textContent = data.sessions.length;
        
        // Load and display tenant admins
        await loadTenantAdmins(tenantId);
        
        // Display recent users
        const usersContainer = document.getElementById('detailRecentUsers');
        if (data.users.length === 0) {
            usersContainer.innerHTML = '<p style="color: var(--text-secondary);">No users found for this tenant.</p>';
        } else {
            usersContainer.innerHTML = data.users.slice(0, 10).map(user => `
                <div style="padding: 0.75rem; margin-bottom: 0.5rem; background: var(--bg-dark); border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 500;">${user.email}</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">
                            ${user.firstName || ''} ${user.lastName || ''}
                        </div>
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">
                        ${user.role || 'user'}
                    </div>
                </div>
            `).join('');
        }
        
        // Switch to tenant detail view
        switchView('tenantDetail');
        
    } catch (error) {
        showToast('Failed to load tenant details: ' + error.message, 'error');
    }
}

async function loadTenantAdmins(tenantId) {
    try {
        const admins = await apiCall(`/admin/tenants/${tenantId}/admins`);
        const container = document.getElementById('detailTenantAdmins');
        
        if (!admins || admins.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">No tenant admins assigned yet.</p>';
        } else {
            container.innerHTML = admins.map(admin => `
                <div style="padding: 0.75rem; margin-bottom: 0.5rem; background: var(--bg-dark); border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 500;">${admin.email}</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">
                            ${admin.firstName || ''} ${admin.lastName || ''}
                        </div>
                    </div>
                    <button class="btn btn-danger btn-sm" onclick="removeTenantAdmin('${tenantId}', '${admin._id}', '${admin.email}')">Remove</button>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load tenant admins:', error);
        document.getElementById('detailTenantAdmins').innerHTML = '<p style="color: var(--danger);">Failed to load tenant admins</p>';
    }
}

async function showAddTenantAdminModal() {
    const modal = document.getElementById('addTenantAdminModal');
    const select = document.getElementById('tenantAdminUserSelect');
    
    // Show modal
    modal.style.display = 'flex';
    
    // Load available users (those without tenant admin role from other tenants)
    try {
        const allUsersData = await apiCall('/admin/users?limit=1000');
        const currentTenantId = window.currentTenantId;
        
        // Get current tenant admins
        const currentAdmins = await apiCall(`/admin/tenants/${currentTenantId}/admins`);
        const currentAdminIds = new Set(currentAdmins.map(a => a._id.toString()));
        
        // Filter: exclude super admins, current tenant admins, and tenant admins of other tenants
        const availableUsers = allUsersData.data.filter(user => {
            if (user.role === 'superAdmin') return false;
            if (currentAdminIds.has(user._id.toString())) return false;
            if (user.role === 'tenantAdmin' && user.tenant !== currentTenantId) return false;
            return true;
        });
        
        if (availableUsers.length === 0) {
            select.innerHTML = '<option value="">No available users</option>';
        } else {
            select.innerHTML = '<option value="">Select a user...</option>' + 
                availableUsers.map(user => 
                    `<option value="${user._id}">${user.email} - ${user.firstName || ''} ${user.lastName || ''}</option>`
                ).join('');
        }
    } catch (error) {
        showToast('Failed to load users: ' + error.message, 'error');
        select.innerHTML = '<option value="">Error loading users</option>';
    }
}

function closeAddTenantAdminModal() {
    document.getElementById('addTenantAdminModal').style.display = 'none';
    document.getElementById('addTenantAdminForm').reset();
}

async function handleAddTenantAdmin(event) {
    event.preventDefault();
    
    const userId = document.getElementById('tenantAdminUserSelect').value;
    const tenantId = window.currentTenantId;
    
    if (!userId) {
        showToast('Please select a user', 'warning');
        return;
    }
    
    try {
        await apiCall(`/admin/tenants/${tenantId}/admins/${userId}`, {
            method: 'POST'
        });
        
        showToast('Tenant admin added successfully', 'success');
        closeAddTenantAdminModal();
        await loadTenantAdmins(tenantId);
    } catch (error) {
        showToast('Failed to add tenant admin: ' + error.message, 'error');
    }
}

async function removeTenantAdmin(tenantId, userId, email) {
    if (!await showConfirmModal(`Remove ${email} from tenant admin role?`, 'Remove Admin')) {
        return;
    }
    
    try {
        await apiCall(`/admin/tenants/${tenantId}/admins/${userId}`, {
            method: 'DELETE'
        });
        
        showToast('Tenant admin removed successfully', 'success');
        await loadTenantAdmins(tenantId);
    } catch (error) {
        showToast('Failed to remove tenant admin: ' + error.message, 'error');
    }
}

async function handleStorageProviderUpdate(event) {
    event.preventDefault();
    
    const tenantId = window.currentTenantId;
    if (!tenantId) {
        showToast('No tenant selected', 'error');
        return;
    }
    
    const storageProvider = document.getElementById('storageProviderSelect').value;
    
    try {
        await apiCall(`/admin/tenants/${tenantId}/storage-provider`, {
            method: 'PATCH',
            body: JSON.stringify({ storageProvider }),
        });
        
        showToast('Storage provider updated successfully', 'success');
    } catch (error) {
        showToast('Failed to update storage provider: ' + error.message, 'error');
    }
}

async function handleTenantUpdate(event) {
    event.preventDefault();
    
    const oldTenantId = document.getElementById('detailTenantId').dataset.original;
    const tenantId = document.getElementById('detailTenantId').value.toLowerCase();
    const domain = document.getElementById('detailTenantDomain').value.toLowerCase();
    const name = document.getElementById('detailTenantName').value;
    const description = document.getElementById('detailTenantDescription').value;
    
    try {
        const result = await apiCall(`/admin/tenants/${oldTenantId}`, {
            method: 'PATCH',
            body: JSON.stringify({
                tenantId: tenantId !== oldTenantId ? tenantId : undefined,
                domain,
                name,
                description: description || undefined,
            }),
        });
        
        showToast('Tenant updated successfully', 'success');
        
        // If tenant ID changed, navigate back to list
        if (result.oldTenantId) {
            showToast(`Tenant ID changed from "${result.oldTenantId}" to "${tenantId}"`, 'info');
            setTimeout(() => switchView('tenants'), 1500);
        } else {
            // Refresh the tenant details with the current ID
            await viewTenantDetails(tenantId);
        }
        
    } catch (error) {
        showToast('Failed to update tenant: ' + error.message, 'error');
    }
}

function updateDeploymentStatus(tenant) {
    const statusBadge = document.getElementById('deploymentStatusBadge');
    const urlContainer = document.getElementById('deploymentUrl');
    const urlLink = document.getElementById('deploymentUrlLink');
    const dateContainer = document.getElementById('deploymentDate');
    const dateValue = document.getElementById('deploymentDateValue');
    const undeployBtn = document.getElementById('undeployBtn');
    const message = document.getElementById('deploymentMessage');
    
    const status = tenant.deploymentStatus || 'not_deployed';
    
    // Update status badge
    const statusConfig = {
        'pending': { label: 'Pending', class: 'badge-secondary' },
        'provisioning': { label: 'Provisioning...', class: 'badge-warning' },
        'deployed': { label: 'Deployed ✅', class: 'badge-success' },
        'failed': { label: 'Failed ❌', class: 'badge-danger' },
        'undeployed': { label: 'Undeployed', class: 'badge-secondary' },
        'not_deployed': { label: 'Not Deployed', class: 'badge-secondary' }
    };
    
    const config = statusConfig[status] || statusConfig['not_deployed'];
    statusBadge.textContent = config.label;
    statusBadge.className = `badge ${config.class}`;
    
    // Show/hide URL if deployed
    if (status === 'deployed' && tenant.frontendUrl) {
        urlContainer.style.display = 'block';
        urlLink.href = tenant.frontendUrl;
        urlLink.textContent = tenant.frontendUrl;
    } else {
        urlContainer.style.display = 'none';
    }
    
    // Show/hide deployment date
    if (status === 'deployed' && tenant.deployedAt) {
        dateContainer.style.display = 'block';
        dateValue.textContent = formatDate(tenant.deployedAt);
    } else {
        dateContainer.style.display = 'none';
    }
    
    // Show/hide undeploy button
    if (status === 'deployed') {
        undeployBtn.style.display = 'inline-block';
        undeployBtn.dataset.tenantId = tenant.tenantId;
        message.textContent = 'Frontend is live and accessible to users.';
    } else {
        undeployBtn.style.display = 'none';
        
        if (status === 'provisioning') {
            message.textContent = 'Frontend deployment is in progress. This may take a few minutes.';
        } else if (status === 'failed') {
            message.textContent = 'Frontend deployment failed. Check logs or try creating the tenant again.';
        } else if (status === 'pending') {
            message.textContent = 'Frontend deployment is queued.';
        } else {
            message.textContent = 'No frontend deployment configured for this tenant.';
        }
    }
}

async function handleUndeploy() {
    const undeployBtn = document.getElementById('undeployBtn');
    const tenantId = undeployBtn.dataset.tenantId;
    
    if (!await showConfirmModal('Are you sure you want to undeploy the frontend for this tenant? This will make the frontend inaccessible to users.', 'Undeploy Frontend')) {
        return;
    }
    
    try {
        undeployBtn.disabled = true;
        undeployBtn.textContent = '⏳ Undeploying...';
        
        await apiCall(`/admin/tenants/${tenantId}/undeploy`, {
            method: 'DELETE'
        });
        
        showToast('Frontend undeployed successfully', 'success');
        
        // Refresh tenant details
        await viewTenantDetails(tenantId);
        
    } catch (error) {
        showToast('Failed to undeploy frontend: ' + error.message, 'error');
        undeployBtn.disabled = false;
        undeployBtn.textContent = '🗑️ Undeploy Frontend';
    }
}

// Products
async function loadProducts() {
    try {
        const products = await apiCall('/admin/products');
        const tbody = document.getElementById('productsTableBody');
        tbody.innerHTML = '';
        
        if (!products || products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No products found</td></tr>';
            return;
        }
        
        products.forEach(product => {
            const row = document.createElement('tr');
            const priceFormatted = formatPrice(product.price, product.currency);
            const statusBadge = product.active 
                ? '<span class="badge badge-success">Active</span>' 
                : '<span class="badge badge-secondary">Inactive</span>';
            
            row.innerHTML = `
                <td>${escapeHtml(product.name)}</td>
                <td>${priceFormatted}</td>
                <td>${product.currency}</td>
                <td><span class="badge badge-info">${escapeHtml(product.tenant || 'N/A')}</span></td>
                <td>${statusBadge}</td>
                <td>${formatDate(product.createdAt)}</td>
                <td class="action-btns">
                    <button class="btn btn-secondary btn-sm" onclick="editProduct('${product._id}')" title="Edit">✏️</button>
                    <button class="btn ${product.active ? 'btn-warning' : 'btn-success'} btn-sm" onclick="toggleProductActive('${product._id}')" title="${product.active ? 'Deactivate' : 'Activate'}">
                        ${product.active ? '👁️' : '👁️‍🗨️'}
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteProduct('${product._id}')" title="Delete">🗑️</button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Failed to load products:', error);
        const tbody = document.getElementById('productsTableBody');
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--error);">Error loading products: ${error.message}</td></tr>`;
    }
}

function showAddProductModal() {
    const modal = document.getElementById('editModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.textContent = 'Add New Product';
    modalBody.innerHTML = `
        <form id="productForm" onsubmit="handleProductSubmit(event, null)">
            <div class="form-group">
                <label>Product Name *</label>
                <input type="text" id="productName" required placeholder="e.g., Consultoría de 50 minutos">
            </div>
            <div class="form-group">
                <label>Description *</label>
                <textarea id="productDescription" required rows="3" placeholder="Describe the product"></textarea>
            </div>
            <div class="form-group">
                <label>Price (in centavos) *</label>
                <input type="number" id="productPrice" required min="0" placeholder="e.g., 49950 for $499.50 MXN">
                <small style="color: var(--text-secondary); font-size: 0.85rem;">Enter price in centavos (100 centavos = 1 MXN)</small>
            </div>
            <div class="form-group">
                <label>Tenant *</label>
                <input type="text" id="productTenant" required value="blocomanager" placeholder="e.g., blocomanager">
                <small style="color: var(--text-secondary); font-size: 0.85rem;">Specify which tenant owns this product</small>
            </div>
            <div class="form-group">
                <label class="checkbox-label">
                    <input type="checkbox" id="productActive" checked>
                    Active (visible to customers)
                </label>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Create Product</button>
            </div>
        </form>
    `;
    modal.classList.add('active');
}

async function editProduct(productId) {
    try {
        const product = await apiCall(`/admin/products/${productId}`);
        const modal = document.getElementById('editModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        
        modalTitle.textContent = 'Edit Product';
        modalBody.innerHTML = `
            <form id="productForm" onsubmit="handleProductSubmit(event, '${productId}')">
                <div class="form-group">
                    <label>Product Name *</label>
                    <input type="text" id="productName" required value="${escapeHtml(product.name)}">
                </div>
                <div class="form-group">
                    <label>Description *</label>
                    <textarea id="productDescription" required rows="3">${escapeHtml(product.description)}</textarea>
                </div>
                <div class="form-group">
                    <label>Price (in centavos) *</label>
                    <input type="number" id="productPrice" required min="0" value="${product.price}">
                    <small style="color: var(--text-secondary); font-size: 0.85rem;">Current: ${formatPrice(product.price, product.currency)}</small>
                </div>
                <div class="form-group">
                    <label>Tenant *</label>
                    <input type="text" id="productTenant" required value="${escapeHtml(product.tenant || 'blocomanager')}" placeholder="e.g., blocomanager">
                    <small style="color: var(--text-secondary); font-size: 0.85rem;">Specify which tenant owns this product</small>
                </div>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="productActive" ${product.active ? 'checked' : ''}>
                        Active (visible to customers)
                    </label>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save Changes</button>
                </div>
            </form>
        `;
        modal.classList.add('active');
        
    } catch (error) {
        console.error('Failed to load product:', error);
        showToast('Failed to load product details', 'error');
    }
}

async function handleProductSubmit(event, productId) {
    event.preventDefault();
    
    const name = document.getElementById('productName').value;
    const description = document.getElementById('productDescription').value;
    const price = parseInt(document.getElementById('productPrice').value);
    const tenant = document.getElementById('productTenant').value;
    const active = document.getElementById('productActive').checked;
    
    const productData = { name, description, price, tenant, active };
    
    try {
        if (productId) {
            // Update existing product
            await apiCall(`/admin/products/${productId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData),
            });
            showToast('Product updated successfully', 'success');
        } else {
            // Create new product
            await apiCall('/admin/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData),
            });
            showToast('Product created successfully', 'success');
        }
        
        closeModal();
        loadProducts();
        
    } catch (error) {
        console.error('Failed to save product:', error);
        showToast('Failed to save product: ' + error.message, 'error');
    }
}

async function toggleProductActive(productId) {
    try {
        await apiCall(`/admin/products/${productId}/toggle-active`, {
            method: 'PATCH',
        });
        loadProducts();
    } catch (error) {
        console.error('Failed to toggle product status:', error);
        showToast('Failed to update product status', 'error');
    }
}

async function deleteProduct(productId) {
    if (!await showConfirmModal('Are you sure you want to permanently delete this product? This action cannot be undone.', 'Delete Product')) {
        return;
    }
    
    try {
        await apiCall(`/admin/products/${productId}`, {
            method: 'DELETE',
        });
        showToast('Product deleted successfully', 'success');
        loadProducts();
    } catch (error) {
        console.error('Failed to delete product:', error);
        showToast('Failed to delete product', 'error');
    }
}

// Helper function to format price
function formatPrice(centavos, currency = 'MXN') {
    const amount = centavos / 100;
    return `$${amount.toFixed(2)} ${currency}`;
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Helper function to format dates (2026-01-31 15:17:21 GMT-6)
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    // Get timezone offset in hours
    const offset = -date.getTimezoneOffset() / 60;
    const gmtOffset = `GMT${offset >= 0 ? '+' : ''}${offset}`;
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${gmtOffset}`;
}

// Helper function to close modal
function closeModal() {
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Helper function to get role badge color
function getRoleBadge(role) {
    const badges = {
        'super_admin': 'danger',
        'superAdmin': 'danger',
        'admin': 'warning',
        'user': 'info'
    };
    return badges[role] || 'secondary';
}

// ==================== BULK DELETE USERS ====================

function handleSelectAllUsers(e) {
    const checkboxes = document.querySelectorAll('.user-checkbox:not([disabled])');
    checkboxes.forEach(cb => cb.checked = e.target.checked);
    updateBulkDeleteButton();
}

function updateBulkDeleteButton() {
    const selectedCheckboxes = document.querySelectorAll('.user-checkbox:checked');
    const count = selectedCheckboxes.length;
    const bulkBtn = document.getElementById('bulkDeleteUsersBtn');
    const countSpan = document.getElementById('selectedCount');
    
    if (count > 0) {
        bulkBtn.style.display = 'inline-block';
        countSpan.textContent = count;
    } else {
        bulkBtn.style.display = 'none';
    }
}

async function handleBulkDeleteUsers() {
    const selectedCheckboxes = document.querySelectorAll('.user-checkbox:checked');
    const userIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.userId);
    
    if (userIds.length === 0) {
        showToast('No users selected', 'warning');
        return;
    }
    
    const confirmed = await showConfirmModal(`Are you sure you want to delete ${userIds.length} user(s)? This action cannot be undone.`, 'Bulk Delete Users');
    if (!confirmed) return;
    
    try {
        const result = await apiCall('/admin/users/bulk-delete', {
            method: 'POST',
            body: JSON.stringify({ userIds }),
        });
        
        console.log('Bulk delete result:', result);
        
        // Show detailed results
        let message = result.message + '\\n\\n';
        
        if (result.results.deleted.length > 0) {
            message += `✓ Successfully deleted: ${result.results.deleted.length} users\\n`;
        }
        
        if (result.results.skipped.length > 0) {
            message += `⊘ Skipped: ${result.results.skipped.length} users\\n`;
            result.results.skipped.forEach(s => {
                message += `  - ${s.reason}\\n`;
            });
        }
        
        if (result.results.failed.length > 0) {
            message += `✗ Failed: ${result.results.failed.length} users\\n`;
            result.results.failed.forEach(f => {
                message += `  - ${f.reason}\\n`;
            });
        }
        
        showToast(message, result.results.failed.length > 0 ? 'warning' : 'success', 'Bulk Delete Results');
        
        // Reload the users list
        loadUsers();
    } catch (error) {
        console.error('Bulk delete failed:', error);
        showToast('Failed to delete users: ' + error.message, 'error');
    }
}

// ==================== GOOGLE GRANTS ====================

async function loadGoogleGrants() {
    const tbody = document.getElementById('googleGrantsTableBody');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Loading...</td></tr>';

    try {
        const grants = await apiCall('/admin/google-grants');

        if (grants.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: var(--text-secondary);">No Google OAuth grants found</td></tr>';
            return;
        }

        tbody.innerHTML = grants.map(grant => {
            const connectedDate = new Date(grant.connectedAt).toLocaleDateString();
            const expiresDate = new Date(grant.expiresAt).toLocaleDateString();

            let badgeClass, badgeLabel;
            if (grant.status === 'expired') {
                badgeClass = 'badge-danger';
                badgeLabel = '● Expired';
            } else if (grant.status === 'expiring_soon') {
                badgeClass = 'badge-warning';
                badgeLabel = '● Expiring Soon';
            } else {
                badgeClass = 'badge-success';
                badgeLabel = '● Active';
            }

            return `<tr>
                <td>${grant.tenantId}</td>
                <td>${grant.userEmail}</td>
                <td>${connectedDate}</td>
                <td>${expiresDate}</td>
                <td>${grant.hoursLeft}h</td>
                <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteGoogleGrant('${grant._id}', '${grant.tenantId}')">Delete</button>
                </td>
            </tr>`;
        }).join('');
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: red;">Error loading grants: ${error.message}</td></tr>`;
    }
}

async function deleteGoogleGrant(grantId, tenantId) {
    if (!await showConfirmModal(`Delete Google OAuth grant for tenant "${tenantId}"? The tenant will need to reconnect their Google account.`, 'Delete Grant')) {
        return;
    }

    try {
        await apiCall(`/admin/google-grants/${grantId}`, { method: 'DELETE' });
        showToast('Google OAuth grant deleted successfully', 'success');
        loadGoogleGrants();
    } catch (error) {
        showToast('Failed to delete grant: ' + error.message, 'error');
    }
}

// ==================== SETTINGS ====================

async function loadSettings() {
    await checkGoogleEmailStatus();
}

async function checkGoogleEmailStatus() {
    const statusEl = document.getElementById('emailStatus');
    const connectBtn = document.getElementById('googleAuthBtn');
    const disconnectBtn = document.getElementById('googleDisconnectBtn');
    
    try {
        const result = await apiCall('/api/admin/auth/google/status');
        console.log('Google email status result:', result);
        
        if (result.success && result.data.connected) {
            statusEl.textContent = `✓ Connected as ${result.data.email}`;
            statusEl.style.color = 'var(--success)';
            connectBtn.style.display = 'none';
            disconnectBtn.style.display = 'inline-block';
        } else {
            console.log('Not connected:', result);
            statusEl.textContent = '✗ Not connected';
            statusEl.style.color = 'var(--text-secondary)';
            connectBtn.style.display = 'inline-block';
            disconnectBtn.style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking Google email status:', error);
        statusEl.textContent = '✗ Not connected';
        statusEl.style.color = 'var(--text-secondary)';
        connectBtn.style.display = 'inline-block';
        disconnectBtn.style.display = 'none';
    }
}

async function handleGoogleEmailSetup() {
    try {
        // Redirect to Google OAuth connect endpoint
        window.location.href = `${API_BASE}/api/admin/auth/google/connect`;
    } catch (error) {
        console.error('Error initiating Google OAuth:', error);
        showToast('Failed to initiate Google authentication: ' + error.message, 'error');
    }
}

async function handleGoogleEmailDisconnect() {
    if (!await showConfirmModal('Are you sure you want to disconnect your Google account?', 'Disconnect Google')) {
        return;
    }
    
    try {
        const result = await apiCall('/api/admin/auth/google/disconnect');
        
        if (result.success) {
            showToast('Google account disconnected successfully', 'success');
            await checkGoogleEmailStatus();
        } else {
            showToast('Failed to disconnect: ' + (result.message || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error disconnecting Google:', error);
        showToast('Failed to disconnect Google account: ' + error.message, 'error');
    }
}

// Make functions globally available
window.viewUser = viewUser;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.viewTenantDetails = viewTenantDetails;
window.handleGoogleEmailSetup = handleGoogleEmailSetup;
window.handleGoogleEmailDisconnect = handleGoogleEmailDisconnect;
