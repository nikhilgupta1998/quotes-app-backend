const { User, Follow, Post } = require("../models");
const { Op } = require("sequelize");
const { uploadToCloudinary } = require("../utils/cloudinary");

class UserController {
  // Get current user profile
  static async getProfile(req, res) {
    try {
      const user = req.user;
      res.json({
        success: true,
        data: { user },
      });
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Update user profile
  static async updateProfile(req, res) {
    try {
      const user = req.user;
      const allowedUpdates = [
        "firstName",
        "lastName",
        "bio",
        "dateOfBirth",
        "gender",
        "location",
        "website",
        "isPrivate",
      ];

      const updates = {};
      Object.keys(req.body).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          updates[key] = req.body[key];
        }
      });

      await user.update(updates);

      res.json({
        success: true,
        message: "Profile updated successfully",
        data: { user },
      });
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Upload profile picture
  static async uploadProfilePicture(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      const result = await uploadToCloudinary(
        req.file.buffer,
        "profile_pictures"
      );

      await req.user.update({
        profilePicture: result.secure_url,
      });

      res.json({
        success: true,
        message: "Profile picture uploaded successfully",
        data: {
          profilePicture: result.secure_url,
        },
      });
    } catch (error) {
      console.error("Upload profile picture error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Upload cover photo
  static async uploadCoverPhoto(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      const result = await uploadToCloudinary(req.file.buffer, "cover_photos");

      await req.user.update({
        coverPhoto: result.secure_url,
      });

      res.json({
        success: true,
        message: "Cover photo uploaded successfully",
        data: {
          coverPhoto: result.secure_url,
        },
      });
    } catch (error) {
      console.error("Upload cover photo error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get user by username
  static async getUserByUsername(req, res) {
    try {
      const { username } = req.params;
      const currentUserId = req.user?.id;

      const user = await User.findOne({
        where: { username, isActive: true },
        include: [
          {
            model: Post,
            as: "posts",
            where: { isActive: true },
            required: false,
            limit: 10,
            order: [["createdAt", "DESC"]],
          },
        ],
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Check if current user follows this user
      let isFollowing = false;
      let followStatus = null;

      if (currentUserId && currentUserId !== user.id) {
        const follow = await Follow.findOne({
          where: {
            followerId: currentUserId,
            followingId: user.id,
          },
        });

        if (follow) {
          isFollowing = follow.status === "accepted";
          followStatus = follow.status;
        }
      }

      // If user is private and not following, don't show posts
      if (user.isPrivate && !isFollowing && currentUserId !== user.id) {
        user.posts = [];
      }

      res.json({
        success: true,
        data: {
          user,
          isFollowing,
          followStatus,
          isOwnProfile: currentUserId === user.id,
        },
      });
    } catch (error) {
      console.error("Get user by username error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Search users
  static async searchUsers(req, res) {
    try {
      const { q, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      if (!q || q.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: "Search query must be at least 2 characters",
        });
      }

      const users = await User.findAndCountAll({
        where: {
          [Op.and]: [
            { isActive: true },
            {
              [Op.or]: [
                { username: { [Op.like]: `%${q}%` } },
                { firstName: { [Op.like]: `%${q}%` } },
                { lastName: { [Op.like]: `%${q}%` } },
              ],
            },
          ],
        },
        attributes: {
          exclude: [
            "password",
            "refreshToken",
            "emailVerificationToken",
            "mobileVerificationCode",
            "passwordResetToken",
          ],
        },
        limit: parseInt(limit),
        offset,
        order: [
          ["followersCount", "DESC"],
          ["createdAt", "DESC"],
        ],
      });

      res.json({
        success: true,
        data: {
          users: users.rows,
          pagination: {
            total: users.count,
            page: parseInt(page),
            pages: Math.ceil(users.count / limit),
          },
        },
      });
    } catch (error) {
      console.error("Search users error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Follow user
  static async followUser(req, res) {
    try {
      const { username } = req.params;
      const currentUser = req.user;

      const userToFollow = await User.findOne({
        where: { username, isActive: true },
      });

      if (!userToFollow) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (userToFollow.id === currentUser.id) {
        return res.status(400).json({
          success: false,
          message: "Cannot follow yourself",
        });
      }

      // Check if already following
      const existingFollow = await Follow.findOne({
        where: {
          followerId: currentUser.id,
          followingId: userToFollow.id,
        },
      });

      if (existingFollow) {
        return res.status(400).json({
          success: false,
          message: "Already following this user",
        });
      }

      // Create follow record
      const status = userToFollow.isPrivate ? "pending" : "accepted";
      await Follow.create({
        followerId: currentUser.id,
        followingId: userToFollow.id,
        status,
      });

      // Update counts if accepted
      if (status === "accepted") {
        await Promise.all([
          currentUser.increment("followingCount"),
          userToFollow.increment("followersCount"),
        ]);
      }

      res.json({
        success: true,
        message:
          status === "pending"
            ? "Follow request sent"
            : "Successfully followed user",
        data: { status },
      });
    } catch (error) {
      console.error("Follow user error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Unfollow user
  static async unfollowUser(req, res) {
    try {
      const { username } = req.params;
      const currentUser = req.user;

      const userToUnfollow = await User.findOne({
        where: { username, isActive: true },
      });

      if (!userToUnfollow) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const follow = await Follow.findOne({
        where: {
          followerId: currentUser.id,
          followingId: userToUnfollow.id,
        },
      });

      if (!follow) {
        return res.status(400).json({
          success: false,
          message: "Not following this user",
        });
      }

      await follow.destroy();

      // Update counts if was accepted
      if (follow.status === "accepted") {
        await Promise.all([
          currentUser.decrement("followingCount"),
          userToUnfollow.decrement("followersCount"),
        ]);
      }

      res.json({
        success: true,
        message: "Successfully unfollowed user",
      });
    } catch (error) {
      console.error("Unfollow user error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get followers
  static async getFollowers(req, res) {
    try {
      const { username } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const user = await User.findOne({
        where: { username, isActive: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const followers = await Follow.findAndCountAll({
        where: {
          followingId: user.id,
          status: "accepted",
        },
        include: [
          {
            model: User,
            as: "follower",
            attributes: {
              exclude: ["password", "refreshToken", "emailVerificationToken"],
            },
          },
        ],
        limit: parseInt(limit),
        offset,
        order: [["createdAt", "DESC"]],
      });

      res.json({
        success: true,
        data: {
          followers: followers.rows,
          pagination: {
            total: followers.count,
            page: parseInt(page),
            pages: Math.ceil(followers.count / limit),
          },
        },
      });
    } catch (error) {
      console.error("Get followers error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get following
  static async getFollowing(req, res) {
    try {
      const { username } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const user = await User.findOne({
        where: { username, isActive: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const following = await Follow.findAndCountAll({
        where: {
          followerId: user.id,
          status: "accepted",
        },
        include: [
          {
            model: User,
            as: "following",
            attributes: {
              exclude: ["password", "refreshToken", "emailVerificationToken"],
            },
          },
        ],
        limit: parseInt(limit),
        offset,
        order: [["createdAt", "DESC"]],
      });

      res.json({
        success: true,
        data: {
          following: following.rows,
          pagination: {
            total: following.count,
            page: parseInt(page),
            pages: Math.ceil(following.count / limit),
          },
        },
      });
    } catch (error) {
      console.error("Get following error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get follow requests (for private accounts)
  static async getFollowRequests(req, res) {
    try {
      const currentUser = req.user;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const requests = await Follow.findAndCountAll({
        where: {
          followingId: currentUser.id,
          status: "pending",
        },
        include: [
          {
            model: User,
            as: "follower",
            attributes: {
              exclude: ["password", "refreshToken", "emailVerificationToken"],
            },
          },
        ],
        limit: parseInt(limit),
        offset,
        order: [["createdAt", "DESC"]],
      });

      res.json({
        success: true,
        data: {
          requests: requests.rows,
          pagination: {
            total: requests.count,
            page: parseInt(page),
            pages: Math.ceil(requests.count / limit),
          },
        },
      });
    } catch (error) {
      console.error("Get follow requests error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Accept follow request
  static async acceptFollowRequest(req, res) {
    try {
      const { requestId } = req.params;
      const currentUser = req.user;

      const followRequest = await Follow.findOne({
        where: {
          id: requestId,
          followingId: currentUser.id,
          status: "pending",
        },
        include: [{ model: User, as: "follower" }],
      });

      if (!followRequest) {
        return res.status(404).json({
          success: false,
          message: "Follow request not found",
        });
      }

      await followRequest.update({ status: "accepted" });

      // Update counts
      await Promise.all([
        followRequest.follower.increment("followingCount"),
        currentUser.increment("followersCount"),
      ]);

      res.json({
        success: true,
        message: "Follow request accepted",
      });
    } catch (error) {
      console.error("Accept follow request error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Reject follow request
  static async rejectFollowRequest(req, res) {
    try {
      const { requestId } = req.params;
      const currentUser = req.user;

      const followRequest = await Follow.findOne({
        where: {
          id: requestId,
          followingId: currentUser.id,
          status: "pending",
        },
      });

      if (!followRequest) {
        return res.status(404).json({
          success: false,
          message: "Follow request not found",
        });
      }

      await followRequest.destroy();

      res.json({
        success: true,
        message: "Follow request rejected",
      });
    } catch (error) {
      console.error("Reject follow request error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Deactivate account
  static async deactivateAccount(req, res) {
    try {
      const user = req.user;

      await user.update({
        isActive: false,
        refreshToken: null,
      });

      res.json({
        success: true,
        message: "Account deactivated successfully",
      });
    } catch (error) {
      console.error("Deactivate account error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = UserController;
