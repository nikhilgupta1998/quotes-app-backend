const { Notification } = require("../models");

class NotificationController {
  // Get user notifications
  static async getNotifications(req, res) {
    try {
      const currentUser = req.user;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const notifications = await Notification.findAndCountAll({
        where: { userId: currentUser.id },
        limit: parseInt(limit),
        offset,
        order: [["createdAt", "DESC"]],
      });

      res.json({
        success: true,
        data: {
          notifications: notifications.rows,
          pagination: {
            total: notifications.count,
            page: parseInt(page),
            pages: Math.ceil(notifications.count / limit),
          },
        },
      });
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Mark notification as read
  static async markAsRead(req, res) {
    try {
      const { notificationId } = req.params;
      const currentUser = req.user;

      const notification = await Notification.findOne({
        where: {
          id: notificationId,
          userId: currentUser.id,
        },
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found",
        });
      }

      await notification.update({
        isRead: true,
        readAt: new Date(),
      });

      res.json({
        success: true,
        message: "Notification marked as read",
      });
    } catch (error) {
      console.error("Mark notification as read error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Mark all notifications as read
  static async markAllAsRead(req, res) {
    try {
      const currentUser = req.user;

      await Notification.update(
        {
          isRead: true,
          readAt: new Date(),
        },
        {
          where: {
            userId: currentUser.id,
            isRead: false,
          },
        }
      );

      res.json({
        success: true,
        message: "All notifications marked as read",
      });
    } catch (error) {
      console.error("Mark all notifications as read error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Delete notification
  static async deleteNotification(req, res) {
    try {
      const { notificationId } = req.params;
      const currentUser = req.user;

      const notification = await Notification.findOne({
        where: {
          id: notificationId,
          userId: currentUser.id,
        },
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found",
        });
      }

      await notification.destroy();

      res.json({
        success: true,
        message: "Notification deleted successfully",
      });
    } catch (error) {
      console.error("Create comment error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}
module.exports = NotificationController;
