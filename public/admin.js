document.addEventListener('DOMContentLoaded', () => {
    // --- GLOBAL VARIABLES & SECURITY ---
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    // 1. Security Redirect
    if (!token && !['/login.html', '/register.html', '/forgot-password.html', '/reset-password.html'].some(path => window.location.pathname.endsWith(path))) {
        window.location.href = '/login.html';
        return;
    }

    if (user && user.role !== 'admin' && !window.location.pathname.endsWith('/login.html')) {
        // Double check: if logged in as customer, kick them out of admin pages
        window.location.href = '/customer-shop.html'; 
        return;
    }

    // --- 2. API HELPER ---
    const api = async (method, url, body = null) => {
        const headers = { 'Authorization': `Bearer ${token}` };
        const options = { method, headers };
        if (body) {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
        
        try {
            const response = await fetch(url, options);
            if (response.status === 401 || response.status === 403) {
                localStorage.clear(); // Clear everything
                window.location.href = '/login.html';
                return null;
            }
            const text = await response.text();
            if (!text) return { message: 'Success' }; 
            
            const data = JSON.parse(text);
            if (!response.ok) throw new Error(data.message || 'An error occurred');
            return data;
        } catch (e) {
            console.error("API Error:", e);
            throw e;
        }
    };

    // --- 3. UTILITIES (Debounce & UI) ---
    
    // Prevents API spamming while searching
    const debounce = (func, wait) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    };

    // Highlight current page in Sidebar
    const navLinks = document.querySelectorAll('.sidebar ul li a'); // Adjust selector to match your HTML
    navLinks.forEach(link => {
        if (link.href === window.location.href) {
            link.classList.add('active'); // Ensure your CSS has an .active class
        }
    });

    // Password Toggle Helper
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

    // --- 4. PAGE ROUTING LOGIC ---
    const page = window.location.pathname;

    // --- ADMIN DASHBOARD ---
    if (page.endsWith('/admin-dashboard.html') || page.endsWith('/')) {
        const welcomeMsg = document.getElementById('welcome-message');
        if(user && welcomeMsg) welcomeMsg.textContent = `Welcome, ${user.first_name || 'Admin'}!`;

        api('GET', '/api/admin/stats').then(data => {
            if (data) {
                document.getElementById('total-products').textContent = data.totalProducts || 0;
                document.getElementById('total-suppliers').textContent = data.totalSuppliers || 0;
                document.getElementById('inventory-value').textContent = `$${parseFloat(data.inventoryValue || 0).toFixed(2)}`;
            }
        });

        api('GET', '/api/admin/low-stock').then(data => {
            const tbody = document.getElementById('low-stock-table-body');
            tbody.innerHTML = '';
            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3">No low stock items!</td></tr>';
            } else {
                data.forEach(item => {
                    tbody.innerHTML += `<tr><td>${item.product_id}</td><td>${item.product_name}</td><td>${item.stock}</td></tr>`;
                });
            }
        });
    }

    // --- ADMIN PRODUCTS ---
    if (page.endsWith('/admin-products.html')) {
        const tableBody = document.getElementById('products-table-body');
        const modal = document.getElementById('product-modal');
        const form = document.getElementById('product-form');
        const searchInput = document.getElementById('product-search');

        // Load Products with Sorting logic (Newest First)
        const loadProducts = (search = '') => {
            api('GET', `/api/admin/products?search=${search}`).then(products => {
                tableBody.innerHTML = '';
                if (!products) return;
                
                // CLIENT SIDE SORT: Ensure Newest (Higher ID) is at top
                // Remove this line if your SQL already handles "ORDER BY product_id DESC"
                products.sort((a, b) => b.product_id - a.product_id); 

                products.forEach(p => {
                    tableBody.innerHTML += `
                        <tr>
                            <td>${p.product_id}</td>
                            <td>${p.product_name}</td>
                            <td>${p.category_name || 'N/A'}</td>
                            <td>${p.supplier_name || 'N/A'}</td>
                            <td>${p.stock}</td>
                            <td>$${parseFloat(p.cost_price).toFixed(2)}</td>
                            <td>$${parseFloat(p.selling_price).toFixed(2)}</td>
                            <td>
                                <button class="btn-edit" data-id="${p.product_id}">Edit</button>
                                <button class="btn-delete" data-id="${p.product_id}">Delete</button>
                            </td>
                        </tr>`;
                });
            });
        };

        // Populate Dropdowns
        const loadDropdowns = async () => {
            const [cats, sups] = await Promise.all([
                api('GET', '/api/admin/categories'),
                api('GET', '/api/admin/suppliers')
            ]);
            
            const catSelect = document.getElementById('product-category');
            const supSelect = document.getElementById('product-supplier');
            
            catSelect.innerHTML = '<option value="">Select Category</option>';
            cats.forEach(c => catSelect.innerHTML += `<option value="${c.category_id}">${c.category_name}</option>`);
            
            supSelect.innerHTML = '<option value="">Select Supplier</option>';
            sups.forEach(s => supSelect.innerHTML += `<option value="${s.supplier_id}">${s.supplier_name}</option>`);
        };

        // Debounced Search
        searchInput.addEventListener('input', debounce((e) => loadProducts(e.target.value), 300));

        // Add Button
        document.getElementById('add-product-btn').addEventListener('click', () => {
            form.reset();
            document.getElementById('product-id').value = '';
            document.getElementById('modal-title').textContent = 'Add New Product';
            modal.style.display = 'flex';
        });

        document.getElementById('close-modal').addEventListener('click', () => modal.style.display = 'none');

        // Form Submit
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const productId = document.getElementById('product-id').value;
            
            // Validate and Format Data for Schema
            const productData = {
                product_name: document.getElementById('product-name').value,
                category_id: parseInt(document.getElementById('product-category').value),
                supplier_id: parseInt(document.getElementById('product-supplier').value),
                stock: parseInt(document.getElementById('product-stock').value),
                cost_price: parseFloat(document.getElementById('product-cost').value),
                selling_price: parseFloat(document.getElementById('product-selling').value),
            };

            try {
                if (productId) {
                    await api('PUT', `/api/admin/products/${productId}`, productData);
                } else {
                    await api('POST', '/api/admin/products', productData);
                }
                modal.style.display = 'none';
                loadProducts(searchInput.value); // Refresh list
            } catch(err) { alert(err.message); }
        });

        // Edit/Delete Click Handler
        tableBody.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            if (e.target.classList.contains('btn-edit')) {
                // Fetch specific product details to ensure fresh data
                const products = await api('GET', `/api/admin/products`); 
                const p = products.find(x => x.product_id == id);
                if(p) {
                    document.getElementById('product-id').value = p.product_id;
                    document.getElementById('product-name').value = p.product_name;
                    document.getElementById('product-category').value = p.category_id;
                    document.getElementById('product-supplier').value = p.supplier_id;
                    document.getElementById('product-stock').value = p.stock;
                    document.getElementById('product-cost').value = p.cost_price;
                    document.getElementById('product-selling').value = p.selling_price;
                    document.getElementById('modal-title').textContent = 'Edit Product';
                    modal.style.display = 'flex';
                }
            }
            if (e.target.classList.contains('btn-delete')) {
                if (confirm('Delete this product?')) {
                    await api('DELETE', `/api/admin/products/${id}`);
                    loadProducts(searchInput.value);
                }
            }
        });

        loadProducts();
        loadDropdowns();
    }

    // --- ADMIN CATEGORIES ---
    if (page.endsWith('/admin-categories.html')) {
        const tableBody = document.getElementById('categories-table-body');
        const modal = document.getElementById('category-modal');
        const searchInput = document.getElementById('category-search');

        const loadCategories = (search = '') => {
            api('GET', `/api/admin/categories?search=${search}`).then(data => {
                tableBody.innerHTML = '';
                // Optional: Sort Categories Alphabetically
                if(data) data.sort((a,b) => a.category_name.localeCompare(b.category_name));
                
                if(data) data.forEach(c => {
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
            });
        };

        searchInput.addEventListener('input', debounce((e) => loadCategories(e.target.value), 300));
        
        document.getElementById('add-category-btn').addEventListener('click', () => {
            document.getElementById('category-form').reset();
            document.getElementById('category-id').value = '';
            document.getElementById('modal-title').textContent = 'Add Category';
            modal.style.display = 'flex';
        });
        document.getElementById('close-modal').addEventListener('click', () => modal.style.display = 'none');

        document.getElementById('category-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('category-id').value;
            const data = { category_name: document.getElementById('category-name').value };
            try {
                if (id) await api('PUT', `/api/admin/categories/${id}`, data);
                else await api('POST', '/api/admin/categories', data);
                modal.style.display = 'none';
                loadCategories(searchInput.value);
            } catch(err) { alert(err.message); }
        });

        tableBody.addEventListener('click', async (e) => {
            if (e.target.classList.contains('btn-edit')) {
                document.getElementById('category-id').value = e.target.dataset.id;
                document.getElementById('category-name').value = e.target.dataset.name;
                document.getElementById('modal-title').textContent = 'Edit Category';
                modal.style.display = 'flex';
            }
            if (e.target.classList.contains('btn-delete')) {
                if (confirm('Delete category?')) {
                    await api('DELETE', `/api/admin/categories/${e.target.dataset.id}`);
                    loadCategories(searchInput.value);
                }
            }
        });
        loadCategories();
    }

    // --- ADMIN SUPPLIERS ---
    if (page.endsWith('/admin-suppliers.html')) {
        // ... (Logic is identical to Categories but with more fields. Use Debounce here too!)
        const tableBody = document.getElementById('suppliers-table-body');
        const modal = document.getElementById('supplier-modal');
        const form = document.getElementById('supplier-form');
        const searchInput = document.getElementById('supplier-search');

        const loadSuppliers = (search = '') => {
            api('GET', `/api/admin/suppliers?search=${search}`).then(data => {
                tableBody.innerHTML = '';
                if(data) data.forEach(s => {
                    tableBody.innerHTML += `
                        <tr>
                            <td>${s.supplier_id}</td>
                            <td>${s.supplier_name}</td>
                            <td>${s.contact_email || '-'}</td>
                            <td>${s.contact_phone || '-'}</td>
                            <td>
                                <button class="btn-edit" data-id="${s.supplier_id}">Edit</button>
                                <button class="btn-delete" data-id="${s.supplier_id}">Delete</button>
                            </td>
                        </tr>`;
                });
            });
        };

        searchInput.addEventListener('input', debounce((e) => loadSuppliers(e.target.value), 300));
        
        document.getElementById('add-supplier-btn').addEventListener('click', () => {
            form.reset();
            document.getElementById('supplier-id').value = '';
            document.getElementById('modal-title').textContent = 'Add Supplier';
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
                if (id) await api('PUT', `/api/admin/suppliers/${id}`, data);
                else await api('POST', '/api/admin/suppliers', data);
                modal.style.display = 'none';
                loadSuppliers(searchInput.value);
            } catch(err) { alert(err.message); }
        });
        
        // Add Edit/Delete listeners (same as Products)
        tableBody.addEventListener('click', async (e) => {
             const id = e.target.dataset.id;
             if (e.target.classList.contains('btn-edit')) {
                 const suppliers = await api('GET', '/api/admin/suppliers');
                 const s = suppliers.find(x => x.supplier_id == id);
                 if(s) {
                     document.getElementById('supplier-id').value = s.supplier_id;
                     document.getElementById('supplier-name').value = s.supplier_name;
                     document.getElementById('supplier-email').value = s.contact_email;
                     document.getElementById('supplier-phone').value = s.contact_phone;
                     document.getElementById('modal-title').textContent = 'Edit Supplier';
                     modal.style.display = 'flex';
                 }
             }
             if (e.target.classList.contains('btn-delete')) {
                 if(confirm('Delete Supplier?')) {
                     await api('DELETE', `/api/admin/suppliers/${id}`);
                     loadSuppliers(searchInput.value);
                 }
             }
        });

        loadSuppliers();
    }

    // --- ADMIN ORDERS ---
    if (page.endsWith('/admin-orders.html')) {
        const tableBody = document.getElementById('orders-table-body');
        const searchInput = document.getElementById('order-search');
        const invoiceModal = document.getElementById('invoice-modal');

        if (document.getElementById('close-invoice-modal')) {
            document.getElementById('close-invoice-modal').addEventListener('click', () => invoiceModal.style.display = 'none');
        }

        const loadOrders = (search = '') => {
            api('GET', `/api/admin/orders?search=${search}`).then(data => {
                tableBody.innerHTML = '';
                if (!data) return;

                // SORTING: Newest Orders First
                data.sort((a, b) => new Date(b.order_date) - new Date(a.order_date));

                data.forEach(o => {
                    // Check status carefully. Assuming backend uses "Pending Payment"
                    const canCancel = o.status === 'Pending Payment'; 
                    const actions = canCancel 
                        ? `<button class="btn-delete btn-cancel" data-id="${o.order_id}">Cancel</button>
                           <button class="btn-edit btn-view" data-id="${o.order_id}">Details</button>`
                        : `<button class="btn-edit btn-view" data-id="${o.order_id}">Details</button>`;

                    tableBody.innerHTML += `
                        <tr>
                            <td>${o.order_id}</td>
                            <td>${o.customer_name}</td>
                            <td>${new Date(o.order_date).toLocaleDateString()}</td>
                            <td>$${parseFloat(o.total_amount).toFixed(2)}</td>
                            <td>${o.status}</td>
                            <td>${actions}</td>
                        </tr>`;
                });
            });
        };

        searchInput.addEventListener('input', debounce((e) => loadOrders(e.target.value), 300));

        tableBody.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            if (e.target.classList.contains('btn-cancel')) {
                if (confirm(`Cancel Order #${id}?`)) {
                    await api('PUT', `/api/admin/orders/${id}/cancel`);
                    loadOrders(searchInput.value);
                }
            }
            if (e.target.classList.contains('btn-view')) {
                const data = await api('GET', `/api/admin/orders/${id}`);
                const { order, items } = data;
                
                document.getElementById('invoice-order-id').textContent = order.order_id;
                document.getElementById('invoice-customer-name').textContent = order.customer_name;
                document.getElementById('invoice-order-date').textContent = new Date(order.order_date).toLocaleDateString();
                document.getElementById('invoice-order-status').textContent = order.status;
                document.getElementById('invoice-grand-total').textContent = `$${parseFloat(order.total_amount).toFixed(2)}`;
                
                const itemsBody = document.getElementById('invoice-items-body');
                itemsBody.innerHTML = '';
                items.forEach(item => {
                    itemsBody.innerHTML += `
                        <tr>
                            <td>${item.product_name_snapshot}</td>
                            <td>$${parseFloat(item.price_snapshot).toFixed(2)}</td>
                            <td>${item.quantity}</td>
                            <td>$${(item.price_snapshot * item.quantity).toFixed(2)}</td>
                        </tr>`;
                });
                invoiceModal.style.display = 'flex';
            }
        });
        loadOrders();
    }

    // --- ADMIN PROFILE ---
    if (page.endsWith('/admin-profile.html')) {
        const msg = (id, txt, success) => {
            const el = document.getElementById(id);
            el.textContent = txt;
            el.style.color = success ? 'green' : 'red';
            setTimeout(() => el.textContent = '', 3000);
        };

        api('GET', '/api/admin/profile').then(u => {
            if(u) {
                document.getElementById('profile-username').value = u.username;
                document.getElementById('profile-email').value = u.email;
                document.getElementById('profile-phone').value = u.phone || '';
            }
        });

        document.getElementById('profile-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const res = await api('PUT', '/api/admin/profile', {
                    email: document.getElementById('profile-email').value,
                    phone: document.getElementById('profile-phone').value
                });
                msg('profile-message', res.message, true);
            } catch(e) { msg('profile-message', e.message, false); }
        });

        document.getElementById('password-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            if (newPassword !== confirmPassword) return msg('password-message', 'Passwords do not match', false);
            
            try {
                const res = await api('PUT', '/api/admin/change-password', { currentPassword, newPassword });
                msg('password-message', res.message, true);
                e.target.reset();
            } catch(err) { msg('password-message', err.message, false); }
        });
    }

    // --- LOGOUT ---
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.clear();
            window.location.href = '/login.html';
        });
    }
});