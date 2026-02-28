/**
 * In-memory refresh-token store.
 *
 * Each record tracks:
 *   - tokenId    : unique id of this specific refresh token
 *   - familyId   : shared across every token in the same rotation chain
 *   - userId     : owner of the token
 *   - revoked    : whether the token has been consumed or invalidated
 *   - createdAt  : timestamp
 *
 * Token rotation flow:
 *   1. On login a new token family is created (familyId === first tokenId).
 *   2. On refresh the old token is revoked and a new token is issued in the
 *      same family.
 *   3. If a revoked token is reused (replay attack), the entire family is
 *      revoked to force re-authentication.
 */

const tokens = new Map(); // tokenId -> record

function store(record) {
  tokens.set(record.tokenId, { ...record, createdAt: Date.now() });
}

function find(tokenId) {
  return tokens.get(tokenId) || null;
}

function revoke(tokenId) {
  const record = tokens.get(tokenId);
  if (record) record.revoked = true;
}

function revokeFamily(familyId) {
  for (const record of tokens.values()) {
    if (record.familyId === familyId) {
      record.revoked = true;
    }
  }
}

function revokeAllForUser(userId) {
  for (const record of tokens.values()) {
    if (record.userId === userId) {
      record.revoked = true;
    }
  }
}

function activeFamilyCountForUser(userId) {
  const activeFamilies = new Set();
  for (const record of tokens.values()) {
    if (record.userId === userId && !record.revoked) {
      activeFamilies.add(record.familyId);
    }
  }
  return activeFamilies.size;
}

function oldestActiveFamilyForUser(userId) {
  let oldest = null;
  for (const record of tokens.values()) {
    if (record.userId === userId && !record.revoked) {
      if (!oldest || record.createdAt < oldest.createdAt) {
        oldest = record;
      }
    }
  }
  return oldest ? oldest.familyId : null;
}

module.exports = {
  store,
  find,
  revoke,
  revokeFamily,
  revokeAllForUser,
  activeFamilyCountForUser,
  oldestActiveFamilyForUser,
};
