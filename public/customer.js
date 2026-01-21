document.addEventListener('DOMContentLoaded', () => {
    // --- 1. GLOBAL SETUP & AUTH CHECK ---
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    // Security: Redirect if not logged in
    if (!token && !window.location.pathname.endsWith('login.html')) {
        window.location.href = '/login.html';
        return;
    }

    // Security: Redirect if user is an Admin trying to access Customer pages
    if (user && user.role === 'admin') {
        window.location.href = '/admin-dashboard.html';
        return;
    }

    // --- 2. API HELPER ---
    const api = async (method, url, body = null) => {
        const headers = { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        const options = { method, headers };
        if (body) options.body = JSON.stringify(body);

        try {
            const response = await fetch(url, options);
            if (response.status === 401 || response.status === 403) {
                localStorage.clear();
                window.location.href = '/login.html';
                return null;
            }
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Server Error');
            return data;
        } catch (err) {
            console.error(err);
            alert(err.message);
            throw err;
        }
    };

    // --- 3. PAGE ROUTING ---
    const page = window.location.pathname;

    // --- LOGOUT LOGIC ---
    const logoutBtn = document.getElementById('logout-btn');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.clear();
            window.location.href = '/login.html';
        });
    }

    // ============================================
    // PAGE: CUSTOMER SHOP (customer-shop.html)
    // ============================================
    if (page.endsWith('/customer-shop.html')) {
        const productGrid = document.getElementById('product-grid');
        const searchInput = document.getElementById('shop-search');
        const categorySelect = document.getElementById('shop-category');

        const loadProducts = async (search = '', category = '') => {
            try {
                let url = `/api/customer/products?search=${search}`;
                if(category) url += `&category=${category}`;
                
                const products = await api('GET', url);
                productGrid.innerHTML = '';
                
                if(!products || products.length === 0) {
                    productGrid.innerHTML = '<p>No products found.</p>';
                    return;
                }

                products.forEach(p => {
                    // Disable button if out of stock
                    const disabled = p.stock <= 0 ? 'disabled' : '';
                    const btnText = p.stock <= 0 ? 'Out of Stock' : 'Add to Cart';
                    const btnClass = p.stock <= 0 ? 'btn-disabled' : 'btn-add';

                    productGrid.innerHTML += `
                        <div class="product-card">
                            <h3>${p.product_name}</h3>
                            <p class="category">${p.category_name}</p>
                            <p class="price">$${parseFloat(p.selling_price).toFixed(2)}</p>
                            <p class="stock">Stock: ${p.stock}</p>
                            <button class="${btnClass}" data-id="${p.product_id}" ${disabled}>
                                ${btnText}
                            </button>
                        </div>
                    `;
                });
            } catch (error) { console.error("Load Products Error", error); }
        };

        // Load Categories for filter
        const loadCategories = async () => {
            const cats = await api('GET', '/api/customer/categories');
            if(cats) {
                categorySelect.innerHTML = '<option value="">All Categories</option>';
                cats.forEach(c => {
                    categorySelect.innerHTML += `<option value="${c.category_id}">${c.category_name}</option>`;
                });
            }
        };

        // Event Listeners
        productGrid.addEventListener('click', async (e) => {
            if (e.target.classList.contains('btn-add')) {
                const productId = e.target.dataset.id;
                try {
                    await api('POST', '/api/customer/cart', { product_id: productId, quantity: 1 });
                    alert('Added to cart!');
                } catch (err) { /* Error handled in api helper */ }
            }
        });

        searchInput.addEventListener('input', (e) => loadProducts(e.target.value, categorySelect.value));
        categorySelect.addEventListener('change', (e) => loadProducts(searchInput.value, e.target.value));

        loadCategories();
        loadProducts();
    }

    // ============================================
    // PAGE: CART (cart.html)
    // ============================================
    if (page.endsWith('/cart.html')) {
        const cartTable = document.getElementById('cart-table-body');
        const cartTotal = document.getElementById('cart-total');
        const checkoutBtn = document.getElementById('checkout-btn');

        const loadCart = async () => {
            const items = await api('GET', '/api/customer/cart');
            cartTable.innerHTML = '';
            let total = 0;

            if(!items || items.length === 0) {
                cartTable.innerHTML = '<tr><td colspan="5">Your cart is empty</td></tr>';
                cartTotal.textContent = '$0.00';
                checkoutBtn.disabled = true;
                return;
            }

            checkoutBtn.disabled = false;
            items.forEach(item => {
                const itemTotal = item.price * item.quantity;
                total += itemTotal;
                cartTable.innerHTML += `
                    <tr>
                        <td>${item.product_name}</td>
                        <td>$${parseFloat(item.price).toFixed(2)}</td>
                        <td>
                            <input type="number" class="qty-input" min="1" data-id="${item.id}" value="${item.quantity}">
                        </td>
                        <td>$${itemTotal.toFixed(2)}</td>
                        <td><button class="btn-remove" data-id="${item.id}">Remove</button></td>
                    </tr>
                `;
            });
            cartTotal.textContent = `$${total.toFixed(2)}`;
        };

        // Handle Quantity Updates and Removes
        cartTable.addEventListener('change', async (e) => {
            if (e.target.classList.contains('qty-input')) {
                const id = e.target.dataset.id;
                const qty = parseInt(e.target.value);
                if (qty > 0) {
                    await api('PUT', `/api/customer/cart/${id}`, { quantity: qty });
                    loadCart();
                }
            }
        });

        cartTable.addEventListener('click', async (e) => {
            if (e.target.classList.contains('btn-remove')) {
                if(confirm('Remove item?')) {
                    await api('DELETE', `/api/customer/cart/${e.target.dataset.id}`);
                    loadCart();
                }
            }
        });

        checkoutBtn.addEventListener('click', async () => {
            if(confirm('Confirm Purchase?')) {
                try {
                    await api('POST', '/api/customer/checkout');
                    alert('Order Placed Successfully!');
                    window.location.href = 'customer-my-orders.html';
                } catch(err) { /* Handled */ }
            }
        });

        loadCart();
    }

    // ============================================
    // PAGE: MY ORDERS (customer-my-orders.html)
    // ============================================
    if (page.endsWith('/customer-my-orders.html')) {
        const ordersList = document.getElementById('orders-list');

        const loadOrders = async () => {
            const orders = await api('GET', '/api/customer/orders');
            ordersList.innerHTML = '';

            if(!orders || orders.length === 0) {
                ordersList.innerHTML = '<p>No past orders.</p>';
                return;
            }

            orders.forEach(o => {
                const date = new Date(o.order_date).toLocaleDateString();
                // If status is pending, show cancel button
                const cancelBtn = o.status === 'Pending Payment' || o.status === 'Processing' 
                    ? `<button class="btn-cancel" data-id="${o.order_id}">Cancel Order</button>` 
                    : '';
                
                ordersList.innerHTML += `
                    <div class="order-card">
                        <div class="order-header">
                            <h3>Order #${o.order_id}</h3>
                            <span class="status ${o.status.toLowerCase().replace(' ', '-')}">${o.status}</span>
                        </div>
                        <p><strong>Date:</strong> ${date}</p>
                        <p><strong>Total:</strong> $${parseFloat(o.total_amount).toFixed(2)}</p>
                        ${cancelBtn}
                    </div>
                `;
            });
        };

        ordersList.addEventListener('click', async (e) => {
            if(e.target.classList.contains('btn-cancel')) {
                if(confirm('Are you sure you want to cancel this order?')) {
                    await api('PUT', `/api/customer/orders/${e.target.dataset.id}/cancel`);
                    loadOrders();
                }
            }
        });

        loadOrders();
    }

    // ============================================
    // PAGE: PROFILE (customer-profile.html)
    // ============================================
    if (page.endsWith('/customer-profile.html')) {
        const profileForm = document.getElementById('profile-form');
        const passwordForm = document.getElementById('password-form');
        const message = document.getElementById('profile-message');

        // Load User Info
        api('GET', '/api/customer/profile').then(u => {
            document.getElementById('first-name').value = u.first_name;
            document.getElementById('last-name').value = u.last_name;
            document.getElementById('email').value = u.email;
        });

        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const data = {
                    first_name: document.getElementById('first-name').value,
                    last_name: document.getElementById('last-name').value,
                    email: document.getElementById('email').value
                };
                await api('PUT', '/api/customer/profile', data);
                message.textContent = 'Profile updated successfully!';
                message.style.color = 'green';
            } catch(err) {
                message.textContent = 'Update failed.';
                message.style.color = 'red';
            }
        });

        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;

            try {
                await api('PUT', '/api/customer/change-password', { currentPassword, newPassword });
                alert('Password changed!');
                passwordForm.reset();
            } catch(err) { /* Handled */ }
        });
    }
});