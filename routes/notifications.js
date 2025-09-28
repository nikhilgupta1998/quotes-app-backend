const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

// Notification routes
router.get('/', authenticate, NotificationController.getNotifications);
router.put('/:notificationId/read', authenticate, NotificationController.markAsRead);
router.put('/read-all', authenticate, NotificationController.markAllAsRead);
router.delete('/:notificationId', authenticate, NotificationController.deleteNotification);

module.exports = router;