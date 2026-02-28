const jwt = require('jsonwebtoken');
const config = require('../config/auth');
const userStore = require('../models/userStore');
const tokenService = require('../services/tokenService');

/**
 * Authentication middleware with transparent token rotation.
 *
 * Happy path — access token is valid:
 *   Verifies the Bearer token, attaches `req.user`, calls next().
 *
 * Rotation path — access token is expired:
 *   Looks for a refresh token in (priority order):
 *     1. X-Refresh-Token request header
 *     2. refreshToken cookie
 *   If found, rotates the refresh token:
 *     - On success: attaches the user to req.user, continues the request,
 *       and sets X-New-Access-Token + X-New-Refresh-Token response headers
 *       so the client can silently update its stored tokens.
 *     - On failure (reuse / expired / unknown): responds 401.
 *   If no refresh token is present: responds 401 with code TOKEN_EXPIRED,
 *   signalling the client to redirect to /auth/refresh explicitly.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const accessToken = header.slice(7);

  // --- Validate the access token ---
  let payload;
  try {
    payload = jwt.verify(accessToken, config.accessToken.secret);
  } catch (err) {
    if (err.name !== 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid access token' });
    }

    // Access token is expired — attempt silent rotation.
    return attemptRotation(req, res, next);
  }

  // Access token is valid.
  const user = userStore.findById(payload.sub);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  req.user = user;
  next();
}

/**
 * Read the refresh token from the request.
 * Accepts X-Refresh-Token header or a refreshToken cookie.
 */
function extractRefreshToken(req) {
  if (req.headers['x-refresh-token']) {
    return req.headers['x-refresh-token'];
  }

  // Minimal cookie parsing without cookie-parser dependency.
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)refreshToken=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }

  return null;
}

/**
 * Attempt to silently rotate the refresh token and continue the request.
 * On success the new token pair is written to response headers.
 */
function attemptRotation(req, res, next) {
  const refreshToken = extractRefreshToken(req);

  if (!refreshToken) {
    return res.status(401).json({
      error: 'Access token expired',
      code: 'TOKEN_EXPIRED',
    });
  }

  let tokens;
  try {
    tokens = tokenService.rotateRefreshToken(refreshToken);
  } catch (err) {
    if (err instanceof tokenService.TokenRotationError) {
      return res.status(401).json({ error: err.message, code: 'TOKEN_ROTATION_FAILED' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }

  // Decode the newly issued access token to get the user id.
  const newPayload = jwt.decode(tokens.accessToken);
  const user = userStore.findById(newPayload.sub);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  // Surface the new token pair to the client via response headers.
  res.setHeader('X-New-Access-Token', tokens.accessToken);
  res.setHeader('X-New-Refresh-Token', tokens.refreshToken);

  req.user = user;
  // Signal to the handler that rotation happened (useful for logging/auditing).
  req.tokenRotated = true;
  next();
}

module.exports = { authenticate };
