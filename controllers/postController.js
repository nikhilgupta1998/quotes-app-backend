const { Post, User, Like, Comment, Follow } = require("../models");
const { Op } = require("sequelize");
const { uploadToCloudinary } = require("../utils/cloudinary");

class PostController {
  // Create new post
  static async createPost(req, res) {
    try {
      const {
        content,
        location,
        latitude,
        longitude,
        visibility = "public",
      } = req.body;
      const currentUser = req.user;

      if (!content && (!req.files || req.files.length === 0)) {
        return res.status(400).json({
          success: false,
          message: "Post must contain content or media",
        });
      }

      let mediaUrls = [];
      let mediaType = null;

      // Upload media files if present
      if (req.files && req.files.length > 0) {
        const uploadPromises = req.files.map((file) =>
          uploadToCloudinary(file.buffer, "posts")
        );

        const uploadResults = await Promise.all(uploadPromises);
        mediaUrls = uploadResults.map((result) => result.secure_url);

        // Determine media type
        const hasImages = req.files.some((file) =>
          file.mimetype.startsWith("image/")
        );
        const hasVideos = req.files.some((file) =>
          file.mimetype.startsWith("video/")
        );

        if (hasImages && hasVideos) {
          mediaType = "mixed";
        } else if (hasImages) {
          mediaType = "image";
        } else if (hasVideos) {
          mediaType = "video";
        }
      }

      // Extract hashtags and mentions from content
      const hashtags = content ? content.match(/#\w+/g) || [] : [];
      const mentions = content ? content.match(/@\w+/g) || [] : [];

      const post = await Post.create({
        userId: currentUser.id,
        content,
        mediaUrls,
        mediaType,
        location,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        hashtags,
        mentions,
        visibility,
      });

      // Increment user's posts count
      await currentUser.increment("postsCount");

      // Fetch the created post with user data
      const createdPost = await Post.findByPk(post.id, {
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
        message: "Post created successfully",
        data: { post: createdPost },
      });
    } catch (error) {
      console.error("Create post error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get feed posts
  static async getFeed(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;
      const currentUser = req.user;

      // Get IDs of users that current user follows
      const following = await Follow.findAll({
        where: {
          followerId: currentUser.id,
          status: "accepted",
        },
        attributes: ["followingId"],
      });

      const followingIds = following.map((f) => f.followingId);
      followingIds.push(currentUser.id); // Include own posts

      const posts = await Post.findAndCountAll({
        where: {
          userId: { [Op.in]: followingIds },
          isActive: true,
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
              "isActive",
            ],
          },
          {
            model: Like,
            as: "likes",
            attributes: ["id", "userId"],
            limit: 5,
            include: [
              {
                model: User,
                as: "user",
                attributes: ["id", "username", "profilePicture"],
              },
            ],
          },
          {
            model: Comment,
            as: "comments",
            where: { isActive: true },
            required: false,
            limit: 3,
            order: [["createdAt", "DESC"]],
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
          },
        ],
        limit: parseInt(limit),
        offset,
        order: [["createdAt", "DESC"]],
        distinct: true,
      });

      // Check if current user liked each post
      const postsWithLikeStatus = await Promise.all(
        posts.rows.map(async (post) => {
          const userLike = await Like.findOne({
            where: {
              postId: post.id,
              userId: currentUser.id,
            },
          });

          return {
            ...post.toJSON(),
            isLiked: !!userLike,
          };
        })
      );

      res.json({
        success: true,
        data: {
          posts: postsWithLikeStatus,
          pagination: {
            total: posts.count,
            page: parseInt(page),
            pages: Math.ceil(posts.count / limit),
          },
        },
      });
    } catch (error) {
      console.error("Get feed error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get explore posts (public posts from users not followed)
  static async getExplorePosts(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;
      const currentUser = req.user;

      // Get IDs of users that current user follows
      const following = await Follow.findAll({
        where: {
          followerId: currentUser.id,
          status: "accepted",
        },
        attributes: ["followingId"],
      });

      const followingIds = following.map((f) => f.followingId);
      followingIds.push(currentUser.id); // Exclude own posts too

      const posts = await Post.findAndCountAll({
        where: {
          userId: { [Op.notIn]: followingIds },
          isActive: true,
          visibility: "public",
        },
        include: [
          {
            model: User,
            as: "user",
            where: { isActive: true, isPrivate: false },
            attributes: [
              "id",
              "username",
              "firstName",
              "lastName",
              "profilePicture",
            ],
          },
          {
            model: Like,
            as: "likes",
            attributes: ["id", "userId"],
            limit: 5,
          },
        ],
        limit: parseInt(limit),
        offset,
        order: [
          ["likesCount", "DESC"],
          ["createdAt", "DESC"],
        ],
        distinct: true,
      });

      // Check if current user liked each post
      const postsWithLikeStatus = await Promise.all(
        posts.rows.map(async (post) => {
          const userLike = await Like.findOne({
            where: {
              postId: post.id,
              userId: currentUser.id,
            },
          });

          return {
            ...post.toJSON(),
            isLiked: !!userLike,
          };
        })
      );

      res.json({
        success: true,
        data: {
          posts: postsWithLikeStatus,
          pagination: {
            total: posts.count,
            page: parseInt(page),
            pages: Math.ceil(posts.count / limit),
          },
        },
      });
    } catch (error) {
      console.error("Get explore posts error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get single post
  static async getPost(req, res) {
    try {
      const { postId } = req.params;
      const currentUser = req.user;

      const post = await Post.findOne({
        where: {
          id: postId,
          isActive: true,
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
              "isPrivate",
            ],
          },
          {
            model: Like,
            as: "likes",
            attributes: ["id", "userId"],
            include: [
              {
                model: User,
                as: "user",
                attributes: ["id", "username", "profilePicture"],
              },
            ],
          },
          {
            model: Comment,
            as: "comments",
            where: { isActive: true, parentId: null },
            required: false,
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
              {
                model: Comment,
                as: "replies",
                where: { isActive: true },
                required: false,
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
              },
            ],
            order: [["createdAt", "ASC"]],
          },
        ],
      });

      if (!post) {
        return res.status(404).json({
          success: false,
          message: "Post not found",
        });
      }

      // Check if user can view this post
      if (post.visibility === "private" && post.userId !== currentUser.id) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to view this post",
        });
      }

      if (post.visibility === "followers" && post.userId !== currentUser.id) {
        const isFollowing = await Follow.findOne({
          where: {
            followerId: currentUser.id,
            followingId: post.userId,
            status: "accepted",
          },
        });

        if (!isFollowing) {
          return res.status(403).json({
            success: false,
            message: "You do not have permission to view this post",
          });
        }
      }

      // Check if current user liked the post
      const userLike = await Like.findOne({
        where: {
          postId: post.id,
          userId: currentUser.id,
        },
      });

      res.json({
        success: true,
        data: {
          post: {
            ...post.toJSON(),
            isLiked: !!userLike,
          },
        },
      });
    } catch (error) {
      console.error("Get post error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Update post
  static async updatePost(req, res) {
    try {
      const { postId } = req.params;
      const { content, location, latitude, longitude, visibility } = req.body;
      const currentUser = req.user;

      const post = await Post.findOne({
        where: {
          id: postId,
          userId: currentUser.id,
          isActive: true,
        },
      });

      if (!post) {
        return res.status(404).json({
          success: false,
          message: "Post not found or you do not have permission to edit it",
        });
      }

      const updates = {};
      if (content !== undefined) {
        updates.content = content;
        // Update hashtags and mentions
        updates.hashtags = content.match(/#\w+/g) || [];
        updates.mentions = content.match(/@\w+/g) || [];
      }
      if (location !== undefined) updates.location = location;
      if (latitude !== undefined) updates.latitude = parseFloat(latitude);
      if (longitude !== undefined) updates.longitude = parseFloat(longitude);
      if (visibility !== undefined) updates.visibility = visibility;

      await post.update(updates);

      // Fetch updated post with user data
      const updatedPost = await Post.findByPk(post.id, {
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

      res.json({
        success: true,
        message: "Post updated successfully",
        data: { post: updatedPost },
      });
    } catch (error) {
      console.error("Update post error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Delete post
  static async deletePost(req, res) {
    try {
      const { postId } = req.params;
      const currentUser = req.user;

      const post = await Post.findOne({
        where: {
          id: postId,
          userId: currentUser.id,
          isActive: true,
        },
      });

      if (!post) {
        return res.status(404).json({
          success: false,
          message: "Post not found or you do not have permission to delete it",
        });
      }

      await post.update({ isActive: false });

      // Decrement user's posts count
      await currentUser.decrement("postsCount");

      res.json({
        success: true,
        message: "Post deleted successfully",
      });
    } catch (error) {
      console.error("Delete post error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Like post
  static async likePost(req, res) {
    try {
      const { postId } = req.params;
      const currentUser = req.user;

      const post = await Post.findOne({
        where: {
          id: postId,
          isActive: true,
        },
      });

      if (!post) {
        return res.status(404).json({
          success: false,
          message: "Post not found",
        });
      }

      // Check if already liked
      const existingLike = await Like.findOne({
        where: {
          postId,
          userId: currentUser.id,
        },
      });

      if (existingLike) {
        return res.status(400).json({
          success: false,
          message: "Post already liked",
        });
      }

      await Like.create({
        postId,
        userId: currentUser.id,
      });

      // Increment likes count
      await post.increment("likesCount");

      res.json({
        success: true,
        message: "Post liked successfully",
      });
    } catch (error) {
      console.error("Like post error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Unlike post
  static async unlikePost(req, res) {
    try {
      const { postId } = req.params;
      const currentUser = req.user;

      const like = await Like.findOne({
        where: {
          postId,
          userId: currentUser.id,
        },
      });

      if (!like) {
        return res.status(400).json({
          success: false,
          message: "Post not liked",
        });
      }

      await like.destroy();

      // Decrement likes count
      const post = await Post.findByPk(postId);
      if (post) {
        await post.decrement("likesCount");
      }

      res.json({
        success: true,
        message: "Post unliked successfully",
      });
    } catch (error) {
      console.error("Unlike post error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get post likes
  static async getPostLikes(req, res) {
    try {
      const { postId } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const post = await Post.findOne({
        where: {
          id: postId,
          isActive: true,
        },
      });

      if (!post) {
        return res.status(404).json({
          success: false,
          message: "Post not found",
        });
      }

      const likes = await Like.findAndCountAll({
        where: { postId },
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
        limit: parseInt(limit),
        offset,
        order: [["createdAt", "DESC"]],
      });

      res.json({
        success: true,
        data: {
          likes: likes.rows,
          pagination: {
            total: likes.count,
            page: parseInt(page),
            pages: Math.ceil(likes.count / limit),
          },
        },
      });
    } catch (error) {
      console.error("Get post likes error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Pin/Unpin post
  static async togglePinPost(req, res) {
    try {
      const { postId } = req.params;
      const currentUser = req.user;

      const post = await Post.findOne({
        where: {
          id: postId,
          userId: currentUser.id,
          isActive: true,
        },
      });

      if (!post) {
        return res.status(404).json({
          success: false,
          message: "Post not found or you do not have permission",
        });
      }

      await post.update({ isPinned: !post.isPinned });

      res.json({
        success: true,
        message: post.isPinned
          ? "Post unpinned successfully"
          : "Post pinned successfully",
        data: { isPinned: !post.isPinned },
      });
    } catch (error) {
      console.error("Toggle pin post error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Search posts by hashtag
  static async searchByHashtag(req, res) {
    try {
      const { hashtag } = req.params;
      const { page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;

      const posts = await Post.findAndCountAll({
        where: {
          hashtags: {
            [Op.contains]: [`#${hashtag}`],
          },
          isActive: true,
          visibility: "public",
        },
        include: [
          {
            model: User,
            as: "user",
            where: { isActive: true, isPrivate: false },
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
        order: [
          ["likesCount", "DESC"],
          ["createdAt", "DESC"],
        ],
        distinct: true,
      });

      res.json({
        success: true,
        data: {
          hashtag: `#${hashtag}`,
          posts: posts.rows,
          pagination: {
            total: posts.count,
            page: parseInt(page),
            pages: Math.ceil(posts.count / limit),
          },
        },
      });
    } catch (error) {
      console.error("Search by hashtag error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = PostController;
