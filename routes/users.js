const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// User routes
router.get('/profile', authenticate, UserController.getProfile);
router.put('/profile', authenticate, UserController.updateProfile);
router.post('/profile/picture', authenticate, upload.single('profilePicture'), UserController.uploadProfilePicture);
router.post('/profile/cover', authenticate, upload.single('coverPhoto'), UserController.uploadCoverPhoto);

// User discovery and search
router.get('/search', authenticate, UserController.searchUsers);
router.get('/:username', optionalAuth, UserController.getUserByUsername);

// Follow system
router.post('/:username/follow', authenticate, UserController.followUser);
router.delete('/:username/unfollow', authenticate, UserController.unfollowUser);
router.get('/:username/followers', optionalAuth, UserController.getFollowers);
router.get('/:username/following', optionalAuth, UserController.getFollowing);

// Follow requests (for private accounts)
router.get('/follow-requests', authenticate, UserController.getFollowRequests);
router.put('/follow-requests/:requestId/accept', authenticate, UserController.acceptFollowRequest);
router.delete('/follow-requests/:requestId/reject', authenticate, UserController.rejectFollowRequest);

// Deactivate account
router.put('/deactive-account', authenticate, UserController.deactivateAccount);

module.exports = router;
