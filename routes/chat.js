const express = require("express");
const router = express.Router();
const ConversationController = require("../controllers/conversationController");
const { authenticate } = require("../middleware/auth");
const upload = require("../middleware/upload");

// Create a new conversation
router.post("/", authenticate, ConversationController.createConversation);

// Get all conversations for the authenticated user
router.get("/", authenticate, ConversationController.getConversations);

// Update a group conversation
router.put(
  "/:conversationId",
  authenticate,
  ConversationController.updateGroupConversation
);

// Upload a group image
router.post(
  "/:conversationId/image",
  authenticate,
  upload.single("image"),
  ConversationController.uploadGroupImage
);

module.exports = router;
