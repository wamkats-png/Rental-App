const express = require('express');
const authRoutes = require('./routes/auth');
const rentalRoutes = require('./routes/rentals');
const aiInputRoutes = require('./routes/aiInput');
const contractRoutes = require('./routes/contracts');
const { authenticate } = require('./middleware/auth');

const app = express();

app.use(express.json());

// --- Public routes ---
app.use('/auth', authRoutes);

// --- Protected routes (require valid access token) ---
app.use('/rentals', rentalRoutes);
app.use('/ai-input', aiInputRoutes);    // Free AI input — no paywall
app.use('/contracts', contractRoutes); // Contract parsing & generation

app.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Rental-App listening on port ${PORT}`);
});

module.exports = app;
