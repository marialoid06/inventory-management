// public/admin.js
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');

    // --- 1. API Helper (MOVED TO TOP) ---
    const api = async (method, url, body = null) => {
        const headers = { 'Authorization': `Bearer ${token}` };
        const options = { method, headers };
        if (body) {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
        
        const response = await fetch(url, options);
        
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('token');
            window.location.href = '/login.html';
            return null;
        }
        
        const text = await response.text();
        if (!text) return { message: 'Success' }; // Handle empty responses

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse JSON:", text);
            return { message: 'Error parsing response' };
        }
        
        if (!response.ok) {
            throw new Error(data.message || 'An error occurred');
        }
        
        return data;
    };

    // --- 0. Global Setup: Get user info (NOW AFTER API IS DEFINED) ---
    const welcomeMessageEl = document.getElementById('welcome-message');
    if (welcomeMessageEl) {
        api('GET', '/api/admin/profile/basic').then(user => {
            if (user && user.username) {
                welcomeMessageEl.textContent = `Welcome, ${user.username}!`;
            }
        }).catch(err => console.error("Error fetching admin name", err));
    }

    // --- 1. Security Check & Global Helpers ---
    if (!token && !window.location.pathname.endsWith('login.html') && !window.location.pathname.endsWith('register.html')  && !window.location.pathname.endsWith('forgot-password.html') && !window.location.pathname.endsWith('reset-password.html')) {
        window.location.href = '/login.html';
        return;
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            window.location.href = '/login.html';
        });
    }
    
    // Helper to show messages
    const showMessage = (elementId, message, isSuccess) => {
        const el = document.getElementById(elementId);
        if(el) {
            el.textContent = message;
            el.className = isSuccess ? 'message-success' : 'message-error';
            setTimeout(() => { if (el) el.textContent = ''; }, 3000);
        }
    };

    // Helper for password icon toggles
    const setupPasswordToggles = () => {
        document.querySelectorAll('.toggle-password').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = btn.previousElementSibling;
                const showIcon = btn.querySelector('.icon-show');
                const hideIcon = btn.querySelector('.icon-hide');
                
                if (input.type === 'password') {
                    input.type = 'text';
                    showIcon.style.display = 'none';
                    hideIcon.style.display = 'inline';
                } else {
                    input.type = 'password';
                    showIcon.style.display = 'inline';
                    hideIcon.style.display = 'none';
                }
            });
        });
    };

    // --- 2. Page-Specific Logic ---
    const page = window.location.pathname;
    setupPasswordToggles();

    // --- ADMIN DASHBOARD ---
    if (page.endsWith('/admin-dashboard.html') || page.endsWith('/')) {
        api('GET', '/api/admin/stats').then(data => {
            if (data) {
                document.getElementById('total-products').textContent = data.totalProducts;
                document.getElementById('total-suppliers').textContent = data.totalSuppliers;
                document.getElementById('inventory-value').textContent = `$${parseFloat(data.inventoryValue).toFixed(2)}`;
            }
        }).catch(err => console.error(err));

        api('GET', '/api/admin/low-stock').then(data => {
            if (data) {
                const tableBody = document.getElementById('low-stock-table-body');
                tableBody.innerHTML = '';
                if (data.length === 0) tableBody.innerHTML = '<tr><td colspan="3">No low stock items!</td></tr>';
                data.forEach(item => {
                    tableBody.innerHTML += `<tr><td>${item.product_id}</td><td>${item.product_name}</td><td>${item.stock}</td></tr>`;
                });
            }
        }).catch(err => console.error(err));
    }

    // --- ADMIN PRODUCTS ---
    if (page.endsWith('/admin-products.html')) {
        // ... (this logic is unchanged from the previous step) ...
        const tableBody = document.getElementById('products-table-body');
        const modal = document.getElementById('product-modal');
        const form = document.getElementById('product-form');
        const searchInput = document.getElementById('product-search');
        const catSelect = document.getElementById('product-category');
        const supSelect = document.getElementById('product-supplier');
        let categories = [];
        let suppliers = [];

        const loadProducts = (search = '') => {
            api('GET', `/api/admin/products?search=${search}`).then(products => {
                tableBody.innerHTML = '';
                if (!products) return;
                products.forEach(p => {
                    tableBody.innerHTML += `
                        <tr>
                            <td>${p.product_id}</td>
                            <td>${p.product_name}</td>
                            <td>${p.category_name || 'N/A'}</td>
                            <td>${p.supplier_name || 'N/A'}</td>
                            <td>${p.stock}</td>
                            <td>$${p.cost_price || 0}</td>
                            <td>$${p.selling_price || 0}</td>
                            <td>
                                <button class="btn-edit" data-id="${p.product_id}">Edit</button>
                                <button class="btn-delete" data-id="${p.product_id}">Delete</button>
                            </td>
                        </tr>
                    `;
                });
            }).catch(err => console.error(err));
        };
        
        const loadDropdowns = async () => {
            try {
                categories = await api('GET', '/api/admin/categories');
                suppliers = await api('GET', '/api/admin/suppliers');
                catSelect.innerHTML = '<option value="">Select Category</option>';
                supSelect.innerHTML = '<option value="">Select Supplier</option>';
                categories.forEach(c => catSelect.innerHTML += `<option value="${c.category_id}">${c.category_name}</option>`);
                suppliers.forEach(s => supSelect.innerHTML += `<option value="${s.supplier_id}">${s.supplier_name}</option>`);
            } catch(err) { console.error(err); }
        };

        searchInput.addEventListener('input', (e) => loadProducts(e.target.value));
        
        document.getElementById('add-product-btn').addEventListener('click', () => {
            form.reset();
            document.getElementById('product-id').value = '';
            document.getElementById('modal-title').textContent = 'Add New Product';
            modal.style.display = 'flex';
        });
        document.getElementById('close-modal').addEventListener('click', () => modal.style.display = 'none');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const productId = document.getElementById('product-id').value;
            const productData = {
                product_name: document.getElementById('product-name').value,
                category_id: document.getElementById('product-category').value,
                supplier_id: document.getElementById('product-supplier').value,
                stock: document.getElementById('product-stock').value,
                cost_price: document.getElementById('product-cost').value,
                selling_price: document.getElementById('product-selling').value,
            };

            try {
                if (productId) {
                    await api('PUT', `/api/admin/products/${productId}`, productData);
                } else {
                    await api('POST', '/api/admin/products', productData);
                }
                modal.style.display = 'none';
                loadProducts(searchInput.value);
            } catch(err) { alert(`Error: ${err.message}`); }
        });

        tableBody.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            if (e.target.classList.contains('btn-edit')) {
                try {
                    const products = await api('GET', '/api/admin/products');
                    const product = products.find(p => p.product_id == id);
                    if(!product) return;
                    document.getElementById('product-id').value = product.product_id;
                    document.getElementById('product-name').value = product.product_name;
                    document.getElementById('product-category').value = product.category_id;
                    document.getElementById('product-supplier').value = product.supplier_id;
                    document.getElementById('product-stock').value = product.stock;
                    document.getElementById('product-cost').value = product.cost_price;
                    document.getElementById('product-selling').value = product.selling_price;
                    document.getElementById('modal-title').textContent = 'Edit Product';
                    modal.style.display = 'flex';
                } catch(err) { console.error(err); }
            }
            if (e.target.classList.contains('btn-delete')) {
                if (confirm('Are you sure you want to delete this product?')) {
                    try {
                        await api('DELETE', `/api/admin/products/${id}`);
                        loadProducts(searchInput.value);
                    } catch(err) { alert(`Error: ${err.message}`); }
                }
            }
        });

        loadProducts();
        loadDropdowns();
    }

    // --- ADMIN CATEGORIES ---
    if (page.endsWith('/admin-categories.html')) {
        // ... (this logic is unchanged from the previous step) ...
        const tableBody = document.getElementById('categories-table-body');
        const searchInput = document.getElementById('category-search');
        const modal = document.getElementById('category-modal');
        const form = document.getElementById('category-form');

        const loadCategories = (search = '') => {
            api('GET', `/api/admin/categories?search=${search}`).then(data => {
                if(!data) return;
                tableBody.innerHTML = '';
                data.forEach(c => {
                    tableBody.innerHTML += `
                        <tr>
                            <td>${c.category_id}</td>
                            <td>${c.category_name}</td>
                            <td>
                                <button class="btn-edit" data-id="${c.category_id}" data-name="${c.category_name}">Edit</button>
                                <button class="btn-delete" data-id="${c.category_id}">Delete</button>
                            </td>
                        </tr>`;
                });
            }).catch(err => console.error(err));
        };
        
        searchInput.addEventListener('input', (e) => loadCategories(e.target.value));
        
        document.getElementById('add-category-btn').addEventListener('click', () => {
            form.reset();
            document.getElementById('category-id').value = '';
            document.getElementById('modal-title').textContent = 'Add New Category';
            modal.style.display = 'flex';
        });
        document.getElementById('close-modal').addEventListener('click', () => modal.style.display = 'none');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('category-id').value;
            const data = { category_name: document.getElementById('category-name').value };
            try {
                if (id) {
                    await api('PUT', `/api/admin/categories/${id}`, data);
                } else {
                    await api('POST', '/api/admin/categories', data);
                }
                modal.style.display = 'none';
                loadCategories(searchInput.value);
            } catch(err) { alert(`Error: ${err.message}`); }
        });

        tableBody.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            if (e.target.classList.contains('btn-edit')) {
                document.getElementById('category-id').value = id;
                document.getElementById('category-name').value = e.target.dataset.name;
                document.getElementById('modal-title').textContent = 'Edit Category';
                modal.style.display = 'flex';
            }
            if (e.target.classList.contains('btn-delete')) {
                if (confirm('Are you sure you want to delete this category?')) {
                    try {
                        await api('DELETE', `/api/admin/categories/${id}`);
                        loadCategories(searchInput.value);
                    } catch(err) { alert(`Error: ${err.message}`); }
                }
            }
        });
        
        loadCategories();
    }
    
    // --- ADMIN SUPPLIERS ---
    if (page.endsWith('/admin-suppliers.html')) {
        // ... (this logic is unchanged from the previous step) ...
        const tableBody = document.getElementById('suppliers-table-body');
        const searchInput = document.getElementById('supplier-search');
        const modal = document.getElementById('supplier-modal');
        const form = document.getElementById('supplier-form');

        const loadSuppliers = (search = '') => {
            api('GET', `/api/admin/suppliers?search=${search}`).then(data => {
                if(!data) return;
                tableBody.innerHTML = '';
                data.forEach(s => {
                    tableBody.innerHTML += `
                        <tr>
                            <td>${s.supplier_id}</td>
                            <td>${s.supplier_name}</td>
                            <td>${s.contact_email || ''}</td>
                            <td>${s.contact_phone || ''}</td>
                            <td>
                                <button class="btn-edit" data-id="${s.supplier_id}">Edit</button>
                                <button class="btn-delete" data-id="${s.supplier_id}">Delete</button>
                            </td>
                        </tr>`;
                });
            }).catch(err => console.error(err));
        };
        
        searchInput.addEventListener('input', (e) => loadSuppliers(e.target.value));
        
        document.getElementById('add-supplier-btn').addEventListener('click', () => {
            form.reset();
            document.getElementById('supplier-id').value = '';
            document.getElementById('modal-title').textContent = 'Add New Supplier';
            modal.style.display = 'flex';
        });
        document.getElementById('close-modal').addEventListener('click', () => modal.style.display = 'none');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('supplier-id').value;
            const data = {
                supplier_name: document.getElementById('supplier-name').value,
                contact_email: document.getElementById('supplier-email').value,
                contact_phone: document.getElementById('supplier-phone').value,
            };
            try {
                if (id) {
                    await api('PUT', `/api/admin/suppliers/${id}`, data);
                } else {
                    await api('POST', '/api/admin/suppliers', data);
                }
                modal.style.display = 'none';
                loadSuppliers(searchInput.value);
            } catch(err) { alert(`Error: ${err.message}`); }
        });

        tableBody.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            if (e.target.classList.contains('btn-edit')) {
                const suppliers = await api('GET', '/api/admin/suppliers');
                const s = suppliers.find(s => s.supplier_id == id);
                if (!s) return;
                document.getElementById('supplier-id').value = s.supplier_id;
                document.getElementById('supplier-name').value = s.supplier_name;
                document.getElementById('supplier-email').value = s.contact_email;
                document.getElementById('supplier-phone').value = s.contact_phone;
                document.getElementById('modal-title').textContent = 'Edit Supplier';
                modal.style.display = 'flex';
            }
            if (e.target.classList.contains('btn-delete')) {
                if (confirm('Are you sure you want to delete this supplier?')) {
                    try {
                        await api('DELETE', `/api/admin/suppliers/${id}`);
                        loadSuppliers(searchInput.value);
                    } catch(err) { alert(`Error: ${err.message}`); }
                }
            }
        });
        
        loadSuppliers();
    }

    // --- ADMIN ORDERS ---
    if (page.endsWith('/admin-orders.html')) {
        const tableBody = document.getElementById('orders-table-body');
        const searchInput = document.getElementById('order-search');
        // *** NEW: Get modal elements ***
        const invoiceModal = document.getElementById('invoice-modal');
        const closeInvoiceModal = document.getElementById('close-invoice-modal');
        
        if (closeInvoiceModal) {
            closeInvoiceModal.addEventListener('click', () => {
                invoiceModal.style.display = 'none';
            });
        }
        
        const loadOrders = (search = '') => {
            api('GET', `/api/admin/orders?search=${search}`).then(data => {
                if(!data) return;
                tableBody.innerHTML = '';
                data.forEach(o => {
                    let actions = '';
                    // *** NEW: Updated Actions Logic ***
                    if (o.status === 'Pending Payment') {
                        actions = `<button class="btn-delete btn-cancel-order" data-id="${o.order_id}">Cancel</button>`;
                    } else {
                        // Show "View Details" for all other statuses (Paid, Cancelled)
                        actions = `<button class="btn-edit btn-view-details" data-id="${o.order_id}">View Details</button>`;
                    }
                    
                    tableBody.innerHTML += `
                        <tr>
                            <td>${o.order_id}</td>
                            <td>${o.customer_name}</td>
                            <td>${new Date(o.order_date).toLocaleDateString()}</td>
                            <td>$${o.total_amount || 0}</td>
                            <td>${o.status}</td>
                            <td>${actions}</td>
                        </tr>`;
                });
            }).catch(err => console.error(err));
        };

        tableBody.addEventListener('click', async (e) => {
            const orderId = e.target.dataset.id;
            if (e.target.classList.contains('btn-cancel-order')) {
                if (confirm(`Are you sure you want to cancel order #${orderId}?`)) {
                    try {
                        await api('PUT', `/api/admin/orders/${orderId}/cancel`);
                        loadOrders(searchInput.value); // Refresh the list
                    } catch (err) {
                        alert(`Error: ${err.message}`);
                    }
                }
            }
            
            // *** NEW: Handle View Details click ***
            if (e.target.classList.contains('btn-view-details')) {
                try {
                    const data = await api('GET', `/api/admin/orders/${orderId}`);
                    const { order, items } = data;
                    
                    // Populate modal
                    document.getElementById('invoice-order-id').textContent = order.order_id;
                    document.getElementById('invoice-customer-name').textContent = order.customer_name; // Admin sees customer name
                    document.getElementById('invoice-order-date').textContent = new Date(order.order_date).toLocaleDateString();
                    document.getElementById('invoice-order-status').textContent = order.status;
                    document.getElementById('invoice-grand-total').textContent = `$${parseFloat(order.total_amount).toFixed(2)}`;
                    
                    const itemsBody = document.getElementById('invoice-items-body');
                    itemsBody.innerHTML = '';
                    items.forEach(item => {
                        const itemTotal = parseFloat(item.price_snapshot) * item.quantity;
                        itemsBody.innerHTML += `
                            <tr>
                                <td>${item.product_name_snapshot}</td>
                                <td>$${parseFloat(item.price_snapshot).toFixed(2)}</td>
                                <td>${item.quantity}</td>
                                <td>$${itemTotal.toFixed(2)}</td>
                            </tr>
                        `;
                    });
                    
                    // Show modal
                    invoiceModal.style.display = 'flex';
                    
                } catch (err) {
                    alert(`Error fetching order details: ${err.message}`);
                }
            }
        });

        searchInput.addEventListener('input', (e) => loadOrders(e.target.value));
        loadOrders();
    }

    // --- ADMIN PROFILE ---
    if (page.endsWith('/admin-profile.html')) {
        // ... (this logic is unchanged from the previous step) ...
        api('GET', '/api/admin/profile').then(user => {
            if (user) {
                document.getElementById('profile-username').value = user.username;
                document.getElementById('profile-email').value = user.email;
                document.getElementById('profile-phone').value = user.phone || '';
            }
        }).catch(err => console.error(err));

        document.getElementById('profile-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                email: document.getElementById('profile-email').value,
                phone: document.getElementById('profile-phone').value
            };
            try {
                const result = await api('PUT', '/api/admin/profile', data);
                showMessage('profile-message', result.message, true);
            } catch(err) { showMessage('profile-message', err.message, false); }
        });

        document.getElementById('password-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            if (newPassword !== confirmPassword) {
                showMessage('password-message', 'New passwords do not match.', false);
                return;
            }
            const data = { currentPassword, newPassword };
            try {
                const result = await api('PUT', '/api/admin/change-password', data);
                showMessage('password-message', result.message, true);
                e.target.reset();
            } catch(err) { showMessage('password-message', err.message, false); }
        });
    }
});