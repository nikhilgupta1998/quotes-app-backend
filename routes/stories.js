const express = require('express');
const router = express.Router();
const StoryController = require('../controllers/storyController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Create a new story
router.post('/', authenticate, upload.single('media'), StoryController.createStory);

// Get active stories for a user
router.get('/:userId', optionalAuth, StoryController.getUserStories);

// Increment story view count
router.post('/:storyId/views', optionalAuth, StoryController.incrementStoryViews);

module.exports = router;