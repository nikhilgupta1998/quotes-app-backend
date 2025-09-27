const express = require("express");
const router = express.Router();
const PostController = require("../controllers/postController");
const { authenticate, optionalAuth } = require("../middleware/auth");
const upload = require("../middleware/upload");

// Routes
router.post(
  "/",
  authenticate,
  upload.array("media", 5),
  PostController.createPost
);
router.get("/feed", authenticate, PostController.getFeed);
router.get("/explore", authenticate, PostController.getExplorePosts);
router.get("/:postId", optionalAuth, PostController.getPost);
router.put("/:postId", authenticate, PostController.updatePost);
router.delete("/:postId", authenticate, PostController.deletePost);
router.post("/:postId/like", authenticate, PostController.likePost);
router.post("/:postId/unlike", authenticate, PostController.unlikePost);
router.get("/:postId/likes", PostController.getPostLikes);
router.post("/:postId/pin", authenticate, PostController.togglePinPost);
router.get("/hashtag/:hashtag", PostController.searchByHashtag);

module.exports = router;
