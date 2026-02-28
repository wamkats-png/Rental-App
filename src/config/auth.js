const config = {
  accessToken: {
    secret: process.env.ACCESS_TOKEN_SECRET || 'access-token-secret-change-in-production',
    expiresIn: '15m',
  },
  refreshToken: {
    secret: process.env.REFRESH_TOKEN_SECRET || 'refresh-token-secret-change-in-production',
    expiresIn: '7d',
  },
  // Maximum number of active refresh token families per user.
  // Older families are pruned when this limit is exceeded.
  maxTokenFamiliesPerUser: 5,
};

module.exports = config;
