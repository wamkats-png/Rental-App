const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { parseRentalInput } = require('../services/aiInputService');
const rentalService = require('../services/rentalService');

const router = Router();

// Requires authentication but NO paywall — free for all users.
router.use(authenticate);

/**
 * POST /ai-input
 * Body: { text: "I want to rent a bicycle and a helmet" }
 *
 * Parses natural language into structured rental(s) and creates them.
 * Returns the parsed items and created rental sessions.
 *
 * Free for all authenticated users — no premium tier required.
 */
router.post('/', (req, res) => {
  const { text } = req.body;

  let parsed;
  try {
    parsed = parseRentalInput(text);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const created = [];
  const errors = [];

  for (const itemName of parsed.items) {
    try {
      const rental = rentalService.startRental(req.user.id, itemName);
      created.push(rental);
    } catch (err) {
      errors.push({ itemName, error: err.message });
    }
  }

  res.status(201).json({
    parsed: parsed.items,
    rentals: created,
    ...(errors.length > 0 && { errors }),
  });
});

/**
 * POST /ai-input/parse
 *
 * Parse-only mode — returns the extracted items without creating rentals.
 * Useful for previewing what the AI understood before committing.
 */
router.post('/parse', (req, res) => {
  const { text } = req.body;

  try {
    const parsed = parseRentalInput(text);
    res.json({ parsed: parsed.items });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
