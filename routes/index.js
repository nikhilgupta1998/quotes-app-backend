const express = require("express");
const router = express.Router();

// Import all route modules
const authRoutes = require("./auth");
const userRoutes = require("./users");
const postRoutes = require("./posts");
const storyRoutes = require("./stories");
const messageRoutes = require("./messages");
const notificationRoutes = require("./notifications");

// API routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/posts", postRoutes);
router.use("/stories", storyRoutes);
router.use("/messages", messageRoutes);
router.use("/notifications", notificationRoutes);

// Health check
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Social Media API is running",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// 404 handler for API routes
// router.use("*", (req, res) => {
//   res.status(404).json({
//     success: false,
//     message: "API endpoint not found",
//   });
// });

module.exports = router;
