const express = require("express");
const router = express.Router();
const AuthController = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");

// Authentication routes
router.post("/register", authLimiter, AuthController.register);
router.post("/login", authLimiter, AuthController.login);
router.get("/verify-email/:token", AuthController.verifyEmail);
router.post("/verify-mobile", AuthController.verifyMobile);
router.post(
  "/resend-email-verification",
  authLimiter,
  AuthController.resendEmailVerification
);
router.post("/resend-mobile-otp", authLimiter, AuthController.resendMobileOTP);
router.post("/forgot-password", authLimiter, AuthController.forgotPassword);
router.post("/reset-password", authLimiter, AuthController.resetPassword);
router.post("/refresh-token", AuthController.refreshToken);
router.post("/logout", authenticate, AuthController.logout);

module.exports = router;
