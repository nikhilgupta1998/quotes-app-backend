const { User, Conversation } = require("../models");
const { Op } = require("sequelize");

const ConversationController = {
  createConversation: async (req, res) => {
    try {
      const { participants } = req.body;
      const conversation = await Conversation.create({
        participants,
      });
      res.status(201).json({
        success: true,
        data: { conversation },
      });
    } catch (error) {
      console.error("Create conversation error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
  getConversations: async (req, res) => {
    try {
      const userId = req.user.id;
      const conversations = await Conversation.findAll({
        where: {
          participants: {
            [Op.contains]: [userId],
          },
        },
        include: [
          {
            model: User,
            as: "participants",
            attributes: ["id", "username", "profilePicture"],
          },
        ],
      });
      res.status(200).json({
        success: true,
        data: { conversations },
      });
    } catch (error) {
      console.error("Get user conversations error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
  updateGroupConversation: async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { groupName, groupImage } = req.body;
      const conversation = await Conversation.findByPk(conversationId);
      if (!conversation || !conversation.isGroup) {
        return res.status(404).json({
          success: false,
          message: "Group conversation not found",
        });
      }
      conversation.groupName = groupName;
      conversation.groupImage = groupImage;
      await conversation.save();
      res.status(200).json({
        success: true,
        data: { conversation },
      });
    } catch (error) {
      console.error("Update group conversation error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
  uploadGroupImage: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }
      const conversationId = req.params.conversationId;
      const conversation = await Conversation.findByPk(conversationId);
      if (!conversation || !conversation.isGroup) {
        return res.status(404).json({
          success: false,
          message: "Group conversation not found",
        });
      }
      conversation.groupImage = req.file.path;
      await conversation.save();
      res.status(200).json({
        success: true,
        data: { conversation },
      });
    } catch (error) {
      console.error("Upload group image error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};

module.exports = ConversationController;
