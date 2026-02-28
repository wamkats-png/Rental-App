/**
 * Rentflow — rental session lifecycle service.
 *
 * Manages the flow of a rental from start to finish:
 *   startRental  → creates a new open session
 *   endRental    → closes an open session
 *   getOpen      → returns all currently open sessions for a user
 *   getPrevious  → returns all closed (previous) sessions for a user
 *   getAll       → returns every session for a user
 *   getById      → returns a single session by id
 */

const rentalStore = require('../models/rentalStore');

class RentalError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'RentalError';
    this.statusCode = statusCode;
  }
}

function startRental(userId, itemName) {
  if (!itemName || typeof itemName !== 'string' || !itemName.trim()) {
    throw new RentalError('itemName is required');
  }
  return rentalStore.create({ userId, itemName: itemName.trim() });
}

function endRental(userId, rentalId) {
  const rental = rentalStore.findById(rentalId);
  if (!rental) {
    throw new RentalError('Rental session not found', 404);
  }
  if (rental.userId !== userId) {
    throw new RentalError('Not authorized to close this rental', 403);
  }
  if (rental.status === 'closed') {
    throw new RentalError('Rental session is already closed');
  }
  return rentalStore.close(rentalId);
}

function getOpen(userId) {
  return rentalStore.findOpenByUser(userId);
}

function getPrevious(userId) {
  return rentalStore.findClosedByUser(userId);
}

function getAll(userId) {
  return rentalStore.findAllByUser(userId);
}

function getById(userId, rentalId) {
  const rental = rentalStore.findById(rentalId);
  if (!rental) {
    throw new RentalError('Rental session not found', 404);
  }
  if (rental.userId !== userId) {
    throw new RentalError('Not authorized to view this rental', 403);
  }
  return rental;
}

module.exports = {
  startRental,
  endRental,
  getOpen,
  getPrevious,
  getAll,
  getById,
  RentalError,
};
