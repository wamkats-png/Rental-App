/**
 * In-memory rental session store.
 *
 * Each rental session tracks:
 *   - id        : unique rental session identifier
 *   - userId    : the user who initiated the rental
 *   - itemName  : name/description of the rented item
 *   - startedAt : timestamp when the rental began
 *   - endedAt   : timestamp when the rental was closed (null while open)
 *   - status    : "open" | "closed"
 */

const rentals = new Map(); // id -> record

let counter = 0;

function generateId() {
  counter += 1;
  return `rental_${Date.now()}_${counter}`;
}

function create({ userId, itemName }) {
  const id = generateId();
  const record = {
    id,
    userId,
    itemName,
    startedAt: new Date().toISOString(),
    endedAt: null,
    status: 'open',
  };
  rentals.set(id, record);
  return { ...record };
}

function findById(id) {
  const record = rentals.get(id);
  return record ? { ...record } : null;
}

function close(id) {
  const record = rentals.get(id);
  if (!record) return null;
  if (record.status === 'closed') return { ...record };

  record.endedAt = new Date().toISOString();
  record.status = 'closed';
  return { ...record };
}

function findOpenByUser(userId) {
  const results = [];
  for (const record of rentals.values()) {
    if (record.userId === userId && record.status === 'open') {
      results.push({ ...record });
    }
  }
  return results.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
}

function findClosedByUser(userId) {
  const results = [];
  for (const record of rentals.values()) {
    if (record.userId === userId && record.status === 'closed') {
      results.push({ ...record });
    }
  }
  return results.sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt));
}

function findAllByUser(userId) {
  const results = [];
  for (const record of rentals.values()) {
    if (record.userId === userId) {
      results.push({ ...record });
    }
  }
  return results.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
}

module.exports = {
  create,
  findById,
  close,
  findOpenByUser,
  findClosedByUser,
  findAllByUser,
};
