const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const rentalService = require('../services/rentalService');

const router = Router();

// All rental routes require authentication.
router.use(authenticate);

/**
 * POST /rentals
 * Body: { itemName }
 *
 * Start a new rental session.
 */
router.post('/', (req, res) => {
  const { itemName } = req.body;
  try {
    const rental = rentalService.startRental(req.user.id, itemName);
    res.status(201).json(rental);
  } catch (err) {
    if (err.name === 'RentalError') {
      return res.status(err.statusCode).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /rentals/open
 *
 * List all currently open rental sessions for the authenticated user.
 */
router.get('/open', (req, res) => {
  const rentals = rentalService.getOpen(req.user.id);
  res.json({ rentals });
});

/**
 * GET /rentals/previous
 *
 * List all closed (previous) rental sessions for the authenticated user.
 */
router.get('/previous', (req, res) => {
  const rentals = rentalService.getPrevious(req.user.id);
  res.json({ rentals });
});

/**
 * GET /rentals
 *
 * List all rental sessions (open and closed) for the authenticated user.
 */
router.get('/', (req, res) => {
  const rentals = rentalService.getAll(req.user.id);
  res.json({ rentals });
});

/**
 * GET /rentals/:id
 *
 * Get a single rental session by ID.
 */
router.get('/:id', (req, res) => {
  try {
    const rental = rentalService.getById(req.user.id, req.params.id);
    res.json(rental);
  } catch (err) {
    if (err.name === 'RentalError') {
      return res.status(err.statusCode).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /rentals/:id/close
 *
 * Close (end) an open rental session.
 */
router.post('/:id/close', (req, res) => {
  try {
    const rental = rentalService.endRental(req.user.id, req.params.id);
    res.json(rental);
  } catch (err) {
    if (err.name === 'RentalError') {
      return res.status(err.statusCode).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
