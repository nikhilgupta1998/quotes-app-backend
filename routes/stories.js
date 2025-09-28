const express = require("express");
const router = express.Router();
const StoryController = require("../controllers/storyController");
const { authenticate } = require("../middleware/auth");
const upload = require("../middleware/upload");

// Story routes
router.post(
  "/",
  authenticate,
  upload.single("media"),
  StoryController.createStory
);
router.get("/", authenticate, StoryController.getStories);
router.get("/:storyId/view", authenticate, StoryController.viewStory);
router.delete("/:storyId", authenticate, StoryController.deleteStory);

module.exports = router;
