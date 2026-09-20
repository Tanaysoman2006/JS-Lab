const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Paths to JSON data files
const productsFilePath = path.join(__dirname, 'data', 'products.json');
const ordersFilePath = path.join(__dirname, 'data', 'orders.json');

// Helper to read JSON data safely
function readJSON(filePath, defaultValue = []) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8');
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return defaultValue;
  }
}

// Helper to write JSON data safely
function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
    return false;
  }
}

// Initialize orders file if not present
if (!fs.existsSync(ordersFilePath)) {
  writeJSON(ordersFilePath, []);
}

// --- REST API ROUTES ---

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 2. Get categories with product count
app.get('/api/categories', (req, res) => {
  const products = readJSON(productsFilePath);
  const counts = {};
  products.forEach(p => {
    counts[p.category] = (counts[p.category] || 0) + 1;
  });

  const categories = [
    { name: 'All', count: products.length },
    ...Object.keys(counts).map(cat => ({ name: cat, count: counts[cat] }))
  ];

  res.json(categories);
});

// 3. Get Products with filtering, search, and sorting
app.get('/api/products', (req, res) => {
  let products = readJSON(productsFilePath);
  const { category, search, minPrice, maxPrice, sort } = req.query;

  // Filter by category
  if (category && category.toLowerCase() !== 'all') {
    products = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }

  // Filter by search query
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    products = products.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.features && p.features.some(f => f.toLowerCase().includes(q)))
    );
  }

  // Filter by price range
  if (minPrice) {
    const min = parseFloat(minPrice);
    if (!isNaN(min)) products = products.filter(p => p.price >= min);
  }
  if (maxPrice) {
    const max = parseFloat(maxPrice);
    if (!isNaN(max)) products = products.filter(p => p.price <= max);
  }

  // Sort products
  if (sort) {
    switch (sort) {
      case 'price-asc':
        products.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        products.sort((a, b) => b.price - a.price);
        break;
      case 'rating-desc':
        products.sort((a, b) => b.rating - a.rating);
        break;
      case 'popular':
        products.sort((a, b) => b.reviewsCount - a.reviewsCount);
        break;
      default:
        break;
    }
  }

  res.json(products);
});

// 4. Get single product by ID
app.get('/api/products/:id', (req, res) => {
  const products = readJSON(productsFilePath);
  const product = products.find(p => p.id === req.params.id);

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  res.json(product);
});

// 5. Create new order (Checkout)
app.post('/api/orders', (req, res) => {
  const { items, customer, discountCode } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one item' });
  }

  if (!customer || !customer.fullName || !customer.email || !customer.address || !customer.city || !customer.zip) {
    return res.status(400).json({ error: 'Incomplete shipping details' });
  }

  const allProducts = readJSON(productsFilePath);
  let subtotal = 0;
  const verifiedItems = [];

  for (const item of items) {
    const prod = allProducts.find(p => p.id === item.id);
    if (!prod) {
      return res.status(400).json({ error: `Product ${item.id} does not exist` });
    }
    const qty = Math.max(1, parseInt(item.quantity) || 1);
    const itemTotal = prod.price * qty;
    subtotal += itemTotal;

    verifiedItems.push({
      id: prod.id,
      title: prod.title,
      price: prod.price,
      quantity: qty,
      image: prod.image,
      total: parseFloat(itemTotal.toFixed(2))
    });
  }

  // Discount calculation
  let discountPercent = 0;
  let appliedPromo = null;
  if (discountCode) {
    const code = discountCode.trim().toUpperCase();
    if (code === 'SAVE20') {
      discountPercent = 0.20;
      appliedPromo = 'SAVE20 (20% OFF)';
    } else if (code === 'WELCOME10') {
      discountPercent = 0.10;
      appliedPromo = 'WELCOME10 (10% OFF)';
    }
  }

  const discountAmount = parseFloat((subtotal * discountPercent).toFixed(2));
  const discountedSubtotal = subtotal - discountAmount;
  const shipping = discountedSubtotal > 100 ? 0 : 9.99;
  const tax = parseFloat((discountedSubtotal * 0.08).toFixed(2)); // 8% tax
  const total = parseFloat((discountedSubtotal + shipping + tax).toFixed(2));

  const newOrder = {
    id: 'ORD-' + Math.floor(100000 + Math.random() * 900000),
    createdAt: new Date().toISOString(),
    status: 'Confirmed',
    items: verifiedItems,
    customer: {
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone || 'N/A',
      address: customer.address,
      city: customer.city,
      zip: customer.zip,
      paymentMethod: customer.paymentMethod || 'Credit Card'
    },
    pricing: {
      subtotal: parseFloat(subtotal.toFixed(2)),
      discountCode: appliedPromo,
      discountAmount,
      shipping,
      tax,
      total
    },
    estimatedDelivery: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  };

  const orders = readJSON(ordersFilePath);
  orders.unshift(newOrder);
  writeJSON(ordersFilePath, orders);

  res.status(201).json({
    success: true,
    message: 'Order created successfully!',
    order: newOrder
  });
});

// 6. Get orders or track order
app.get('/api/orders', (req, res) => {
  const orders = readJSON(ordersFilePath);
  res.json(orders.slice(0, 10)); // return last 10
});

app.get('/api/orders/:id', (req, res) => {
  const orders = readJSON(ordersFilePath);
  const order = orders.find(o => o.id.toLowerCase() === req.params.id.toLowerCase());
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});

// Fallback to index.html for SPA-like navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start listening
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 Nexus E-Commerce Server Running!`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`📦 Node Version: ${process.version}`);
  console.log(`=========================================`);
});
