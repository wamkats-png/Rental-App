const jwt = require('jsonwebtoken');
const config = require('../config/auth');
const userStore = require('../models/userStore');

/**
 * Express middleware that validates the access token from the
 * Authorization header and attaches the authenticated user to `req.user`.
 *
 * Token rotation is handled at the /auth/refresh endpoint — this middleware
 * only validates short-lived access tokens so that each request is
 * stateless and fast.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = header.slice(7);

  let payload;
  try {
    payload = jwt.verify(token, config.accessToken.secret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Access token expired',
        code: 'TOKEN_EXPIRED',
      });
    }
    return res.status(401).json({ error: 'Invalid access token' });
  }

  const user = userStore.findById(payload.sub);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  req.user = user;
  next();
}

module.exports = { authenticate };
