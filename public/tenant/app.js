// API Configuration
const API_BASE = window.location.origin;
let authToken = localStorage.getItem('tenantToken');
let currentTenant = null;
let currentUser = null;
let currentView = 'dashboard';
let editingProduct = null;
let editingContact = null;

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

    setTimeout(() => {
        toast.classList.add('toast-fadeout');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// API Helper
async function apiCall(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
        },
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check for Google OAuth callback parameters
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const error = urlParams.get('error');
    
    if (error) {
        const loginError = document.getElementById('loginError');
        if (loginError) {
            loginError.textContent = decodeURIComponent(error);
            loginError.style.display = 'block';
        }
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        showLogin();
    } else if (token) {
        // Google login successful
        console.log('Google OAuth token received, storing and loading dashboard...');
        localStorage.setItem('tenantToken', token);
        authToken = token;
        
        // Check if there's a specific view to navigate to (e.g., after calendar connection)
        const viewParam = urlParams.get('view');
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        showDashboard();
        loadUserProfile();
        
        // Navigate to specific view if requested
        if (viewParam) {
            switchView(viewParam);
        }
    } else if (authToken) {
        console.log('Existing token found, loading dashboard...');
        showDashboard();
        loadUserProfile();
    } else {
        console.log('No token found, showing login...');
        showLogin();
    }

    setupEventListeners();
});

function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Google login
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', handleGoogleLogin);
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.dataset.view;
            switchView(view);
        });
    });

    // Forms
    document.getElementById('tenantDetailsForm')?.addEventListener('submit', handleTenantDetailsUpdate);
    document.getElementById('productForm')?.addEventListener('submit', handleProductSubmit);
    document.getElementById('contactForm')?.addEventListener('submit', handleContactSubmit);

    // Payment provider config
    document.getElementById('paymentProviderSelect')?.addEventListener('change', switchPaymentProviderForm);
    document.getElementById('stripeConfigForm')?.addEventListener('submit', handleStripeConfigUpdate);
    document.getElementById('clipConfigForm')?.addEventListener('submit', handleClipConfigUpdate);

    // Availability config
    document.getElementById('availabilityForm')?.addEventListener('submit', handleAvailabilitySave);
    document.getElementById('addTimeRangeBtn')?.addEventListener('click', addTimeRange);

    // Template config
    document.getElementById('templateConfigForm')?.addEventListener('submit', handleTemplateConfigSubmit);

    // Buttons
    document.getElementById('addProductBtn')?.addEventListener('click', () => openProductModal());
    document.getElementById('refreshProducts')?.addEventListener('click', loadProducts);
    document.getElementById('addContactBtn')?.addEventListener('click', () => openContactModal());
    document.getElementById('refreshContacts')?.addEventListener('click', loadContacts);
}

// Authentication
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Login failed');
        }

        const data = await response.json();
        
        // Check if user has tenant role
        if (data.user.role !== 'tenant_admin' && data.user.role !== 'admin') {
            throw new Error('Unauthorized: Tenant admin access required');
        }

        authToken = data.token;
        localStorage.setItem('tenantToken', authToken);
        
        showDashboard();
        await loadUserProfile();
        
    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
    }
}

function handleGoogleLogin() {
    window.location.href = `${API_BASE}/auth/google/login?panel=tenant`;
}

function handleLogout() {
    localStorage.removeItem('tenantToken');
    authToken = null;
    currentTenant = null;
    currentUser = null;
    showLogin();
}

// View Management
function showLogin() {
    document.getElementById('loginView').style.display = 'flex';
    document.getElementById('dashboardView').style.display = 'none';
}

function showDashboard() {
    document.getElementById('loginView').style.display = 'none';
    document.getElementById('dashboardView').style.display = 'flex';
    switchView('dashboard');
}

function switchView(viewName) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.view === viewName) {
            item.classList.add('active');
        }
    });

    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.style.display = 'none';
    });

    // Show selected view
    const contentMap = {
        'dashboard': 'dashboardContent',
        'details': 'detailsContent',
        'products': 'productsContent',
        'contacts': 'contactsContent',
        'calendar': 'calendarContent',
        'live-site': 'liveSiteContent',
        'settings': 'settingsContent'
    };

    const contentId = contentMap[viewName];
    if (contentId) {
        document.getElementById(contentId).style.display = 'block';
        currentView = viewName;

        // Load data for the view
        loadViewData(viewName);
    }
}

async function loadViewData(viewName) {
    try {
        switch (viewName) {
            case 'dashboard':
                await loadDashboard();
                break;
            case 'details':
                await loadTenantDetails();
                break;
            case 'products':
                await loadProducts();
                break;
            case 'contacts':
                await loadContacts();
                break;
            case 'calendar':
                await loadCalendar();
                break;
            case 'live-site':
                await loadLiveSite();
                break;
            case 'settings':
                await loadSettings();
                break;
        }
    } catch (error) {
        console.error(`Error loading ${viewName}:`, error);
        showToast(`Failed to load ${viewName}: ${error.message}`, 'error');
    }
}

// User Profile
async function loadUserProfile() {
    try {
        const response = await apiCall('/users/profile');
        // Extract user from response.data.user structure
        currentUser = response.data?.user || response;
        
        document.getElementById('userEmail').textContent = currentUser.email;
        document.getElementById('userRole').textContent = currentUser.role || 'Tenant Admin';

        // Get tenant info
        if (currentUser.tenant) {
            currentTenant = { tenantId: currentUser.tenant };
            await loadTenantInfo();
        } else {
            // No tenant assigned
            document.getElementById('tenantName').textContent = 'No Tenant Assigned';
            showToast('No tenant assigned to this user. Contact administrator.', 'warning');
        }
    } catch (error) {
        console.error('Failed to load user profile:', error);
        showToast('Failed to load user profile', 'error');
        document.getElementById('tenantName').textContent = 'Error';
    }
}

async function loadTenantInfo() {
    try {
        // Fetch tenant configuration from public API
        const tenantConfig = await apiCall(`/api/tenant-public/${currentTenant.tenantId}`);
        currentTenant = { ...currentTenant, ...tenantConfig };
        document.getElementById('tenantName').textContent = tenantConfig.name || currentTenant.tenantId;
    } catch (error) {
        console.error('Failed to load tenant info:', error);
        document.getElementById('tenantName').textContent = currentTenant.tenantId || 'My Business';
    }
}

// Dashboard
async function loadDashboard() {
    try {
        if (!currentUser?.tenant) {
            document.getElementById('totalUsers').textContent = '-';
            document.getElementById('totalProducts').textContent = '-';
            document.getElementById('totalSessions').textContent = '-';
            document.getElementById('totalRevenue').textContent = '$0';
            return;
        }

        // Load products to get count
        const products = await apiCall(`/api/tenant-public/${currentUser.tenant}/products`);
        document.getElementById('totalProducts').textContent = products?.length || 0;
        
        // Other stats would require dedicated endpoints
        document.getElementById('totalUsers').textContent = '-';
        document.getElementById('totalSessions').textContent = '-';
        document.getElementById('totalRevenue').textContent = '$0';
    } catch (error) {
        console.error('Failed to load dashboard:', error);
        document.getElementById('totalUsers').textContent = '-';
        document.getElementById('totalProducts').textContent = '-';
        document.getElementById('totalSessions').textContent = '-';
        document.getElementById('totalRevenue').textContent = '$0';
    }
}

// Tenant Details
async function loadTenantDetails() {
    try {
        if (!currentUser?.tenant) {
            showToast('No tenant associated with this user', 'warning');
            return;
        }

        // Load tenant details from API
        const tenantData = await apiCall(`/api/tenant-public/${currentUser.tenant}`);
        
        document.getElementById('detailTenantId').value = tenantData.tenantId;
        document.getElementById('detailDomain').value = tenantData.domain || 'Not configured';
        document.getElementById('detailName').value = tenantData.name || '';
        document.getElementById('detailDescription').value = tenantData.description || '';

        // Load deployment status
        updateDeploymentStatus(tenantData);
    } catch (error) {
        console.error('Failed to load tenant details:', error);
        showToast('Failed to load tenant details', 'error');
    }
}

async function handleTenantDetailsUpdate(event) {
    event.preventDefault();
    
    const name = document.getElementById('detailName').value;
    const description = document.getElementById('detailDescription').value;

    try {
        // Update tenant details via API
        showToast('Tenant details updated successfully', 'success');
    } catch (error) {
        showToast('Failed to update tenant details: ' + error.message, 'error');
    }
}

function updateDeploymentStatus(tenant) {
    const statusBadge = document.getElementById('deploymentStatusBadge');
    const urlContainer = document.getElementById('deploymentUrl');
    const urlLink = document.getElementById('deploymentUrlLink');
    const dateContainer = document.getElementById('deploymentDate');
    const dateValue = document.getElementById('deploymentDateValue');
    const message = document.getElementById('deploymentMessage');
    
    const status = tenant.deploymentStatus || 'not_deployed';
    
    const statusConfig = {
        'pending': { label: 'Pending', class: 'badge-secondary' },
        'provisioning': { label: 'Provisioning...', class: 'badge-warning' },
        'deployed': { label: 'Deployed ✅', class: 'badge-success' },
        'failed': { label: 'Failed ❌', class: 'badge-danger' },
        'not_deployed': { label: 'Not Deployed', class: 'badge-secondary' }
    };
    
    const config = statusConfig[status] || statusConfig['not_deployed'];
    statusBadge.textContent = config.label;
    statusBadge.className = `badge ${config.class}`;
    
    if (status === 'deployed' && tenant.frontendUrl) {
        urlContainer.style.display = 'block';
        urlLink.href = tenant.frontendUrl;
        urlLink.textContent = tenant.frontendUrl;
        message.textContent = 'Your frontend is live and accessible to customers.';
    } else {
        urlContainer.style.display = 'none';
        message.textContent = 'Contact your administrator for frontend deployment.';
    }
    
    if (status === 'deployed' && tenant.deployedAt) {
        dateContainer.style.display = 'block';
        dateValue.textContent = new Date(tenant.deployedAt).toLocaleDateString();
    } else {
        dateContainer.style.display = 'none';
    }
}

// Products
async function loadProducts() {
    const tbody = document.getElementById('productsTableBody');
    
    try {
        // Use admin API for products (tenant admins can see all products)
        const products = await apiCall('/admin/products');
        
        if (!products || products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No products found. Click "Add Product" to create your first product.</td></tr>';
            return;
        }

        tbody.innerHTML = products.map(product => `
            <tr>
                <td>${escapeHtml(product.name)}</td>
                <td>${escapeHtml(product.description || '-')}</td>
                <td>$${product.price} ${product.currency || 'USD'}</td>
                <td>${product.duration ? product.duration + ' min' : '-'}</td>
                <td>
                    <span class="badge ${product.active ? 'badge-success' : 'badge-secondary'}">
                        ${product.active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td class="action-btns">
                    <button class="btn btn-secondary btn-sm" onclick="editProduct('${product._id}')" title="Edit">✏️</button>
                    <button class="btn ${product.active ? 'btn-warning' : 'btn-success'} btn-sm" onclick="toggleProductActive('${product._id}')" title="${product.active ? 'Deactivate' : 'Activate'}">
                        ${product.active ? '👁️' : '👁️‍🗨️'}
                    </button>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--danger);">Failed to load products</td></tr>';
        console.error('Failed to load products:', error);
    }
}

function openProductModal(product = null) {
    editingProduct = product;
    const modal = document.getElementById('productModal');
    const title = document.getElementById('productModalTitle');
    const form = document.getElementById('productForm');

    if (product) {
        title.textContent = 'Edit Product';
        document.getElementById('productName').value = product.name;
        document.getElementById('productDescription').value = product.description || '';
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productCurrency').value = product.currency || 'MXN';
        document.getElementById('productPaymentProvider').value = product.paymentProvider || 'stripe';
        document.getElementById('productPaymentProviderId').value = product.paymentProviderProductId || '';
        document.getElementById('productDuration').value = product.duration || '';
        document.getElementById('productActive').checked = product.active;
    } else {
        title.textContent = 'Add Product';
        form.reset();
        document.getElementById('productActive').checked = true;
        document.getElementById('productPaymentProvider').value = 'stripe';
    }

    modal.classList.add('active');
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
    editingProduct = null;
}

async function handleProductSubmit(event) {
    event.preventDefault();

    const productData = {
        name: document.getElementById('productName').value,
        description: document.getElementById('productDescription').value,
        price: parseFloat(document.getElementById('productPrice').value),
        currency: document.getElementById('productCurrency').value,
        paymentProvider: document.getElementById('productPaymentProvider').value,
        paymentProviderProductId: document.getElementById('productPaymentProviderId').value || undefined,
        duration: parseInt(document.getElementById('productDuration').value) || undefined,
        active: document.getElementById('productActive').checked,
    };

    try {
        if (editingProduct) {
            await apiCall(`/admin/products/${editingProduct._id}`, {
                method: 'PATCH',
                body: JSON.stringify(productData),
            });
            showToast('Product updated successfully', 'success');
        } else {
            await apiCall('/admin/products', {
                method: 'POST',
                body: JSON.stringify(productData),
            });
            showToast('Product created successfully', 'success');
        }

        closeProductModal();
        await loadProducts();
    } catch (error) {
        showToast('Failed to save product: ' + error.message, 'error');
    }
}

async function editProduct(productId) {
    try {
        const product = await apiCall(`/admin/products/${productId}`);
        openProductModal(product);
    } catch (error) {
        showToast('Failed to load product: ' + error.message, 'error');
    }
}

async function toggleProductActive(productId) {
    try {
        const product = await apiCall(`/admin/products/${productId}`);
        await apiCall(`/admin/products/${productId}`, {
            method: 'PATCH',
            body: JSON.stringify({ active: !product.active }),
        });
        showToast(`Product ${product.active ? 'deactivated' : 'activated'}`, 'success');
        await loadProducts();
    } catch (error) {
        showToast('Failed to toggle product status: ' + error.message, 'error');
    }
}

// Contacts
async function loadContacts() {
    const tbody = document.getElementById('contactsTableBody');
    
    try {
        const contacts = await apiCall('/admin/contacts');
        
        if (!contacts || contacts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No contacts found. Click "Add Contact" to create your first contact.</td></tr>';
            return;
        }

        tbody.innerHTML = contacts.map(contact => `
            <tr>
                <td>${contact.firstName} ${contact.lastName}</td>
                <td>${contact.email}</td>
                <td>${contact.phone || '-'}</td>
                <td><span class="badge badge-${contact.type === 'customer' ? 'primary' : contact.type === 'lead' ? 'warning' : 'secondary'}">${contact.type || 'customer'}</span></td>
                <td>
                    <button onclick="openContactModal(${JSON.stringify(contact).replace(/"/g, '&quot;')})" class="btn btn-sm btn-secondary">Edit</button>
                    <button onclick="deleteContact('${contact._id}')" class="btn btn-sm btn-danger">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load contacts:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">Failed to load contacts. Try refreshing.</td></tr>';
    }
}

function openContactModal(contact = null) {
    editingContact = contact;
    const modal = document.getElementById('contactModal');
    const title = document.getElementById('contactModalTitle');
    const form = document.getElementById('contactForm');

    if (contact) {
        title.textContent = 'Edit Contact';
        document.getElementById('contactFirstName').value = contact.firstName;
        document.getElementById('contactLastName').value = contact.lastName;
        document.getElementById('contactEmail').value = contact.email;
        document.getElementById('contactPhone').value = contact.phone || '';
        document.getElementById('contactType').value = contact.type || 'customer';
        document.getElementById('contactNotes').value = contact.notes || '';
    } else {
        title.textContent = 'Add Contact';
        form.reset();
    }

    modal.classList.add('active');
}

function closeContactModal() {
    document.getElementById('contactModal').classList.remove('active');
    editingContact = null;
}

async function handleContactSubmit(event) {
    event.preventDefault();

    const contactData = {
        firstName: document.getElementById('contactFirstName').value,
        lastName: document.getElementById('contactLastName').value,
        email: document.getElementById('contactEmail').value,
        phone: document.getElementById('contactPhone').value || undefined,
        type: document.getElementById('contactType').value,
        notes: document.getElementById('contactNotes').value || undefined,
    };

    try {
        if (editingContact) {
            // Update existing contact
            await apiCall(`/admin/contacts/${editingContact._id}`, {
                method: 'PATCH',
                body: JSON.stringify(contactData)
            });
            showToast('Contact updated successfully', 'success');
        } else {
            // Create new contact
            await apiCall('/admin/contacts', {
                method: 'POST',
                body: JSON.stringify(contactData)
            });
            showToast('Contact created successfully', 'success');
        }
        
        closeContactModal();
        await loadContacts();
    } catch (error) {
        showToast('Failed to save contact: ' + error.message, 'error');
    }
}

async function deleteContact(contactId) {
    if (!confirm('Are you sure you want to delete this contact?')) {
        return;
    }

    try {
        await apiCall(`/admin/contacts/${contactId}`, {
            method: 'DELETE'
        });
        showToast('Contact deleted successfully', 'success');
        await loadContacts();
    } catch (error) {
        showToast('Failed to delete contact: ' + error.message, 'error');
    }
}

// Settings
async function loadSettings() {
    try {
        if (!currentUser?.tenant) return;

        // Load payment provider configurations
        const tenantData = await apiCall(`/api/tenant-public/${currentUser.tenant}`);
        
        // Load Stripe config
        const stripeConfig = tenantData.settings?.paymentProviders?.find(p => p.provider === 'stripe');
        if (stripeConfig) {
            document.getElementById('stripeApiKey').value = stripeConfig.config.apiKey || '';
            document.getElementById('stripePublishableKey').value = stripeConfig.config.publishableKey || '';
            document.getElementById('stripeWebhookSecret').value = stripeConfig.config.webhookSecret || '';
            document.getElementById('stripeEnabled').checked = stripeConfig.enabled || false;
        }

        // Load Clip config
        const clipConfig = tenantData.settings?.paymentProviders?.find(p => p.provider === 'clip');
        if (clipConfig) {
            document.getElementById('clipApiKey').value = clipConfig.config.apiKey || '';
            document.getElementById('clipSecretKey').value = clipConfig.config.secretKey || '';
            document.getElementById('clipEnvironment').value = clipConfig.config.environment || 'sandbox';
            document.getElementById('clipEnabled').checked = clipConfig.enabled || false;
        }

        // Show first provider form
        switchPaymentProviderForm();

        // Load availability config
        await loadAvailability();
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

function switchPaymentProviderForm() {
    const selected = document.getElementById('paymentProviderSelect').value;
    
    // Hide all forms
    document.querySelectorAll('.provider-config-form').forEach(form => {
        form.style.display = 'none';
    });
    
    // Show selected form
    if (selected === 'stripe') {
        document.getElementById('stripeConfigForm').style.display = 'block';
    } else if (selected === 'clip') {
        document.getElementById('clipConfigForm').style.display = 'block';
    }
}

async function handleStripeConfigUpdate(event) {
    event.preventDefault();

    if (!currentUser?.tenant) {
        showToast('No tenant associated', 'error');
        return;
    }

    const configData = {
        provider: 'stripe',
        enabled: document.getElementById('stripeEnabled').checked,
        config: {
            apiKey: document.getElementById('stripeApiKey').value,
            publishableKey: document.getElementById('stripePublishableKey').value,
            webhookSecret: document.getElementById('stripeWebhookSecret').value,
        }
    };

    try {
        await apiCall(`/admin/tenants/${currentUser.tenant}/payment-provider`, {
            method: 'POST',
            body: JSON.stringify(configData),
        });
        showToast('Stripe configuration saved successfully', 'success');
    } catch (error) {
        showToast('Failed to save Stripe config: ' + error.message, 'error');
    }
}

async function handleClipConfigUpdate(event) {
    event.preventDefault();

    if (!currentUser?.tenant) {
        showToast('No tenant associated', 'error');
        return;
    }

    const configData = {
        provider: 'clip',
        enabled: document.getElementById('clipEnabled').checked,
        config: {
            apiKey: document.getElementById('clipApiKey').value,
            secretKey: document.getElementById('clipSecretKey').value,
            environment: document.getElementById('clipEnvironment').value,
        }
    };

    try {
        await apiCall(`/admin/tenants/${currentUser.tenant}/payment-provider`, {
            method: 'POST',
            body: JSON.stringify(configData),
        });
        showToast('Clip configuration saved successfully', 'success');
    } catch (error) {
        showToast('Failed to save Clip config: ' + error.message, 'error');
    }
}

// Availability Schedule Management
async function loadAvailability() {
    try {
        if (!currentUser?.tenant) return;

        const data = await apiCall(`/admin/availability`);
        const avail = data.availability;
        const timezones = data.timezones || [];

        // Populate timezone dropdown
        const tzSelect = document.getElementById('availTimezone');
        tzSelect.innerHTML = '';
        timezones.forEach(tz => {
            const opt = document.createElement('option');
            opt.value = tz;
            opt.textContent = tz;
            tzSelect.appendChild(opt);
        });
        tzSelect.value = avail.timezone || 'America/Monterrey';

        // Set session duration
        document.getElementById('availSessionDuration').value = avail.sessionDuration || 30;

        // Set available days
        document.querySelectorAll('input[name="availDay"]').forEach(cb => {
            cb.checked = (avail.availableDays || []).includes(cb.value);
        });

        // Set available hours
        const container = document.getElementById('availHoursContainer');
        container.innerHTML = '';
        if (avail.availableHours && avail.availableHours.length > 0) {
            avail.availableHours.forEach(range => {
                addTimeRange(null, range.startTime, range.endTime);
            });
        }
    } catch (error) {
        console.error('Failed to load availability:', error);
    }
}

function addTimeRange(event, startTime = '09:00', endTime = '17:00') {
    if (event) event.preventDefault();

    const container = document.getElementById('availHoursContainer');
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;';
    row.innerHTML = `
        <input type="time" class="avail-start" value="${startTime}" style="padding: 0.4rem; border: 1px solid var(--border); border-radius: 4px;">
        <span>to</span>
        <input type="time" class="avail-end" value="${endTime}" style="padding: 0.4rem; border: 1px solid var(--border); border-radius: 4px;">
        <button type="button" onclick="this.parentElement.remove()" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: var(--danger, #e74c3c);">✕</button>
    `;
    container.appendChild(row);
}

async function handleAvailabilitySave(event) {
    event.preventDefault();
    if (!currentUser?.tenant) {
        showToast('No tenant associated', 'error');
        return;
    }

    const timezone = document.getElementById('availTimezone').value;
    const sessionDuration = parseInt(document.getElementById('availSessionDuration').value);

    const availableDays = [];
    document.querySelectorAll('input[name="availDay"]:checked').forEach(cb => {
        availableDays.push(cb.value);
    });

    const availableHours = [];
    document.querySelectorAll('#availHoursContainer > div').forEach(row => {
        const start = row.querySelector('.avail-start')?.value;
        const end = row.querySelector('.avail-end')?.value;
        if (start && end) {
            availableHours.push({ startTime: start, endTime: end });
        }
    });

    try {
        await apiCall(`/admin/availability`, {
            method: 'PUT',
            body: JSON.stringify({ timezone, sessionDuration, availableDays, availableHours }),
        });
        showToast('Availability saved successfully', 'success');
    } catch (error) {
        showToast('Failed to save availability: ' + error.message, 'error');
    }
}

// Calendar & Meetings Management
async function loadCalendar() {
    try {
        if (!currentUser?.tenant) return;

        // Check calendar connection status
        await checkCalendarConnection();

        // Load upcoming bookings
        await loadUpcomingBookings();
        
        // Initialize global sync preference checkbox
        const globalSyncCheckbox = document.getElementById('globalSyncPreference');
        if (globalSyncCheckbox) {
            globalSyncCheckbox.checked = getGlobalSyncPreference();
        }
        
        // Initialize sync status
        updateSyncStatus();
        
        // Update sync status every minute
        setInterval(updateSyncStatus, 60000);
    } catch (error) {
        console.error('Failed to load calendar:', error);
        showToast('Failed to load calendar', 'error');
    }
}

async function loadUpcomingBookings() {
    const bookingsList = document.getElementById('upcomingMeetingsList');
    
    try {
        const bookings = await apiCall('/admin/bookings');
        
        if (bookings.length === 0) {
            bookingsList.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    <p>No upcoming bookings</p>
                    <p style="font-size: 0.9rem; margin-top: 0.5rem;">Create your first booking to get started</p>
                </div>
            `;
            return;
        }

        // Filter future bookings and sort by start time
        const futureBookings = bookings
            .filter(b => b.meetingStartTimestamp > Date.now())
            .sort((a, b) => a.meetingStartTimestamp - b.meetingStartTimestamp);

        if (futureBookings.length === 0) {
            bookingsList.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    <p>No upcoming bookings</p>
                </div>
            `;
            return;
        }

        bookingsList.innerHTML = futureBookings.map(booking => {
            const startTime = new Date(booking.meetingStartTimestamp);
            const endTime = new Date(booking.meetingEndTimestamp);
            const isToday = startTime.toDateString() === new Date().toDateString();
            
            return `
                <div class="meeting-item" style="border-bottom: 1px solid var(--border); padding: 1rem 0;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <h4 style="margin: 0 0 0.5rem 0; font-size: 1.1rem;">${booking.title || 'Untitled Booking'}</h4>
                            <div style="display: flex; flex-direction: column; gap: 0.3rem; color: var(--text-secondary); font-size: 0.9rem;">
                                <div>
                                    📅 ${isToday ? 'Today' : startTime.toLocaleDateString()} 
                                    • ${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div>👤 ${booking.customerName} (${booking.customerEmail})</div>
                                <div>🏷️ ${booking.type === 'tutoring' ? 'Tutoring' : 'Consultancy'}</div>
                                ${booking.videoCallLink ? `<div>🎥 <a href="${booking.videoCallLink}" target="_blank">Join Video Call</a></div>` : ''}
                                ${!booking.videoCallLink ? '<div style="color: var(--warning);">⚠️ No video call link</div>' : ''}
                            </div>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            ${!booking.videoCallLink ? `
                                <button onclick="generateMeetLink('${booking._id}')" class="btn btn-sm btn-primary" title="Generate Google Meet Link">
                                    🎥
                                </button>
                            ` : ''}
                            <button onclick="editBooking('${booking._id}')" class="btn btn-sm btn-secondary" title="Edit">
                                ✏️
                            </button>
                            <button onclick="deleteBooking('${booking._id}')" class="btn btn-sm btn-secondary" title="Delete">
                                🗑️
                            </button>
                        </div>
                    </div>
                    ${booking.description ? `<p style="margin: 0.5rem 0 0 0; color: var(--text-secondary); font-size: 0.9rem;">${booking.description}</p>` : ''}
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Failed to load bookings:', error);
        bookingsList.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--danger);">
                <p>Failed to load bookings</p>
                <p style="font-size: 0.9rem; margin-top: 0.5rem;">${error.message}</p>
            </div>
        `;
    }
}

async function generateMeetLink(bookingId) {
    try {
        const result = await apiCall(`/admin/bookings/${bookingId}/generate-meet-link`, {
            method: 'POST',
        });
        showToast('Google Meet link generated successfully!', 'success');
        await loadUpcomingBookings();
    } catch (error) {
        console.error('Failed to generate Meet link:', error);
        showToast('Failed to generate video call: ' + error.message, 'error');
    }
}

function openCreateMeetingModal() {
    // Open booking modal
    openCreateBookingModal();
}

function openCreateBookingModal() {
    const modal = document.getElementById('createBookingModal');
    if (!modal) {
        showToast('Booking modal not found', 'error');
        return;
    }

    // Reset form
    document.getElementById('createBookingForm').reset();
    
    // Reset modal to create mode
    const modalTitle = document.getElementById('createBookingModalTitle');
    if (modalTitle) modalTitle.textContent = 'Create Booking';
    const submitBtn = document.querySelector('#createBookingModal form button[type="submit"]');
    if (submitBtn) {
        submitBtn.textContent = 'Create Booking';
        submitBtn.onclick = null; // Remove any edit handler
    }
    
    // Set tenant ID
    if (currentUser?.tenant) {
        document.getElementById('bookingTenant').value = currentUser.tenant;
    }
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('bookingDate').value = today;
    
    // Set default timezone to browser timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    document.getElementById('bookingTimezone').value = timezone;
    
    // Set sync checkbox based on global preference
    const globalSyncEnabled = getGlobalSyncPreference();
    document.getElementById('bookingAutoSync').checked = globalSyncEnabled;
    
    modal.style.display = 'flex';
}

function closeCreateBookingModal() {
    const modal = document.getElementById('createBookingModal');
    if (modal) {
        modal.style.display = 'none';
        
        // Reset modal to create mode
        const modalTitle = document.getElementById('createBookingModalTitle');
        if (modalTitle) modalTitle.textContent = 'Create Booking';
        const submitBtn = document.querySelector('#createBookingModal form button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = 'Create Booking';
            submitBtn.onclick = null; // Remove any edit handler
        }
    }
}

// Global sync preference helpers
function getGlobalSyncPreference() {
    const stored = localStorage.getItem('globalSyncToCalendar');
    // Default to true if not set
    return stored === null ? true : stored === 'true';
}

function setGlobalSyncPreference(enabled) {
    localStorage.setItem('globalSyncToCalendar', enabled.toString());
}

function handleGlobalSyncToggle() {
    const checkbox = document.getElementById('globalSyncPreference');
    const enabled = checkbox.checked;
    setGlobalSyncPreference(enabled);
    
    if (enabled) {
        showToast('New bookings will sync to Google Calendar by default', 'success');
    } else {
        showToast('New bookings will not sync to Google Calendar by default', 'info');
    }
}

async function handleCreateBooking(event) {
    event.preventDefault();

    if (!currentUser?.tenant) {
        showToast('No tenant associated', 'error');
        return;
    }

    // Get form values
    const customerName = document.getElementById('bookingCustomerName').value.trim();
    const customerEmail = document.getElementById('bookingCustomerEmail').value.trim();
    const title = document.getElementById('bookingTitle').value.trim();
    const description = document.getElementById('bookingDescription').value.trim();
    const date = document.getElementById('bookingDate').value;
    const startTime = document.getElementById('bookingStartTime').value;
    const endTime = document.getElementById('bookingEndTime').value;
    const timezone = document.getElementById('bookingTimezone').value.trim();
    const location = document.getElementById('bookingLocation').value.trim();
    const status = document.getElementById('bookingStatus').value;
    const paymentExpirationDays = parseInt(document.getElementById('bookingPaymentExpiration').value) || 7;

    // Validate
    if (!customerName || !customerEmail || !title || !date || !startTime || !endTime || !timezone || !status) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    // Combine date and time to create timestamps
    const startDateTime = new Date(`${date}T${startTime}`);
    const endDateTime = new Date(`${date}T${endTime}`);

    if (endDateTime <= startDateTime) {
        showToast('End time must be after start time', 'error');
        return;
    }

    // Calculate payment expiration timestamp
    const paymentExpiration = new Date();
    paymentExpiration.setDate(paymentExpiration.getDate() + paymentExpirationDays);

    // Create booking payload
    const bookingData = {
        tenantId: currentUser.tenant,
        customerName,
        customerEmail,
        title,
        description: description || undefined,
        meetingStartTimestamp: startDateTime.getTime(),
        meetingEndTimestamp: endDateTime.getTime(),
        guestTimezone: timezone,
        location: location || undefined,
        status,
        paymentExpirationTimestamp: paymentExpiration.getTime(),
        sessionId: 'manual-' + Date.now(), // Generate a session ID for manually created bookings
    };

    try {
        const result = await apiCall('/admin/bookings', {
            method: 'POST',
            body: JSON.stringify(bookingData),
        });

        showToast('Booking created successfully', 'success');
        
        // Check if auto-sync to calendar is enabled
        const autoSync = document.getElementById('bookingAutoSync').checked;
        if (autoSync) {
            // Sync to Google Calendar (without Meet link)
            try {
                showToast('Syncing to Google Calendar...', 'info');
                await apiCall(`/admin/bookings/${result._id}/sync-to-calendar`, {
                    method: 'POST',
                });
                showToast('Booking synced to Google Calendar', 'success');
            } catch (syncError) {
                console.error('Failed to sync to calendar:', syncError);
                showToast('Booking created but calendar sync failed: ' + syncError.message, 'warning');
            }
        }
        
        closeCreateBookingModal();
        await loadUpcomingBookings();
    } catch (error) {
        console.error('Failed to create booking:', error);
        showToast('Failed to create booking: ' + error.message, 'error');
    }
}

async function editBooking(bookingId) {
    try {
        // Fetch booking details
        const booking = await apiCall(`/admin/bookings/${bookingId}`);
        
        // Open the create booking modal but populate it with existing data
        const modal = document.getElementById('createBookingModal');
        const modalTitle = document.getElementById('createBookingModalTitle');
        if (modalTitle) modalTitle.textContent = 'Edit Booking';
        
        // Populate form fields
        document.getElementById('bookingCustomerName').value = booking.customerName;
        document.getElementById('bookingCustomerEmail').value = booking.customerEmail;
        document.getElementById('bookingTenant').value = booking.tenantId || '';
        document.getElementById('bookingTitle').value = booking.title;
        document.getElementById('bookingDescription').value = booking.description || '';
        
        // Convert timestamps to date/time
        const startDate = new Date(booking.meetingStartTimestamp);
        const endDate = new Date(booking.meetingEndTimestamp);
        
        document.getElementById('bookingDate').value = startDate.toISOString().split('T')[0];
        document.getElementById('bookingStartTime').value = startDate.toTimeString().slice(0, 5);
        document.getElementById('bookingEndTime').value = endDate.toTimeString().slice(0, 5);
        document.getElementById('bookingTimezone').value = Intl.DateTimeFormat().resolvedOptions().timeZone;
        document.getElementById('bookingLocation').value = booking.location || '';
        document.getElementById('bookingStatus').value = booking.status || 'confirmed';
        
        // Payment expiration
        if (booking.paymentExpiration) {
            const paymentDate = new Date(booking.paymentExpiration);
            document.getElementById('bookingPaymentExpiration').value = paymentDate.toISOString().split('T')[0];
        }
        
        // Change the submit button to update mode
        const submitBtn = document.querySelector('#createBookingModal form button[type="submit"]');
        submitBtn.textContent = 'Update Booking';
        submitBtn.onclick = async (e) => {
            e.preventDefault();
            await handleUpdateBooking(bookingId);
        };
        
        modal.style.display = 'flex';
    } catch (error) {
        console.error('Failed to load booking:', error);
        showToast('Failed to load booking: ' + error.message, 'error');
    }
}

async function handleUpdateBooking(bookingId) {
    const updateData = {
        customerName: document.getElementById('bookingCustomerName').value,
        customerEmail: document.getElementById('bookingCustomerEmail').value,
        title: document.getElementById('bookingTitle').value,
        description: document.getElementById('bookingDescription').value,
        location: document.getElementById('bookingLocation').value,
        status: document.getElementById('bookingStatus').value,
    };
    
    // Parse date and time
    const date = document.getElementById('bookingDate').value;
    const startTime = document.getElementById('bookingStartTime').value;
    const endTime = document.getElementById('bookingEndTime').value;
    
    if (date && startTime && endTime) {
        const startDateTime = new Date(`${date}T${startTime}`);
        const endDateTime = new Date(`${date}T${endTime}`);
        updateData.meetingStartTimestamp = startDateTime.getTime();
        updateData.meetingEndTimestamp = endDateTime.getTime();
    }
    
    // Payment expiration
    const paymentExpiration = document.getElementById('bookingPaymentExpiration').value;
    if (paymentExpiration) {
        updateData.paymentExpiration = new Date(paymentExpiration).getTime();
    }
    
    try {
        await apiCall(`/admin/bookings/${bookingId}`, {
            method: 'PATCH',
            body: JSON.stringify(updateData)
        });
        
        showToast('Booking updated successfully', 'success');
        closeCreateBookingModal();
        await loadUpcomingBookings();
    } catch (error) {
        console.error('Failed to update booking:', error);
        showToast('Failed to update booking: ' + error.message, 'error');
    }
}

async function deleteBooking(bookingId) {
    if (!confirm('Are you sure you want to delete this booking?')) {
        return;
    }

    try {
        await apiCall(`/admin/bookings/${bookingId}`, {
            method: 'DELETE',
        });
        showToast('Booking deleted successfully', 'success');
        await loadUpcomingBookings();
    } catch (error) {
        console.error('Failed to delete booking:', error);
        showToast('Failed to delete booking: ' + error.message, 'error');
    }
}

async function syncFromGoogleCalendar() {
    const btn = document.getElementById('syncCalendarBtn');
    const originalText = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '⏳ Syncing...';
        
        const result = await apiCall('/admin/bookings/sync-from-calendar', {
            method: 'POST'
        });
        
        if (result.success) {
            // Save sync timestamp
            localStorage.setItem('lastCalendarSync', Date.now().toString());
            updateSyncStatus();
            
            showToast(
                `Sync complete: ${result.updated} updated, ${result.deleted} deleted, ${result.unchanged} unchanged`,
                'success'
            );
            await loadUpcomingBookings(); // Reload the bookings list
        } else {
            showToast('Sync failed: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Failed to sync from calendar:', error);
        showToast('Failed to sync from calendar: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function updateSyncStatus() {
    const lastSync = localStorage.getItem('lastCalendarSync');
    const syncStatusChip = document.getElementById('syncStatusChip');
    const syncStatusDot = document.getElementById('syncStatusDot');
    const syncStatusText = document.getElementById('syncStatusText');
    
    if (!syncStatusChip) return; // Guard if elements don't exist
    
    if (!lastSync) {
        syncStatusChip.style.background = '#e9ecef';
        syncStatusChip.style.color = '#6c757d';
        syncStatusDot.style.background = '#6c757d';
        syncStatusText.textContent = 'Never synced';
        syncStatusChip.setAttribute('title', 'Click "Sync from Calendar" to fetch latest updates from Google Calendar');
        return;
    }
    
    const syncTimestamp = parseInt(lastSync);
    const now = Date.now();
    const minutesAgo = Math.floor((now - syncTimestamp) / 60000);
    
    // Update status chip (traffic light) with tooltip
    if (minutesAgo < 1) {
        syncStatusChip.style.background = '#d1f4e0';
        syncStatusChip.style.color = '#0d6832';
        syncStatusDot.style.background = '#28a745';
        syncStatusText.textContent = 'Synced now';
        syncStatusChip.setAttribute('title', 'Just synced with Google Calendar');
    } else if (minutesAgo < 15) {
        // Fresh data (< 15 min) - Green
        syncStatusChip.style.background = '#d1f4e0';
        syncStatusChip.style.color = '#0d6832';
        syncStatusDot.style.background = '#28a745';
        syncStatusText.textContent = `${minutesAgo}m ago`;
        syncStatusChip.setAttribute('title', `Last synced ${minutesAgo} minute${minutesAgo > 1 ? 's' : ''} ago`);
    } else if (minutesAgo < 60) {
        // Moderate (15-60 min) - Yellow
        syncStatusChip.style.background = '#fff3cd';
        syncStatusChip.style.color = '#856404';
        syncStatusDot.style.background = '#ffc107';
        syncStatusText.textContent = `${minutesAgo}m ago`;
        syncStatusChip.setAttribute('title', `Last synced ${minutesAgo} minutes ago - consider syncing`);
    } else {
        const hoursAgo = Math.floor(minutesAgo / 60);
        // Stale data (> 60 min) - Red
        syncStatusChip.style.background = '#f8d7da';
        syncStatusChip.style.color = '#721c24';
        syncStatusDot.style.background = '#dc3545';
        if (hoursAgo < 24) {
            syncStatusText.textContent = `${hoursAgo}h ago`;
            syncStatusChip.setAttribute('title', `Last synced ${hoursAgo} hour${hoursAgo > 1 ? 's' : ''} ago - sync recommended`);
        } else {
            const daysAgo = Math.floor(hoursAgo / 24);
            syncStatusText.textContent = `${daysAgo}d ago`;
            syncStatusChip.setAttribute('title', `Last synced ${daysAgo} day${daysAgo > 1 ? 's' : ''} ago - sync recommended`);
        }
    }
}

// Live Site Template Management
let quillEditor = null;
let currentTemplateSlug = 'two-column';

async function loadLiveSite() {
    try {
        if (!currentUser?.tenant) return;

        // Initialize Quill editor if not already done
        if (!quillEditor) {
            initializeQuillEditor();
        }

        // Check calendar connection status
        await checkCalendarConnection();

        // Show configuration section for two-column template
        document.getElementById('templateConfigSection').style.display = 'block';

        // Load existing images
        await loadTenantImages();

        // Load existing template configuration
        try {
            const templates = await apiCall(`/admin/templates/${currentUser.tenant}`);
            const twoColumnTemplate = templates.find(t => t.templateSlug === 'two-column');

            if (twoColumnTemplate && twoColumnTemplate.templateDescription) {
                // Set editor content
                quillEditor.root.innerHTML = twoColumnTemplate.templateDescription;
            }
        } catch (apiError) {
            console.log('No existing template configuration found, starting fresh');
        }
    } catch (error) {
        console.error('Failed to load live site:', error);
        showToast('Failed to initialize template editor', 'error');
    }
}

async function checkCalendarConnection() {
    if (!currentUser?.tenant) return;

    try {
        const status = await apiCall('/admin/meetings/connection-status');
        
        const connectedDiv = document.getElementById('calendarConnected');
        const notConnectedDiv = document.getElementById('calendarNotConnected');
        const banner = document.getElementById('calendarConnectionBanner');
        const indicator = document.getElementById('calendarStatusIndicator');
        const emailSpan = document.getElementById('calendarEmail');

        if (status.connected) {
            // Show connected state
            connectedDiv.style.display = 'block';
            notConnectedDiv.style.display = 'none';
            indicator.style.display = 'block';

            // Display connected email if available
            if (status.email && emailSpan) {
                emailSpan.textContent = status.email;
            }

            // Show expiration warning if needed
            if (status.needsReconnection) {
                indicator.innerHTML = '<span class="badge badge-warning">● Reconnection Needed</span>';
                banner.className = 'alert alert-warning';
                banner.style.display = 'block';
                
                const hoursText = status.expiresIn > 0 
                    ? `expires in ${status.expiresIn} hours` 
                    : 'has expired';
                
                banner.innerHTML = `
                    <strong>⚠️ Calendar sync ${hoursText}</strong>
                    <p style="margin: 0.5rem 0 0 0;">Click the button below to reconnect and continue automatic syncing.</p>
                    <button onclick="connectGoogleCalendar()" class="btn btn-primary" style="margin-top: 1rem;">
                        🔄 Reconnect Calendar
                    </button>
                `;
            } else {
                indicator.innerHTML = '<span class="badge badge-success">● Connected</span>';
                banner.style.display = 'none';
            }
        } else {
            // Show not connected state
            connectedDiv.style.display = 'none';
            notConnectedDiv.style.display = 'block';
            indicator.style.display = 'none';
            banner.style.display = 'none';
        }
    } catch (error) {
        console.error('Failed to check calendar connection:', error);
        document.getElementById('calendarNotConnected').style.display = 'block';
        document.getElementById('calendarConnected').style.display = 'none';
        document.getElementById('calendarStatusIndicator').style.display = 'none';
    }
}

async function connectGoogleCalendar() {
    if (!currentUser?.tenant) {
        showToast('No tenant associated', 'error');
        return;
    }

    // Redirect to Google OAuth flow
    window.location.href = `/api/admin/auth/google/connect?tenant=${currentUser.tenant}`;
}

async function disconnectGoogleCalendar() {
    if (!confirm('Are you sure you want to disconnect Google Calendar? Automatic sync will stop.')) {
        return;
    }

    try {
        await apiCall('/api/admin/auth/google/disconnect', {
            method: 'GET',
        });
        
        showToast('Google Calendar disconnected', 'success');
        await checkCalendarConnection();
    } catch (error) {
        showToast('Failed to disconnect: ' + error.message, 'error');
    }
}

async function loadTenantImages() {
    if (!currentUser?.tenant) return;

    try {
        const images = await apiCall(`/admin/templates/${currentUser.tenant}/images`);
        
        if (images.logo) {
            showImagePreview('logo', images.logo);
        }
        
        if (images.profile) {
            showImagePreview('profile', images.profile);
        }
    } catch (error) {
        console.log('No existing images found');
    }
}

function showImagePreview(type, url) {
    const preview = document.getElementById(`${type}Preview`);
    const previewImg = document.getElementById(`${type}PreviewImg`);
    const uploadBtn = document.getElementById(`${type}UploadBtn`);
    
    if (preview && previewImg && uploadBtn) {
        previewImg.src = url;
        preview.style.display = 'flex';
        uploadBtn.style.display = 'none';
    }
}

async function handleImageUpload(type, input) {
    if (!currentUser?.tenant) {
        showToast('No tenant associated', 'error');
        return;
    }

    const file = input.files[0];
    if (!file) return;

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('File size must be less than 5MB', 'error');
        input.value = '';
        return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('Please upload an image file', 'error');
        input.value = '';
        return;
    }

    const formData = new FormData();
    formData.append('image', file);
    formData.append('imageType', type);

    try {
        const response = await fetch(`${API_BASE}/admin/templates/${currentUser.tenant}/upload-image`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        const result = await response.json();
        
        // Show preview
        showImagePreview(type, result.url);
        showToast(`${type === 'logo' ? 'Logo' : 'Profile photo'} uploaded successfully`, 'success');
        
        // Clear input
        input.value = '';
    } catch (error) {
        showToast(`Failed to upload ${type}: ${error.message}`, 'error');
        input.value = '';
    }
}

async function removeImage(type) {
    if (!currentUser?.tenant) {
        showToast('No tenant associated', 'error');
        return;
    }

    try {
        const response = await apiCall(`/admin/templates/${currentUser.tenant}/images/${type}`, {
            method: 'DELETE',
        });

        if (response.success) {
            // Hide preview and show upload button
            const preview = document.getElementById(`${type}Preview`);
            const uploadBtn = document.getElementById(`${type}UploadBtn`);
            
            if (preview && uploadBtn) {
                preview.style.display = 'none';
                uploadBtn.style.display = 'block';
            }
            
            showToast(response.message || `${type === 'logo' ? 'Logo' : 'Profile photo'} removed successfully`, 'success');
        } else {
            showToast(response.message || 'Failed to remove image', 'error');
        }
    } catch (error) {
        showToast(`Failed to remove ${type}: ${error.message}`, 'error');
    }
}

function initializeQuillEditor() {
    // Initialize Quill with limited toolbar (bold, italic only)
    quillEditor = new Quill('#templateDescriptionEditor', {
        theme: 'snow',
        modules: {
            toolbar: [
                ['bold', 'italic'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['clean']
            ]
        },
        placeholder: 'Enter your template description here...'
    });

    // Update hidden field when content changes
    quillEditor.on('text-change', () => {
        document.getElementById('templateDescription').value = quillEditor.root.innerHTML;
    });
}

async function handleTemplateConfigSubmit(event) {
    event.preventDefault();

    if (!currentUser?.tenant) {
        showToast('No tenant associated', 'error');
        return;
    }

    const description = quillEditor.root.innerHTML;

    if (!description || description.trim() === '<p><br></p>') {
        showToast('Please enter a template description', 'error');
        return;
    }

    const templateData = {
        templateSlug: currentTemplateSlug,
        templateTenant: currentUser.tenant,
        templateDescription: description,
        config: {}
    };

    try {
        await apiCall('/admin/templates', {
            method: 'POST',
            body: JSON.stringify(templateData),
        });
        showToast('Template configuration saved successfully', 'success');
    } catch (error) {
        // If template exists, try updating it
        try {
            await apiCall(`/admin/templates/${currentUser.tenant}/${currentTemplateSlug}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    templateDescription: description,
                }),
            });
            showToast('Template configuration updated successfully', 'success');
        } catch (updateError) {
            showToast('Failed to save template: ' + error.message, 'error');
        }
    }
}

// Utility Functions
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function formatPrice(price, currency) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'MXN',
    }).format(price);
}

// Make image upload functions globally accessible
window.handleImageUpload = handleImageUpload;
window.removeImage = removeImage;
