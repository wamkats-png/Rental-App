const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/auth');
const tokenStore = require('../models/tokenStore');

/**
 * Issue a short-lived access token.
 */
function issueAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    config.accessToken.secret,
    { expiresIn: config.accessToken.expiresIn },
  );
}

/**
 * Issue a refresh token and persist it in the store.
 *
 * @param {object} user        - { id, email }
 * @param {string} [familyId]  - reuse an existing family (for rotation) or
 *                                omit to start a new family (login).
 */
function issueRefreshToken(user, familyId) {
  const tokenId = uuidv4();
  const family = familyId || tokenId; // new family on first issue

  tokenStore.store({
    tokenId,
    familyId: family,
    userId: user.id,
    revoked: false,
  });

  // Prune oldest families when the user exceeds the limit.
  while (
    tokenStore.activeFamilyCountForUser(user.id) >
    config.maxTokenFamiliesPerUser
  ) {
    const oldest = tokenStore.oldestActiveFamilyForUser(user.id);
    if (oldest) tokenStore.revokeFamily(oldest);
    else break;
  }

  return jwt.sign(
    { sub: user.id, jti: tokenId, fam: family },
    config.refreshToken.secret,
    { expiresIn: config.refreshToken.expiresIn },
  );
}

/**
 * Rotate a refresh token.
 *
 * This is the core of token rotation:
 *   1. Decode the incoming refresh token.
 *   2. Look up the stored record.
 *   3. If the token was already revoked the entire family is compromised —
 *      revoke every token in the family and reject.
 *   4. Otherwise, revoke the current token and issue a new one in the same
 *      family.
 *
 * Returns { accessToken, refreshToken } or throws.
 */
function rotateRefreshToken(refreshTokenJwt) {
  let payload;
  try {
    payload = jwt.verify(refreshTokenJwt, config.refreshToken.secret);
  } catch {
    throw new TokenRotationError('Invalid or expired refresh token');
  }

  const record = tokenStore.find(payload.jti);
  if (!record) {
    throw new TokenRotationError('Unknown refresh token');
  }

  // Replay detection — a revoked token is being reused.
  if (record.revoked) {
    tokenStore.revokeFamily(record.familyId);
    throw new TokenRotationError(
      'Refresh token reuse detected — all sessions in this family have been revoked',
    );
  }

  // Revoke the current token so it can't be used again.
  tokenStore.revoke(record.tokenId);

  const user = { id: record.userId, email: payload.email };

  return {
    accessToken: issueAccessToken(user),
    refreshToken: issueRefreshToken(user, record.familyId),
  };
}

/**
 * Revoke a single refresh token (e.g. on logout).
 */
function revokeRefreshToken(refreshTokenJwt) {
  let payload;
  try {
    payload = jwt.verify(refreshTokenJwt, config.refreshToken.secret, {
      ignoreExpiration: true,
    });
  } catch {
    return; // malformed — nothing to revoke
  }
  tokenStore.revoke(payload.jti);
}

/**
 * Revoke every refresh token for a user (e.g. password change).
 */
function revokeAllForUser(userId) {
  tokenStore.revokeAllForUser(userId);
}

class TokenRotationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TokenRotationError';
  }
}

module.exports = {
  issueAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
  TokenRotationError,
};
