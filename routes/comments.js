const express = require("express");
const router = express.Router();
const CommentController = require("../controllers/commentController");
const { authenticate, optionalAuth } = require("../middleware/auth");

// Routes
router.post("/:postId", authenticate, CommentController.createComment);
router.get("/:postId", optionalAuth, CommentController.getComments);
router.delete("/:commentId", authenticate, CommentController.deleteComment);
router.put("/:commentId", authenticate, CommentController.updateComment);

module.exports = router;
