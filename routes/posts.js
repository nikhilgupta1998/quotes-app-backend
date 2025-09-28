const express = require("express");
const router = express.Router();
const PostController = require("../controllers/postController");
const CommentController = require("../controllers/commentController");
const { authenticate, optionalAuth } = require("../middleware/auth");
const { postLimiter } = require("../middleware/rateLimiter");
const upload = require("../middleware/upload");

// Post CRUD
router.post(
  "/",
  authenticate,
  postLimiter,
  upload.array("media", 5),
  PostController.createPost
);
router.get("/feed", authenticate, PostController.getFeed);
router.get("/explore", authenticate, PostController.getExplorePosts);
router.get("/:postId", optionalAuth, PostController.getPost);
router.put("/:postId", authenticate, PostController.updatePost);
router.delete("/:postId", authenticate, PostController.deletePost);

// Post interactions
router.post("/:postId/like", authenticate, PostController.likePost);
router.delete("/:postId/like", authenticate, PostController.unlikePost);
router.get("/:postId/likes", optionalAuth, PostController.getPostLikes);
router.put("/:postId/pin", authenticate, PostController.togglePinPost);

// Comments
router.post("/:postId/comments", authenticate, CommentController.createComment);
router.get(
  "/:postId/comments",
  optionalAuth,
  CommentController.getPostComments
);
router.put(
  "/comments/:commentId",
  authenticate,
  CommentController.updateComment
);
router.delete(
  "/comments/:commentId",
  authenticate,
  CommentController.deleteComment
);
router.post(
  "/comments/:commentId/like",
  authenticate,
  CommentController.likeComment
);
router.delete(
  "/comments/:commentId/like",
  authenticate,
  CommentController.unlikeComment
);

// Hashtag search
router.get("/hashtag/:hashtag", optionalAuth, PostController.searchByHashtag);

module.exports = router;
