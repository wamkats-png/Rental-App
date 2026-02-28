const { Router } = require('express');
const userStore = require('../models/userStore');
const tokenService = require('../services/tokenService');
const { authenticate } = require('../middleware/auth');

const router = Router();

/**
 * POST /auth/register
 * Body: { email, password }
 */
router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await userStore.createUser(email, password);
    const accessToken = tokenService.issueAccessToken(user);
    const refreshToken = tokenService.issueRefreshToken(user);

    res.status(201).json({ user, accessToken, refreshToken });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

/**
 * POST /auth/login
 * Body: { email, password }
 *
 * Returns a fresh access + refresh token pair (new token family).
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await userStore.verifyCredentials(email, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const accessToken = tokenService.issueAccessToken(user);
  const refreshToken = tokenService.issueRefreshToken(user);

  res.json({ user, accessToken, refreshToken });
});

/**
 * POST /auth/refresh
 * Body: { refreshToken }
 *
 * Rotates the refresh token: the old token is revoked and a new
 * access + refresh token pair is returned in the same family.
 *
 * If the incoming refresh token was already revoked (replay attack),
 * the entire token family is invalidated.
 */
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  try {
    const tokens = tokenService.rotateRefreshToken(refreshToken);
    res.json(tokens);
  } catch (err) {
    if (err instanceof tokenService.TokenRotationError) {
      return res.status(401).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/logout
 * Body: { refreshToken }
 *
 * Revokes the given refresh token so it cannot be used again.
 */
router.post('/logout', (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    tokenService.revokeRefreshToken(refreshToken);
  }
  res.json({ message: 'Logged out' });
});

/**
 * POST /auth/logout-all
 * Requires a valid access token.
 *
 * Revokes every refresh token for the authenticated user, effectively
 * signing them out of all devices.
 */
router.post('/logout-all', authenticate, (req, res) => {
  tokenService.revokeAllForUser(req.user.id);
  res.json({ message: 'All sessions revoked' });
});

module.exports = router;
