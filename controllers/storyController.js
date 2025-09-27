const { Story, User } = require("../models");
const { Op, fn, col } = require("sequelize");

const StoryController = {
  // Create a new story
  createStory: async (req, res) => {
    try {
      const currentUser = req.user;
      const { content, mediaType } = req.body;
      const mediaFile = req.file;
      if (!mediaFile) {
        return res.status(400).json({
          success: false,
          message: "Media file is required",
        });
      }

      const story = await Story.create({
        userId: currentUser.id,
        content,
        mediaType,
        mediaUrl: mediaFile.path,
      });

      res.status(201).json({
        success: true,
        message: "Story created successfully",
        data: { story },
      });
    } catch (error) {
      console.error("Create story error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
  // Get active stories for a user
  getUserStories: async (req, res) => {
    try {
      const { userId } = req.params;
      const currentTime = new Date();
      const stories = await Story.findAll({
        where: {
          userId,
          isActive: true,
          expiresAt: { [Op.gt]: currentTime },
        },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "username", "profilePicture"],
          },
        ],
        order: [["createdAt", "DESC"]],
      });
      res.status(200).json({
        success: true,
        data: { stories },
      });
    } catch (error) {
      console.error("Get user stories error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
  // Increment story view count
  incrementStoryViews: async (req, res) => {
    try {
      const { storyId } = req.params;
      const story = await Story.findByPk(storyId);
      if (!story) {
        return res.status(404).json({
          success: false,
          message: "Story not found",
        });
      }
      story.viewsCount += 1;
      await story.save();
      res.status(200).json({
        success: true,
        data: { story },
      });
    } catch (error) {
      console.error("Increment story views error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};

module.exports = StoryController;
