const { Story, User, Follow } = require("../models");
const { uploadToCloudinary } = require("../utils/cloudinary");
const { Op } = require("sequelize");

class StoryController {
  // Create story
  static async createStory(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Media file is required",
        });
      }

      const { content } = req.body;
      const currentUser = req.user;

      // Upload media to cloudinary
      const result = await uploadToCloudinary(req.file.buffer, "stories");

      const mediaType = req.file.mimetype.startsWith("image/")
        ? "image"
        : "video";
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const story = await Story.create({
        userId: currentUser.id,
        mediaUrl: result.secure_url,
        mediaType,
        content,
        expiresAt,
      });

      const createdStory = await Story.findByPk(story.id, {
        include: [
          {
            model: User,
            as: "user",
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
        message: "Story created successfully",
        data: { story: createdStory },
      });
    } catch (error) {
      console.error("Create story error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get stories from following users
  static async getStories(req, res) {
    try {
      const currentUser = req.user;

      // Get users that current user follows
      const following = await Follow.findAll({
        where: {
          followerId: currentUser.id,
          status: "accepted",
        },
        attributes: ["followingId"],
      });

      const followingIds = following.map((f) => f.followingId);
      followingIds.push(currentUser.id); // Include own stories

      const stories = await Story.findAll({
        where: {
          userId: { [Op.in]: followingIds },
          isActive: true,
          expiresAt: { [Op.gt]: new Date() },
        },
        include: [
          {
            model: User,
            as: "user",
            attributes: [
              "id",
              "username",
              "firstName",
              "lastName",
              "profilePicture",
            ],
          },
        ],
        order: [["createdAt", "DESC"]],
      });

      // Group stories by user
      const groupedStories = stories.reduce((acc, story) => {
        const userId = story.userId;
        if (!acc[userId]) {
          acc[userId] = {
            user: story.user,
            stories: [],
          };
        }
        acc[userId].stories.push(story);
        return acc;
      }, {});

      res.json({
        success: true,
        data: { stories: Object.values(groupedStories) },
      });
    } catch (error) {
      console.error("Get stories error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // View story (increment views)
  static async viewStory(req, res) {
    try {
      const { storyId } = req.params;

      const story = await Story.findOne({
        where: {
          id: storyId,
          isActive: true,
          expiresAt: { [Op.gt]: new Date() },
        },
        include: [
          {
            model: User,
            as: "user",
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

      if (!story) {
        return res.status(404).json({
          success: false,
          message: "Story not found or expired",
        });
      }

      // Increment views count
      await story.increment("viewsCount");

      res.json({
        success: true,
        data: { story },
      });
    } catch (error) {
      console.error("View story error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Delete story
  static async deleteStory(req, res) {
    try {
      const { storyId } = req.params;
      const currentUser = req.user;

      const story = await Story.findOne({
        where: {
          id: storyId,
          userId: currentUser.id,
          isActive: true,
        },
      });

      if (!story) {
        return res.status(404).json({
          success: false,
          message: "Story not found or you do not have permission to delete it",
        });
      }

      await story.update({ isActive: false });

      res.json({
        success: true,
        message: "Story deleted successfully",
      });
    } catch (error) {
      console.error("Delete story error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = StoryController;
