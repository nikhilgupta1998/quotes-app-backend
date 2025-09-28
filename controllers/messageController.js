const { Message, Conversation, User } = require("../models");
const { Op } = require("sequelize");
const { uploadToCloudinary } = require("../utils/cloudinary");

class MessageController {
  // Get user's conversations
  static async getConversations(req, res) {
    try {
      const currentUser = req.user;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const conversations = await Conversation.findAndCountAll({
        where: {
          participants: {
            [Op.contains]: [currentUser.id],
          },
        },
        include: [
          {
            model: Message,
            as: "messages",
            limit: 1,
            order: [["createdAt", "DESC"]],
            include: [
              {
                model: User,
                as: "sender",
                attributes: [
                  "id",
                  "username",
                  "firstName",
                  "lastName",
                  "profilePicture",
                ],
              },
            ],
          },
        ],
        limit: parseInt(limit),
        offset,
        order: [["lastMessageAt", "DESC"]],
      });

      res.json({
        success: true,
        data: {
          conversations: conversations.rows,
          pagination: {
            total: conversations.count,
            page: parseInt(page),
            pages: Math.ceil(conversations.count / limit),
          },
        },
      });
    } catch (error) {
      console.error("Get conversations error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Create or get existing conversation
  static async createConversation(req, res) {
    try {
      const { participantId, isGroup, groupName } = req.body;
      const currentUser = req.user;

      let participants;

      if (isGroup) {
        participants = [currentUser.id, ...participantId];
      } else {
        participants = [currentUser.id, participantId].sort();
      }

      // Check if conversation already exists for direct messages
      if (!isGroup) {
        const existingConversation = await Conversation.findOne({
          where: {
            participants: {
              [Op.contains]: participants,
            },
            isGroup: false,
          },
        });

        if (existingConversation) {
          return res.json({
            success: true,
            data: { conversation: existingConversation },
          });
        }
      }

      const conversation = await Conversation.create({
        participants,
        isGroup: !!isGroup,
        groupName: isGroup ? groupName : null,
      });

      res.status(201).json({
        success: true,
        message: "Conversation created successfully",
        data: { conversation },
      });
    } catch (error) {
      console.error("Create conversation error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get conversation messages
  static async getConversation(req, res) {
    try {
      const { conversationId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;
      const currentUser = req.user;

      // Check if user is part of conversation
      const conversation = await Conversation.findOne({
        where: {
          id: conversationId,
          participants: {
            [Op.contains]: [currentUser.id],
          },
        },
      });

      if (!conversation) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this conversation",
        });
      }

      const messages = await Message.findAndCountAll({
        where: { conversationId },
        include: [
          {
            model: User,
            as: "sender",
            attributes: [
              "id",
              "username",
              "firstName",
              "lastName",
              "profilePicture",
            ],
          },
        ],
        limit: parseInt(limit),
        offset,
        order: [["createdAt", "DESC"]],
      });

      res.json({
        success: true,
        data: {
          conversation,
          messages: messages.rows.reverse(), // Reverse to show oldest first
          pagination: {
            total: messages.count,
            page: parseInt(page),
            pages: Math.ceil(messages.count / limit),
          },
        },
      });
    } catch (error) {
      console.error("Get conversation error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Send message
  static async sendMessage(req, res) {
    try {
      const { conversationId } = req.params;
      const { content } = req.body;
      const currentUser = req.user;

      // Verify user is part of conversation
      const conversation = await Conversation.findOne({
        where: {
          id: conversationId,
          participants: {
            [Op.contains]: [currentUser.id],
          },
        },
      });

      if (!conversation) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this conversation",
        });
      }

      let mediaUrl = null;
      let mediaType = "text";

      // Handle media upload
      if (req.file) {
        const result = await uploadToCloudinary(req.file.buffer, "messages");
        mediaUrl = result.secure_url;

        if (req.file.mimetype.startsWith("image/")) {
          mediaType = "image";
        } else if (req.file.mimetype.startsWith("video/")) {
          mediaType = "video";
        } else if (req.file.mimetype.startsWith("audio/")) {
          mediaType = "audio";
        } else {
          mediaType = "document";
        }
      }

      const message = await Message.create({
        conversationId,
        senderId: currentUser.id,
        content,
        mediaUrl,
        mediaType,
      });

      // Update conversation's last message info
      await conversation.update({
        lastMessageId: message.id,
        lastMessageAt: new Date(),
      });

      // Fetch created message with sender info
      const createdMessage = await Message.findByPk(message.id, {
        include: [
          {
            model: User,
            as: "sender",
            attributes: [
              "id",
              "username",
              "firstName",
              "lastName",
              "profilePicture",
            ],
          },
        ],
      });

      res.status(201).json({
        success: true,
        message: "Message sent successfully",
        data: { message: createdMessage },
      });
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Mark message as read
  static async markAsRead(req, res) {
    try {
      const { messageId } = req.params;
      const currentUser = req.user;

      const message = await Message.findByPk(messageId);

      if (!message) {
        return res.status(404).json({
          success: false,
          message: "Message not found",
        });
      }

      // Only receiver can mark as read
      if (message.senderId === currentUser.id) {
        return res.status(400).json({
          success: false,
          message: "Cannot mark your own message as read",
        });
      }

      await message.update({
        isRead: true,
        readAt: new Date(),
      });

      res.json({
        success: true,
        message: "Message marked as read",
      });
    } catch (error) {
      console.error("Mark as read error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Delete message
  static async deleteMessage(req, res) {
    try {
      const { messageId } = req.params;
      const currentUser = req.user;

      const message = await Message.findOne({
        where: {
          id: messageId,
          senderId: currentUser.id,
        },
      });

      if (!message) {
        return res.status(404).json({
          success: false,
          message:
            "Message not found or you do not have permission to delete it",
        });
      }

      await message.destroy();

      res.json({
        success: true,
        message: "Message deleted successfully",
      });
    } catch (error) {
      console.error("Delete message error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = MessageController;
