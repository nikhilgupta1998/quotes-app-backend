const rateLimit = require("express-rate-limit");

const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Different rate limits for different endpoints
const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // limit each IP to 5 requests per windowMs
  "Too many authentication attempts, please try again later"
);

const generalLimiter = createRateLimiter(
  parseInt(process.env.RATE_LIMIT_WINDOW_MS),
  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS),
  "Too many requests, please try again later"
);

const postLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  10, // 10 posts per hour
  "Too many posts created, please try again later"
);

module.exports = {
  authLimiter,
  generalLimiter,
  postLimiter,
};
