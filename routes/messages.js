const express = require('express');
const router = express.Router();
const MessageController = require('../controllers/messageController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Conversation routes
router.get('/conversations', authenticate, MessageController.getConversations);
router.post('/conversations', authenticate, MessageController.createConversation);
router.get('/conversations/:conversationId', authenticate, MessageController.getConversation);

// Message routes
router.post('/conversations/:conversationId/messages', authenticate, upload.single('media'), MessageController.sendMessage);
router.put('/messages/:messageId/read', authenticate, MessageController.markAsRead);
router.delete('/messages/:messageId', authenticate, MessageController.deleteMessage);

module.exports = router;