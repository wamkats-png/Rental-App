const bcrypt = require('bcryptjs');

// In-memory user store — swap for a real database in production.
const users = new Map();

async function createUser(email, password) {
  if (users.has(email)) {
    throw new Error('User already exists');
  }
  const hash = await bcrypt.hash(password, 10);
  const user = { id: `user_${Date.now()}`, email, passwordHash: hash };
  users.set(email, user);
  return { id: user.id, email: user.email };
}

async function verifyCredentials(email, password) {
  const user = users.get(email);
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  return valid ? { id: user.id, email: user.email } : null;
}

function findById(id) {
  for (const user of users.values()) {
    if (user.id === id) return { id: user.id, email: user.email };
  }
  return null;
}

module.exports = { createUser, verifyCredentials, findById };
