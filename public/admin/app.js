// API Configuration
const API_BASE = window.location.origin;
let authToken = localStorage.getItem('adminToken');
let currentView = 'dashboard';
let currentPage = 1;

// DOM Elements
const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const usersView = document.getElementById('usersView');
const tenantsView = document.getElementById('tenantsView');
const subscriptionsView = document.getElementById('subscriptionsView');
const sidebar = document.querySelector('.sidebar');
const mainContent = document.querySelector('.main-content');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (authToken) {
        showAdminPanel();
        loadDashboard();
    } else {
        showLogin();
    }
    
    setupEventListeners();
});

function setupEventListeners() {
    // Login
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    
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
    document.getElementById('refreshSubscriptions')?.addEventListener('click', () => loadSubscriptions());
    
    // Modal
    document.getElementById('closeModal')?.addEventListener('click', closeModal);
    document.getElementById('editModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'editModal') closeModal();
    });
}

// Auth Functions
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

function showLogin() {
    loginView.style.display = 'block';
    dashboardView.style.display = 'none';
    usersView.style.display = 'none';
    tenantsView.style.display = 'none';
    subscriptionsView.style.display = 'none';
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
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    });
    
    if (response.status === 401 || response.status === 403) {
        handleLogout();
        throw new Error('Session expired');
    }
    
    if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
    }
    
    return response.json();
}

// View Switching
function switchView(view) {
    currentView = view;
    currentPage = 1;
    
    // Update nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    
    // Update title
    const titles = {
        dashboard: 'Dashboard',
        users: 'User Management',
        tenants: 'Tenant Management',
        subscriptions: 'Subscription Management',
    };
    document.getElementById('pageTitle').textContent = titles[view];
    
    // Show view
    dashboardView.style.display = view === 'dashboard' ? 'block' : 'none';
    usersView.style.display = view === 'users' ? 'block' : 'none';
    tenantsView.style.display = view === 'tenants' ? 'block' : 'none';
    subscriptionsView.style.display = view === 'subscriptions' ? 'block' : 'none';
    
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
        case 'subscriptions':
            loadSubscriptions();
            break;
    }
}

// Dashboard
async function loadDashboard() {
    try {
        const stats = await apiCall('/admin/dashboard/stats');
        
        document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
        document.getElementById('totalTenants').textContent = '4'; // Static for now
        document.getElementById('totalSubscriptions').textContent = stats.totalSubscriptions || 0;
        document.getElementById('activeSessions').textContent = '-';
        
    } catch (error) {
        console.error('Failed to load dashboard:', error);
    }
}

// Users
async function loadUsers(page = 1) {
    try {
        const data = await apiCall(`/admin/users?page=${page}&limit=50`);
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '';
        
        data.data.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
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
        alert('Failed to load user details');
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
                alert('User updated successfully');
            } catch (error) {
                alert('Failed to update user: ' + error.message);
            }
        });
        
        modal.classList.add('active');
        
    } catch (error) {
        console.error('Failed to edit user:', error);
        alert('Failed to load user details');
    }
}

async function deleteUser(userId, email) {
    if (!confirm(`Are you sure you want to delete user ${email}? This action cannot be undone.`)) {
        return;
    }
    
    try {
        await apiCall(`/admin/users/${userId}`, { method: 'DELETE' });
        loadUsers(currentPage);
        alert('User deleted successfully');
    } catch (error) {
        alert('Failed to delete user: ' + error.message);
    }
}

// Tenants
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
        
        const modal = document.getElementById('editModal');
        document.getElementById('modalTitle').textContent = `Tenant: ${data.tenant.name}`;
        document.getElementById('modalBody').innerHTML = `
            <div class="form-group">
                <strong>Domain:</strong> ${data.tenant.domain}
            </div>
            <div class="form-group">
                <strong>Description:</strong> ${data.tenant.description}
            </div>
            <div class="form-group">
                <strong>Users:</strong> ${data.users.length}
            </div>
            <div class="form-group">
                <strong>Sessions:</strong> ${data.sessions.length}
            </div>
            <h4 style="margin-top: 1.5rem; margin-bottom: 1rem;">Recent Users</h4>
            ${data.users.slice(0, 10).map(user => `
                <div style="padding: 0.5rem; margin-bottom: 0.5rem; background: var(--bg-dark); border-radius: 6px;">
                    ${user.email} - ${user.firstName || ''} ${user.lastName || ''}
                </div>
            `).join('') || 'No users'}
        `;
        modal.classList.add('active');
        
    } catch (error) {
        console.error('Failed to view tenant:', error);
        alert('Failed to load tenant details');
    }
}

// Subscriptions
async function loadSubscriptions(page = 1) {
    try {
        const data = await apiCall(`/admin/subscriptions?page=${page}&limit=50`);
        const tbody = document.getElementById('subscriptionsTableBody');
        tbody.innerHTML = '';
        
        data.data.forEach(sub => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${sub.user ? `${sub.user.email}` : 'Unknown'}</td>
                <td><span class="badge badge-primary">${sub.planId}</span></td>
                <td>${formatDate(sub.createdAt)}</td>
                <td class="action-btns">
                    <button class="btn btn-secondary btn-sm" onclick="editSubscription('${sub.userId}', '${sub.planId}')">Change Plan</button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        renderPagination('subscriptionsPagination', data.pagination, loadSubscriptions);
        
    } catch (error) {
        console.error('Failed to load subscriptions:', error);
    }
}

async function editSubscription(userId, currentPlan) {
    const newPlan = prompt(`Enter new plan ID for user (current: ${currentPlan}):`);
    if (!newPlan || newPlan === currentPlan) return;
    
    try {
        await apiCall(`/admin/subscriptions/${userId}`, {
            method: 'PATCH',
            body: JSON.stringify({ planId: newPlan }),
        });
        loadSubscriptions(currentPage);
        alert('Subscription updated successfully');
    } catch (error) {
        alert('Failed to update subscription: ' + error.message);
    }
}

// Utilities
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function getRoleBadge(role) {
    const badges = {
        superAdmin: 'danger',
        tenantAdmin: 'warning',
        user: 'secondary',
    };
    return badges[role] || 'secondary';
}

function renderPagination(containerId, pagination, loadFunction) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <button ${pagination.page <= 1 ? 'disabled' : ''} onclick="window.currentPage=${pagination.page - 1}; ${loadFunction.name}(${pagination.page - 1})">Previous</button>
        <span>Page ${pagination.page} of ${pagination.totalPages}</span>
        <button ${pagination.page >= pagination.totalPages ? 'disabled' : ''} onclick="window.currentPage=${pagination.page + 1}; ${loadFunction.name}(${pagination.page + 1})">Next</button>
    `;
}

function closeModal() {
    document.getElementById('editModal').classList.remove('active');
}

// Make functions globally available
window.viewUser = viewUser;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.viewTenantDetails = viewTenantDetails;
window.editSubscription = editSubscription;
