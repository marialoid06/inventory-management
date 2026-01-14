// public/customer.js
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
        api('GET', '/api/customer/profile/basic').then(user => {
            if (user && user.username) {
                welcomeMessageEl.textContent = `Welcome, ${user.username}!`;
            }
        }).catch(err => console.error("Error fetching user name", err));
    }

    // --- 1. Security Check & Global Helpers ---
    if (!token && !window.location.pathname.endsWith('login.html') && !window.location.pathname.endsWith('register.html') && !window.location.pathname.endsWith('forgot-password.html') && !window.location.pathname.endsWith('reset-password.html')) {
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

    // --- 2. Cart Helper Functions (REPLACED) ---
    const updateCartCount = async () => {
        try {
            const cart = await api('GET', '/api/customer/cart');
            if (!cart) return;
            const count = cart.reduce((total, item) => total + item.quantity, 0);
            const cartLink = document.getElementById('cart-link');
            if (cartLink) {
                cartLink.textContent = `My Cart (${count})`;
            }
        } catch (error) {
            console.error("Error updating cart count:", error);
            const cartLink = document.getElementById('cart-link');
            if (cartLink) cartLink.textContent = 'My Cart (0)';
        }
    };

    // --- 3. Page-Specific Logic ---
    const page = window.location.pathname;
    setupPasswordToggles();
    updateCartCount();

    // --- CUSTOMER SHOP ---
    if (page.endsWith('/customer-shop.html')) {
        const tableBody = document.getElementById('shop-products-body');
        const searchInput = document.getElementById('product-search');

        const loadProducts = (search = '') => {
            api('GET', `/api/customer/products?search=${search}`).then(products => {
                if (!products) return;
                tableBody.innerHTML = '';
                if (products.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="4">No products found.</td></tr>';
                }
                products.forEach(p => {
                    tableBody.innerHTML += `
                        <tr>
                            <td>${p.product_name}</td>
                            <td>$${p.selling_price}</td>
                            <td>${p.stock}</td>
                            <td>
                                <button class="btn btn-add-cart" 
                                    data-id="${p.product_id}" 
                                    data-name="${p.product_name}">
                                    Add to Cart
                                </button>
                            </td>
                        </tr>
                    `;
                });

                tableBody.querySelectorAll('.btn-add-cart').forEach(button => {
                    button.addEventListener('click', async (e) => {
                        const product_id = e.target.dataset.id;
                        const product_name = e.target.dataset.name;
                        try {
                            await api('POST', '/api/customer/cart', { product_id: product_id, quantity: 1 });
                            alert(`${product_name} added to cart!`);
                            updateCartCount();
                        } catch (error) {
                            alert(`Error adding to cart: ${error.message}`);
                        }
                    });
                });
            }).catch(err => console.error(err));
        };
        
        searchInput.addEventListener('input', (e) => loadProducts(e.target.value));
        loadProducts();
    }

    // --- CUSTOMER CART PAGE ---
    if (page.endsWith('/cart.html')) {
        const tableBody = document.getElementById('cart-table-body');
        const grandTotalEl = document.getElementById('cart-grand-total');
        const goToPaymentBtn = document.getElementById('go-to-payment-btn');
        const paymentModal = document.getElementById('payment-modal');
        const closeModalBtn = document.getElementById('close-modal');
        const paymentForm = document.getElementById('payment-form');
        const checkoutBtn = document.getElementById('checkout-btn');

        const loadCartPage = async () => {
            try {
                const cart = await api('GET', '/api/customer/cart');
                tableBody.innerHTML = '';
                let grandTotal = 0;

                if (!cart || cart.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="5">Your cart is empty.</td></tr>';
                    grandTotalEl.textContent = '$0.00';
                    goToPaymentBtn.disabled = true;
                    return;
                }

                cart.forEach(item => {
                    const itemTotal = parseFloat(item.selling_price) * item.quantity;
                    grandTotal += itemTotal;
                    tableBody.innerHTML += `
                        <tr>
                            <td>${item.product_name}</td>
                            <td>$${parseFloat(item.selling_price).toFixed(2)}</td>
                            <td>
                                <input type="number" class="cart-quantity-input" data-id="${item.product_id}" value="${item.quantity}" min="1" style="width: 60px;">
                            </td>
                            <td>$${itemTotal.toFixed(2)}</td>
                            <td><button class="btn-delete" data-id="${item.product_id}">Remove</button></td>
                        </tr>
                    `;
                });
                grandTotalEl.textContent = `$${grandTotal.toFixed(2)}`;
                goToPaymentBtn.disabled = false;
            } catch (error) {
                console.error("Error loading cart page:", error);
                tableBody.innerHTML = '<tr><td colspan="5">Error loading cart.</td></tr>';
            }
        };

        tableBody.addEventListener('click', async (e) => {
            if (e.target.classList.contains('btn-delete')) {
                const product_id = e.target.dataset.id;
                try {
                    await api('DELETE', `/api/customer/cart/${product_id}`);
                    loadCartPage();
                    updateCartCount();
                } catch(err) { alert(`Error: ${err.message}`); }
            }
        });
        
        tableBody.addEventListener('change', async (e) => {
            if (e.target.classList.contains('cart-quantity-input')) {
                const product_id = e.target.dataset.id;
                const newQuantity = parseInt(e.target.value);
                
                if (newQuantity <= 0) {
                    try {
                        await api('DELETE', `/api/customer/cart/${product_id}`);
                        loadCartPage();
                        updateCartCount();
                    } catch(err) { alert(`Error: ${err.message}`); }
                    return;
                }
                
                try {
                    await api('PUT', `/api/customer/cart/${product_id}`, { quantity: newQuantity });
                    loadCartPage();
                    updateCartCount();
                } catch (err) { alert(`Error: ${err.message}`); }
            }
        });
        
        goToPaymentBtn.addEventListener('click', () => {
            paymentModal.style.display = 'flex';
        });
        closeModalBtn.addEventListener('click', () => {
            paymentModal.style.display = 'none';
        });
        
        paymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                checkoutBtn.disabled = true;
                checkoutBtn.textContent = 'Placing Order...';
                
                const result = await api('POST', '/api/customer/create-order', {}); 
                
                showMessage('modal-message', result.message, true);
                updateCartCount();
                setTimeout(() => {
                    paymentModal.style.display = 'none';
                    window.location.href = '/customer-my-orders.html';
                }, 2000);

            } catch(err) {
                showMessage('modal-message', err.message, false);
                checkoutBtn.disabled = false;
                checkoutBtn.textContent = 'Place Order (Pay)';
            }
        });

        loadCartPage();
    }


    // --- CUSTOMER ORDERS ---
    if (page.endsWith('/customer-my-orders.html')) {
        const tableBody = document.getElementById('my-orders-body');
        
        // *** NEW: Get modal elements ***
        const invoiceModal = document.getElementById('invoice-modal');
        const closeInvoiceModal = document.getElementById('close-invoice-modal');
        
        if (closeInvoiceModal) {
            closeInvoiceModal.addEventListener('click', () => {
                invoiceModal.style.display = 'none';
            });
        }
        
        const loadOrders = () => {
            api('GET', '/api/customer/my-orders').then(orders => {
                if (!orders) return;
                tableBody.innerHTML = '';
                if (orders.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="5">You have not placed any orders.</td></tr>';
                    return;
                }
                orders.forEach(o => {
                    const total = parseFloat(o.total_amount || 0);
                    let actions = '';
                    
                    // *** NEW: Updated Actions Logic ***
                    if (o.status === 'Pending Payment') {
                        actions = `
                            <button class="btn btn-pay" data-id="${o.order_id}">Pay Now</button>
                            <button class="btn-delete btn-cancel-order" data-id="${o.order_id}">Cancel</button>
                        `;
                    } else if (o.status === 'Paid') {
                        actions = `<button class="btn-edit btn-view-details" data-id="${o.order_id}">View Details</button>`;
                    } else {
                        actions = `<em>${o.status}</em>`;
                    }
                    
                    tableBody.innerHTML += `
                        <tr>
                            <td>${o.order_id}</td>
                            <td>${new Date(o.order_date).toLocaleDateString()}</td>
                            <td>$${total.toFixed(2)}</td>
                            <td>${o.status}</td>
                            <td>${actions}</td>
                        </tr>
                    `;
                });
            }).catch(err => console.error(err));
        };
        
        tableBody.addEventListener('click', async (e) => {
            const orderId = e.target.dataset.id;
            if (e.target.classList.contains('btn-pay')) {
                try {
                    await api('PUT', `/api/customer/orders/${orderId}/pay`);
                    loadOrders(); // Refresh list
                } catch (err) {
                    alert(`Error: ${err.message}`);
                }
            }
            if (e.target.classList.contains('btn-cancel-order')) {
                if (confirm('Are you sure you want to cancel this order?')) {
                    try {
                        await api('PUT', `/api/customer/orders/${orderId}/cancel`);
                        loadOrders(); // Refresh list
                    } catch (err) {
                        alert(`Error: ${err.message}`);
                    }
                }
            }
            
            // *** NEW: Handle View Details click ***
            if (e.target.classList.contains('btn-view-details')) {
                try {
                    const data = await api('GET', `/api/customer/orders/${orderId}`);
                    const { order, items } = data;
                    
                    // Populate modal
                    document.getElementById('invoice-order-id').textContent = order.order_id;
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
        
        loadOrders();
    }
    
    // --- CUSTOMER PROFILE ---
    if (page.endsWith('/customer-profile.html')) {
        api('GET', '/api/customer/profile').then(user => {
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
                const result = await api('PUT', '/api/customer/profile', data);
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
                const result = await api('PUT', '/api/customer/change-password', data);
                showMessage('password-message', result.message, true);
                e.target.reset();
            } catch(err) { showMessage('password-message', err.message, false); }
        });
    }
});