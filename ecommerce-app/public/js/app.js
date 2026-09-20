/**
 * NEXUS E-COMMERCE CLIENT APPLICATION
 * Features: REST API integration, Cart management, Filtering & Search,
 * Modals (Quick View, Checkout, Receipt, Orders), Toast alerts, Theme toggle.
 */

class NexusStore {
  constructor() {
    this.products = [];
    this.categories = [];
    this.cart = JSON.parse(localStorage.getItem('nexus_cart') || '[]');
    this.wishlist = new Set(JSON.parse(localStorage.getItem('nexus_wishlist') || '[]'));
    
    // Filter & Search states
    this.activeCategory = 'All';
    this.searchQuery = '';
    this.maxPrice = 700;
    this.sortBy = 'featured';

    // Promo code state
    this.appliedPromo = null;
    this.discountRate = 0;

    // Active product for quick view
    this.currentQvProduct = null;

    // Theme state
    this.theme = localStorage.getItem('nexus_theme') || 'dark';

    this.init();
  }

  async init() {
    this.applyTheme(this.theme);
    this.setupEventListeners();
    await this.fetchCategories();
    await this.fetchProducts();
    this.updateCartUI();
    this.updateWishlistUI();
  }

  // --- THEME SWITCHING ---
  applyTheme(theme) {
    this.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nexus_theme', theme);
  }

  toggleTheme() {
    const nextTheme = this.theme === 'dark' ? 'light' : 'dark';
    this.applyTheme(nextTheme);
    this.showToast(`Switched to ${nextTheme === 'dark' ? 'Dark' : 'Light'} Mode`, 'info');
  }

  // --- API INTEGRATIONS ---
  async fetchCategories() {
    try {
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error('Failed to load categories');
      this.categories = await res.json();
      this.renderCategoryTabs();
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }

  async fetchProducts() {
    const grid = document.getElementById('products-grid');
    grid.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading curated hardware...</p>
      </div>
    `;

    try {
      const params = new URLSearchParams();
      if (this.activeCategory && this.activeCategory !== 'All') {
        params.append('category', this.activeCategory);
      }
      if (this.searchQuery) {
        params.append('search', this.searchQuery);
      }
      if (this.maxPrice) {
        params.append('maxPrice', this.maxPrice);
      }
      if (this.sortBy) {
        params.append('sort', this.sortBy);
      }

      const res = await fetch(`/api/products?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch products');
      this.products = await res.json();

      this.renderProducts();
      this.renderActiveFilterChips();
    } catch (err) {
      console.error('Error fetching products:', err);
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3>Failed to connect to server</h3>
          <p>Please make sure the Node.js Express server is running on port 3000.</p>
          <button class="btn btn-primary" onclick="window.NexusApp.fetchProducts()">Retry</button>
        </div>
      `;
    }
  }

  // --- RENDERING ---
  renderCategoryTabs() {
    const container = document.getElementById('category-tabs');
    if (!container) return;

    container.innerHTML = this.categories.map(cat => `
      <button class="cat-pill ${this.activeCategory.toLowerCase() === cat.name.toLowerCase() ? 'active' : ''}" 
              data-category="${cat.name}">
        ${cat.name} (${cat.count})
      </button>
    `).join('');
  }

  renderProducts() {
    const grid = document.getElementById('products-grid');
    const emptyState = document.getElementById('empty-state');

    if (!this.products || this.products.length === 0) {
      grid.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    grid.innerHTML = this.products.map(p => {
      const isWishlisted = this.wishlist.has(p.id);
      return `
        <article class="product-card" data-id="${p.id}">
          <div class="product-media-wrap">
            <img src="${p.image}" alt="${p.title}" class="product-thumb" loading="lazy">
            ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}
            <button class="product-wishlist-btn ${isWishlisted ? 'active' : ''}" data-wishlist-id="${p.id}" aria-label="Save to Wishlist" title="Save to Wishlist">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${isWishlisted ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
            <button class="product-quick-btn" data-quick-id="${p.id}">Quick View</button>
          </div>

          <div class="product-info">
            <div class="product-header-row">
              <span class="product-cat">${p.category}</span>
              <div class="product-rating">★ ${p.rating}</div>
            </div>

            <h3 class="product-title" title="${p.title}">${p.title}</h3>
            <p class="product-desc-snippet">${p.description}</p>

            <div class="product-footer-row">
              <div class="product-pricing">
                <span class="product-current-price">$${p.price.toFixed(2)}</span>
                ${p.originalPrice ? `<span class="product-original-price">$${p.originalPrice.toFixed(2)}</span>` : ''}
              </div>

              <button class="btn-add-cart" data-add-cart-id="${p.id}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12h14"></path>
                </svg>
                <span>Add</span>
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  renderActiveFilterChips() {
    const bar = document.getElementById('active-filters-bar');
    const container = document.getElementById('active-filter-chips');
    const chips = [];

    if (this.activeCategory !== 'All') {
      chips.push({ type: 'cat', label: `Category: ${this.activeCategory}` });
    }
    if (this.searchQuery) {
      chips.push({ type: 'search', label: `Search: "${this.searchQuery}"` });
    }
    if (this.maxPrice < 700) {
      chips.push({ type: 'price', label: `Max Price: $${this.maxPrice}` });
    }
    if (this.sortBy !== 'featured') {
      const sortLabels = {
        'price-asc': 'Price: Low to High',
        'price-desc': 'Price: High to Low',
        'rating-desc': 'Highest Rated',
        'popular': 'Most Popular'
      };
      chips.push({ type: 'sort', label: sortLabels[this.sortBy] || this.sortBy });
    }

    if (chips.length > 0) {
      bar.classList.remove('hidden');
      container.innerHTML = chips.map(c => `
        <span class="filter-chip">
          <span>${c.label}</span>
          <span style="cursor: pointer; font-weight: bold;" data-remove-chip="${c.type}">&times;</span>
        </span>
      `).join('');
    } else {
      bar.classList.add('hidden');
    }
  }

  // --- CART MANAGEMENT ---
  addToCart(productId, quantity = 1) {
    const product = this.products.find(p => p.id === productId) || 
      (this.currentQvProduct && this.currentQvProduct.id === productId ? this.currentQvProduct : null);

    if (!product) return;

    const existingIndex = this.cart.findIndex(item => item.id === productId);
    if (existingIndex > -1) {
      this.cart[existingIndex].quantity += quantity;
    } else {
      this.cart.push({
        id: product.id,
        title: product.title,
        price: product.price,
        image: product.image,
        quantity: quantity
      });
    }

    this.saveCart();
    this.updateCartUI();
    this.showToast(`Added "${product.title}" to cart!`, 'success');
  }

  updateQuantity(productId, delta) {
    const index = this.cart.findIndex(i => i.id === productId);
    if (index > -1) {
      this.cart[index].quantity += delta;
      if (this.cart[index].quantity <= 0) {
        this.cart.splice(index, 1);
        this.showToast('Item removed from cart', 'info');
      }
      this.saveCart();
      this.updateCartUI();
    }
  }

  removeFromCart(productId) {
    this.cart = this.cart.filter(i => i.id !== productId);
    this.saveCart();
    this.updateCartUI();
    this.showToast('Item removed from cart', 'info');
  }

  saveCart() {
    localStorage.setItem('nexus_cart', JSON.stringify(this.cart));
  }

  calculateCartTotals() {
    const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discount = subtotal * this.discountRate;
    const discountedSubtotal = subtotal - discount;
    const shipping = subtotal === 0 ? 0 : (discountedSubtotal > 100 ? 0 : 9.99);
    const tax = discountedSubtotal * 0.08;
    const grandTotal = discountedSubtotal + shipping + tax;
    const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);

    return {
      subtotal,
      discount,
      shipping,
      tax,
      grandTotal,
      totalItems
    };
  }

  updateCartUI() {
    const totals = this.calculateCartTotals();

    // Badges in navbar
    const badge = document.getElementById('cart-badge');
    const btnTotal = document.getElementById('cart-btn-total');
    if (badge) badge.innerText = totals.totalItems;
    if (btnTotal) btnTotal.innerText = `$${totals.grandTotal.toFixed(2)}`;

    // Drawer Header count
    const drawerCount = document.getElementById('drawer-cart-count');
    if (drawerCount) drawerCount.innerText = totals.totalItems;

    // Free Shipping progress
    const freeShippingTarget = 100;
    const progressFill = document.getElementById('shipping-progress-fill');
    const shippingMsg = document.getElementById('shipping-tracker-msg');

    if (totals.subtotal >= freeShippingTarget) {
      if (progressFill) progressFill.style.width = '100%';
      if (shippingMsg) shippingMsg.innerHTML = '🎉 You have qualified for <strong>FREE Shipping!</strong>';
    } else {
      const remaining = freeShippingTarget - totals.subtotal;
      const percent = Math.min(100, Math.max(0, (totals.subtotal / freeShippingTarget) * 100));
      if (progressFill) progressFill.style.width = `${percent}%`;
      if (shippingMsg) shippingMsg.innerText = `Add $${remaining.toFixed(2)} more for FREE Shipping!`;
    }

    // Drawer Items rendering
    const itemsList = document.getElementById('drawer-items');
    if (!itemsList) return;

    if (this.cart.length === 0) {
      itemsList.innerHTML = `
        <div class="cart-empty-message">
          <div class="cart-empty-art">🛍️</div>
          <h4>Your cart is empty</h4>
          <p>Explore our trending catalog and add items you love.</p>
          <button class="btn btn-secondary btn-sm" id="cart-empty-shop-btn">Browse Products</button>
        </div>
      `;
      document.getElementById('drawer-footer').classList.add('hidden');
    } else {
      document.getElementById('drawer-footer').classList.remove('hidden');
      itemsList.innerHTML = this.cart.map(item => `
        <div class="cart-item-card">
          <img src="${item.image}" alt="${item.title}" class="cart-item-img">
          <div class="cart-item-info">
            <h4 class="cart-item-title">${item.title}</h4>
            <div class="cart-item-price">$${(item.price * item.quantity).toFixed(2)}</div>
            <div class="cart-item-controls">
              <div class="cart-qty-ctrls">
                <button data-qty-minus="${item.id}">-</button>
                <span class="cart-qty-val">${item.quantity}</span>
                <button data-qty-plus="${item.id}">+</button>
              </div>
              <button class="cart-remove-btn" data-remove-id="${item.id}" title="Remove item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `).join('');
    }

    // Drawer Totals
    document.getElementById('drawer-subtotal').innerText = `$${totals.subtotal.toFixed(2)}`;
    
    const discountRow = document.getElementById('drawer-discount-row');
    if (this.discountRate > 0) {
      discountRow.classList.remove('hidden');
      document.getElementById('drawer-discount-label').innerText = `${Math.round(this.discountRate * 100)}%`;
      document.getElementById('drawer-discount-amount').innerText = `-$${totals.discount.toFixed(2)}`;
    } else {
      discountRow.classList.add('hidden');
    }

    document.getElementById('drawer-shipping').innerText = totals.shipping === 0 ? 'FREE' : `$${totals.shipping.toFixed(2)}`;
    document.getElementById('drawer-tax').innerText = `$${totals.tax.toFixed(2)}`;
    document.getElementById('drawer-grand-total').innerText = `$${totals.grandTotal.toFixed(2)}`;
  }

  // --- WISHLIST MANAGEMENT ---
  toggleWishlist(productId) {
    if (this.wishlist.has(productId)) {
      this.wishlist.delete(productId);
      this.showToast('Removed from Wishlist', 'info');
    } else {
      this.wishlist.add(productId);
      this.showToast('Saved to Wishlist!', 'success');
    }

    localStorage.setItem('nexus_wishlist', JSON.stringify(Array.from(this.wishlist)));
    this.updateWishlistUI();
    this.renderProducts();
  }

  updateWishlistUI() {
    const badge = document.getElementById('wishlist-badge');
    if (!badge) return;
    const count = this.wishlist.size;
    if (count > 0) {
      badge.classList.remove('hidden');
      badge.innerText = count;
    } else {
      badge.classList.add('hidden');
    }
  }

  // --- QUICK VIEW MODAL ---
  openQuickView(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    this.currentQvProduct = product;
    document.getElementById('qv-image').src = product.image;
    document.getElementById('qv-image').alt = product.title;
    document.getElementById('qv-badge').innerText = product.badge || 'Featured';
    document.getElementById('qv-category').innerText = product.category;
    document.getElementById('qv-rating-text').innerText = product.rating;
    document.getElementById('qv-reviews').innerText = `(${product.reviewsCount} verified reviews)`;
    document.getElementById('qv-title').innerText = product.title;
    document.getElementById('qv-price').innerText = `$${product.price.toFixed(2)}`;

    const origPriceEl = document.getElementById('qv-original-price');
    const savingsEl = document.getElementById('qv-savings');
    if (product.originalPrice) {
      origPriceEl.innerText = `$${product.originalPrice.toFixed(2)}`;
      origPriceEl.classList.remove('hidden');
      const saved = product.originalPrice - product.price;
      savingsEl.innerText = `Save $${saved.toFixed(2)}`;
      savingsEl.classList.remove('hidden');
    } else {
      origPriceEl.classList.add('hidden');
      savingsEl.classList.add('hidden');
    }

    document.getElementById('qv-desc').innerText = product.description;
    
    // Features
    const featuresList = document.getElementById('qv-features-list');
    if (product.features && product.features.length) {
      featuresList.innerHTML = product.features.map(f => `<li>${f}</li>`).join('');
    } else {
      featuresList.innerHTML = `<li>Full manufacturer warranty</li><li>Fast express delivery</li>`;
    }

    document.getElementById('qv-qty-input').value = 1;

    // Wishlist heart
    const qvWishlistBtn = document.getElementById('qv-wishlist-toggle');
    if (this.wishlist.has(product.id)) {
      qvWishlistBtn.style.color = 'var(--accent-secondary)';
    } else {
      qvWishlistBtn.style.color = 'inherit';
    }

    document.getElementById('quick-view-modal').classList.remove('hidden');
  }

  closeQuickView() {
    document.getElementById('quick-view-modal').classList.add('hidden');
    this.currentQvProduct = null;
  }

  // --- CHECKOUT & ORDER FLOW ---
  openCheckout() {
    if (this.cart.length === 0) {
      this.showToast('Your cart is empty! Add items first.', 'info');
      return;
    }

    this.closeCartDrawer();
    this.setCheckoutStep(1);
    this.updateCheckoutSummary();
    document.getElementById('checkout-modal').classList.remove('hidden');
  }

  closeCheckout() {
    document.getElementById('checkout-modal').classList.add('hidden');
  }

  setCheckoutStep(step) {
    const step1 = document.getElementById('checkout-step-1');
    const step2 = document.getElementById('checkout-step-2');
    const ind1 = document.getElementById('step-ind-1');
    const ind2 = document.getElementById('step-ind-2');
    const ind3 = document.getElementById('step-ind-3');

    if (step === 1) {
      step1.classList.remove('hidden');
      step2.classList.add('hidden');
      ind1.classList.add('active');
      ind2.classList.remove('active');
      ind3.classList.remove('active');
    } else if (step === 2) {
      step1.classList.add('hidden');
      step2.classList.remove('hidden');
      ind1.classList.add('active');
      ind2.classList.add('active');
      ind3.classList.remove('active');
    }
  }

  updateCheckoutSummary() {
    const totals = this.calculateCartTotals();
    document.getElementById('chk-summary-subtotal').innerText = `$${totals.subtotal.toFixed(2)}`;

    const discountRow = document.getElementById('chk-summary-discount-row');
    if (this.discountRate > 0) {
      discountRow.classList.remove('hidden');
      document.getElementById('chk-summary-discount').innerText = `-$${totals.discount.toFixed(2)}`;
    } else {
      discountRow.classList.add('hidden');
    }

    const shipTax = totals.shipping + totals.tax;
    document.getElementById('chk-summary-ship-tax').innerText = `$${shipTax.toFixed(2)}`;
    document.getElementById('chk-summary-total').innerText = `$${totals.grandTotal.toFixed(2)}`;
  }

  async submitOrder(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('place-order-submit-btn');
    const btnText = document.getElementById('place-order-btn-text');
    const spinner = document.getElementById('place-order-spinner');

    submitBtn.disabled = true;
    btnText.innerText = 'Processing Order...';
    spinner.classList.remove('hidden');

    const customer = {
      fullName: document.getElementById('cust-fullname').value,
      email: document.getElementById('cust-email').value,
      phone: document.getElementById('cust-phone').value,
      address: document.getElementById('cust-address').value,
      city: document.getElementById('cust-city').value,
      zip: document.getElementById('cust-zip').value,
      paymentMethod: document.querySelector('input[name="paymentMethod"]:checked')?.value || 'Credit Card'
    };

    const orderPayload = {
      items: this.cart.map(item => ({ id: item.id, quantity: item.quantity })),
      customer: customer,
      discountCode: this.appliedPromo
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');

      // Success
      this.closeCheckout();
      this.cart = [];
      this.saveCart();
      this.appliedPromo = null;
      this.discountRate = 0;
      this.updateCartUI();

      this.openOrderSuccessModal(data.order);
      this.showToast('Order confirmed successfully!', 'success');
    } catch (err) {
      console.error('Order submission error:', err);
      this.showToast(`Error: ${err.message}`, 'error');
    } finally {
      submitBtn.disabled = false;
      btnText.innerText = 'Pay & Confirm Order';
      spinner.classList.add('hidden');
    }
  }

  openOrderSuccessModal(order) {
    document.getElementById('receipt-order-id').innerText = order.id;
    document.getElementById('receipt-delivery-date').innerText = order.estimatedDelivery;

    const itemsContainer = document.getElementById('receipt-items-list');
    itemsContainer.innerHTML = order.items.map(item => `
      <div class="receipt-item-row">
        <span>${item.title} × ${item.quantity}</span>
        <strong>$${item.total.toFixed(2)}</strong>
      </div>
    `).join('');

    const totalsContainer = document.getElementById('receipt-totals-box');
    totalsContainer.innerHTML = `
      <div class="price-row"><span>Subtotal:</span><span>$${order.pricing.subtotal.toFixed(2)}</span></div>
      ${order.pricing.discountAmount > 0 ? `<div class="price-row discount-row"><span>Discount (${order.pricing.discountCode}):</span><span>-$${order.pricing.discountAmount.toFixed(2)}</span></div>` : ''}
      <div class="price-row"><span>Shipping:</span><span>${order.pricing.shipping === 0 ? 'FREE' : `$${order.pricing.shipping.toFixed(2)}`}</span></div>
      <div class="price-row"><span>Tax (8%):</span><span>$${order.pricing.tax.toFixed(2)}</span></div>
      <div class="price-row grand-total"><span>Total Paid:</span><span>$${order.pricing.total.toFixed(2)}</span></div>
    `;

    document.getElementById('order-success-modal').classList.remove('hidden');
  }

  // --- ORDER HISTORY MODAL ---
  async openOrdersHistory() {
    const modal = document.getElementById('orders-history-modal');
    const container = document.getElementById('orders-history-list');
    modal.classList.remove('hidden');

    container.innerHTML = '<p class="loading-state">Fetching your orders from the server...</p>';

    try {
      const res = await fetch('/api/orders');
      if (!res.ok) throw new Error('Could not fetch orders');
      const orders = await res.json();

      if (orders.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📦</div>
            <h3>No orders yet</h3>
            <p>You haven't completed any orders yet. Start shopping our flagship tech!</p>
          </div>
        `;
        return;
      }

      container.innerHTML = orders.map(ord => `
        <div class="order-history-item">
          <div class="order-history-top">
            <div>
              <strong>${ord.id}</strong>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${new Date(ord.createdAt).toLocaleString()}</div>
            </div>
            <span class="order-status-badge">${ord.status}</span>
          </div>
          <div style="font-size: 0.85rem;">
            ${ord.items.map(i => `${i.title} (${i.quantity}x)`).join(', ')}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 8px;">
            <span style="font-size: 0.8rem; color: var(--text-secondary);">Paid with ${ord.customer.paymentMethod}</span>
            <strong style="color: var(--accent-primary);">$${ord.pricing.total.toFixed(2)}</strong>
          </div>
        </div>
      `).join('');
    } catch (err) {
      container.innerHTML = `<p style="color: var(--danger); text-align: center;">Error loading orders: ${err.message}</p>`;
    }
  }

  // --- DRAWER OPEN/CLOSE ---
  openCartDrawer() {
    document.getElementById('cart-drawer').classList.add('open');
    document.getElementById('cart-drawer-backdrop').classList.remove('hidden');
  }

  closeCartDrawer() {
    document.getElementById('cart-drawer').classList.remove('open');
    document.getElementById('cart-drawer-backdrop').classList.add('hidden');
  }

  // --- PROMO COUPON ---
  applyCoupon(code) {
    const feedback = document.getElementById('coupon-feedback');
    const cleanCode = code.trim().toUpperCase();

    if (cleanCode === 'SAVE20') {
      this.discountRate = 0.20;
      this.appliedPromo = 'SAVE20';
      feedback.className = 'coupon-feedback success';
      feedback.innerText = '✓ Promo SAVE20 applied! 20% discount granted.';
      this.showToast('Coupon applied: 20% OFF!', 'success');
    } else if (cleanCode === 'WELCOME10') {
      this.discountRate = 0.10;
      this.appliedPromo = 'WELCOME10';
      feedback.className = 'coupon-feedback success';
      feedback.innerText = '✓ Promo WELCOME10 applied! 10% discount granted.';
      this.showToast('Coupon applied: 10% OFF!', 'success');
    } else {
      feedback.className = 'coupon-feedback error';
      feedback.innerText = 'Invalid coupon code. Try "SAVE20"';
      this.showToast('Invalid promo code', 'error');
    }
    feedback.classList.remove('hidden');
    this.updateCartUI();
  }

  // --- TOAST NOTIFICATIONS ---
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '✕';

    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  // --- EVENT LISTENERS ---
  setupEventListeners() {
    // Theme toggle
    document.getElementById('theme-toggle-btn')?.addEventListener('click', () => this.toggleTheme());

    // Cart Drawer triggers
    document.getElementById('cart-btn')?.addEventListener('click', () => this.openCartDrawer());
    document.getElementById('cart-drawer-close')?.addEventListener('click', () => this.closeCartDrawer());
    document.getElementById('cart-drawer-backdrop')?.addEventListener('click', () => this.closeCartDrawer());

    // Search Box
    const searchInput = document.getElementById('global-search-input');
    const clearBtn = document.getElementById('search-clear-btn');

    let debounceTimer;
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim();
      clearBtn?.classList.toggle('hidden', !this.searchQuery);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => this.fetchProducts(), 250);
    });

    clearBtn?.addEventListener('click', () => {
      searchInput.value = '';
      this.searchQuery = '';
      clearBtn.classList.add('hidden');
      this.fetchProducts();
    });

    // Keyboard shortcut '/' to search
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput?.focus();
      }
      if (e.key === 'Escape') {
        this.closeQuickView();
        this.closeCartDrawer();
        this.closeCheckout();
        document.getElementById('order-success-modal')?.classList.add('hidden');
        document.getElementById('orders-history-modal')?.classList.add('hidden');
      }
    });

    // Category Filter Clicks (delegated)
    document.getElementById('category-tabs')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.cat-pill');
      if (!btn) return;
      this.activeCategory = btn.dataset.category;
      this.renderCategoryTabs();
      this.fetchProducts();
    });

    // Price range slider
    const priceSlider = document.getElementById('price-range');
    const priceIndicator = document.getElementById('price-value');
    priceSlider?.addEventListener('input', (e) => {
      this.maxPrice = parseInt(e.target.value);
      if (priceIndicator) priceIndicator.innerText = `$${this.maxPrice}`;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => this.fetchProducts(), 200);
    });

    // Sort Selector
    document.getElementById('sort-select')?.addEventListener('change', (e) => {
      this.sortBy = e.target.value;
      this.fetchProducts();
    });

    // Delegated clicks on Products Grid
    document.getElementById('products-grid')?.addEventListener('click', (e) => {
      const addBtn = e.target.closest('[data-add-cart-id]');
      if (addBtn) {
        const id = addBtn.dataset.addCartId;
        this.addToCart(id, 1);
        return;
      }

      const quickBtn = e.target.closest('[data-quick-id]');
      if (quickBtn) {
        const id = quickBtn.dataset.quickId;
        this.openQuickView(id);
        return;
      }

      const wishBtn = e.target.closest('[data-wishlist-id]');
      if (wishBtn) {
        const id = wishBtn.dataset.wishlistId;
        this.toggleWishlist(id);
        return;
      }
    });

    // Delegated clicks in Cart Drawer
    document.getElementById('drawer-items')?.addEventListener('click', (e) => {
      const plus = e.target.closest('[data-qty-plus]');
      if (plus) {
        this.updateQuantity(plus.dataset.qtyPlus, 1);
        return;
      }
      const minus = e.target.closest('[data-qty-minus]');
      if (minus) {
        this.updateQuantity(minus.dataset.qtyMinus, -1);
        return;
      }
      const remove = e.target.closest('[data-remove-id]');
      if (remove) {
        this.removeFromCart(remove.dataset.removeId);
        return;
      }
      const shopBtn = e.target.closest('#cart-empty-shop-btn');
      if (shopBtn) {
        this.closeCartDrawer();
        document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    });

    // Coupon Apply Button
    document.getElementById('apply-coupon-btn')?.addEventListener('click', () => {
      const input = document.getElementById('coupon-input');
      if (input && input.value) {
        this.applyCoupon(input.value);
      }
    });

    // Quick View Actions
    document.getElementById('quick-view-close')?.addEventListener('click', () => this.closeQuickView());
    document.getElementById('qv-qty-plus')?.addEventListener('click', () => {
      const input = document.getElementById('qv-qty-input');
      input.value = parseInt(input.value) + 1;
    });
    document.getElementById('qv-qty-minus')?.addEventListener('click', () => {
      const input = document.getElementById('qv-qty-input');
      if (parseInt(input.value) > 1) {
        input.value = parseInt(input.value) - 1;
      }
    });
    document.getElementById('qv-add-to-cart-btn')?.addEventListener('click', () => {
      if (this.currentQvProduct) {
        const qty = parseInt(document.getElementById('qv-qty-input').value) || 1;
        this.addToCart(this.currentQvProduct.id, qty);
        this.closeQuickView();
        this.openCartDrawer();
      }
    });
    document.getElementById('qv-wishlist-toggle')?.addEventListener('click', () => {
      if (this.currentQvProduct) {
        this.toggleWishlist(this.currentQvProduct.id);
        const qvWishlistBtn = document.getElementById('qv-wishlist-toggle');
        qvWishlistBtn.style.color = this.wishlist.has(this.currentQvProduct.id) ? 'var(--accent-secondary)' : 'inherit';
      }
    });

    // Checkout flow actions
    document.getElementById('checkout-trigger-btn')?.addEventListener('click', () => this.openCheckout());
    document.getElementById('checkout-close')?.addEventListener('click', () => this.closeCheckout());
    document.getElementById('checkout-back-to-cart')?.addEventListener('click', () => {
      this.closeCheckout();
      this.openCartDrawer();
    });
    document.getElementById('goto-payment-btn')?.addEventListener('click', () => {
      const form = document.getElementById('checkout-form');
      if (!document.getElementById('cust-fullname').value || 
          !document.getElementById('cust-email').value || 
          !document.getElementById('cust-address').value || 
          !document.getElementById('cust-city').value || 
          !document.getElementById('cust-zip').value) {
        this.showToast('Please fill all required shipping fields', 'error');
        return;
      }
      this.setCheckoutStep(2);
      this.updateCheckoutSummary();
    });
    document.getElementById('back-to-shipping-btn')?.addEventListener('click', () => this.setCheckoutStep(1));
    document.getElementById('checkout-form')?.addEventListener('submit', (e) => this.submitOrder(e));

    // Order Success Modal actions
    document.getElementById('continue-shopping-btn')?.addEventListener('click', () => {
      document.getElementById('order-success-modal').classList.add('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.getElementById('print-receipt-btn')?.addEventListener('click', () => window.print());

    // Orders History
    document.getElementById('order-history-btn')?.addEventListener('click', () => this.openOrdersHistory());
    document.getElementById('footer-track-orders-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openOrdersHistory();
    });
    document.getElementById('orders-modal-close')?.addEventListener('click', () => {
      document.getElementById('orders-history-modal').classList.add('hidden');
    });

    // Hero Spotlight Quick Add
    document.getElementById('hero-quick-add-btn')?.addEventListener('click', () => {
      this.addToCart('prod-1', 1);
      this.openCartDrawer();
    });

    // Promo banner copy
    document.getElementById('copy-promo-banner')?.addEventListener('click', () => {
      navigator.clipboard?.writeText('SAVE20');
      this.showToast('Coupon "SAVE20" copied to clipboard!', 'success');
      const input = document.getElementById('coupon-input');
      if (input) input.value = 'SAVE20';
    });
    document.getElementById('promo-hero-btn')?.addEventListener('click', () => {
      this.applyCoupon('SAVE20');
      this.openCartDrawer();
    });

    // Reset filters
    document.getElementById('empty-reset-btn')?.addEventListener('click', () => this.resetFilters());
    document.getElementById('clear-all-filters-btn')?.addEventListener('click', () => this.resetFilters());

    // Active filter chip remove
    document.getElementById('active-filter-chips')?.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-remove-chip]');
      if (!chip) return;
      const type = chip.dataset.removeChip;
      if (type === 'cat') this.activeCategory = 'All';
      if (type === 'search') {
        this.searchQuery = '';
        const inp = document.getElementById('global-search-input');
        if (inp) inp.value = '';
        document.getElementById('search-clear-btn')?.classList.add('hidden');
      }
      if (type === 'price') {
        this.maxPrice = 700;
        const sl = document.getElementById('price-range');
        if (sl) sl.value = 700;
        const ind = document.getElementById('price-value');
        if (ind) ind.innerText = '$700';
      }
      if (type === 'sort') {
        this.sortBy = 'featured';
        const sel = document.getElementById('sort-select');
        if (sel) sel.value = 'featured';
      }
      this.renderCategoryTabs();
      this.fetchProducts();
    });

    // Wishlist navigation
    document.getElementById('wishlist-btn')?.addEventListener('click', () => {
      if (this.wishlist.size === 0) {
        this.showToast('Your wishlist is empty. Tap the heart icon on any product to save it!', 'info');
      } else {
        this.showToast(`You have ${this.wishlist.size} item(s) saved in your Wishlist!`, 'info');
      }
    });

    // Footer category links
    document.querySelectorAll('.footer-cat-link').forEach(link => {
      link.addEventListener('click', (e) => {
        const cat = link.dataset.cat;
        if (cat) {
          this.activeCategory = cat;
          this.renderCategoryTabs();
          this.fetchProducts();
        }
      });
    });
  }

  resetFilters() {
    this.activeCategory = 'All';
    this.searchQuery = '';
    this.maxPrice = 700;
    this.sortBy = 'featured';

    const sInput = document.getElementById('global-search-input');
    if (sInput) sInput.value = '';
    document.getElementById('search-clear-btn')?.classList.add('hidden');

    const pSlider = document.getElementById('price-range');
    if (pSlider) pSlider.value = 700;
    const pVal = document.getElementById('price-value');
    if (pVal) pVal.innerText = '$700';

    const sSelect = document.getElementById('sort-select');
    if (sSelect) sSelect.value = 'featured';

    this.renderCategoryTabs();
    this.fetchProducts();
  }
}

// Instantiate and expose globally
document.addEventListener('DOMContentLoaded', () => {
  window.NexusApp = new NexusStore();
});
