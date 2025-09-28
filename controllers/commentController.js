const { Comment, User, Post } = require("../models");
const { validateComment } = require("../utils/validation");

class CommentController {
  // Create comment
  static async createComment(req, res) {
    try {
      const { postId } = req.params;
      const { error } = validateComment(req.body);

      if (error) {
        return res.status(400).json({
          success: false,
          message: error.details[0].message,
        });
      }

      const { content, parentId } = req.body;
      const currentUser = req.user;

      // Check if post exists
      const post = await Post.findOne({
        where: { id: postId, isActive: true },
      });

      if (!post) {
        return res.status(404).json({
          success: false,
          message: "Post not found",
        });
      }

      // If it's a reply, check if parent comment exists
      if (parentId) {
        const parentComment = await Comment.findOne({
          where: { id: parentId, postId, isActive: true },
        });

        if (!parentComment) {
          return res.status(404).json({
            success: false,
            message: "Parent comment not found",
          });
        }
      }

      const comment = await Comment.create({
        userId: currentUser.id,
        postId,
        parentId,
        content,
      });

      // Increment comments count
      await post.increment("commentsCount");

      // If it's a reply, increment replies count of parent
      if (parentId) {
        const parentComment = await Comment.findByPk(parentId);
        await parentComment.increment("repliesCount");
      }

      // Fetch created comment with user data
      const createdComment = await Comment.findByPk(comment.id, {
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
        message: "Comment created successfully",
        data: { comment: createdComment },
      });
    } catch (error) {
      console.error("Delete notification error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get post comments
  static async getPostComments(req, res) {
    try {
      const { postId } = req.params;
      const { page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;

      const comments = await Comment.findAndCountAll({
        where: {
          postId,
          parentId: null,
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
        limit: parseInt(limit),
        offset,
        order: [["createdAt", "ASC"]],
      });

      res.json({
        success: true,
        data: {
          comments: comments.rows,
          pagination: {
            total: comments.count,
            page: parseInt(page),
            pages: Math.ceil(comments.count / limit),
          },
        },
      });
    } catch (error) {
      console.error("Get post comments error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Update comment
  static async updateComment(req, res) {
    try {
      const { commentId } = req.params;
      const { content } = req.body;
      const currentUser = req.user;

      const comment = await Comment.findOne({
        where: {
          id: commentId,
          userId: currentUser.id,
          isActive: true,
        },
      });

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: "Comment not found or you do not have permission to edit it",
        });
      }

      await comment.update({ content });

      res.json({
        success: true,
        message: "Comment updated successfully",
      });
    } catch (error) {
      console.error("Update comment error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Delete comment
  static async deleteComment(req, res) {
    try {
      const { commentId } = req.params;
      const currentUser = req.user;

      const comment = await Comment.findOne({
        where: {
          id: commentId,
          userId: currentUser.id,
          isActive: true,
        },
      });

      if (!comment) {
        return res.status(404).json({
          success: false,
          message:
            "Comment not found or you do not have permission to delete it",
        });
      }

      await comment.update({ isActive: false });

      // Decrement comments count
      const post = await Post.findByPk(comment.postId);
      if (post) {
        await post.decrement("commentsCount");
      }

      // If it's a reply, decrement parent's replies count
      if (comment.parentId) {
        const parentComment = await Comment.findByPk(comment.parentId);
        if (parentComment) {
          await parentComment.decrement("repliesCount");
        }
      }

      res.json({
        success: true,
        message: "Comment deleted successfully",
      });
    } catch (error) {
      console.error("Delete comment error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Like comment (placeholder - would need Like model update to support comments)
  static async likeComment(req, res) {
    try {
      const { commentId } = req.params;
      const currentUser = req.user;

      const comment = await Comment.findOne({
        where: { id: commentId, isActive: true },
      });

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: "Comment not found",
        });
      }

      // Implementation would require extending Like model to support comments
      // For now, just increment the likes count
      await comment.increment("likesCount");

      res.json({
        success: true,
        message: "Comment liked successfully",
      });
    } catch (error) {
      console.error("Like comment error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Unlike comment
  static async unlikeComment(req, res) {
    try {
      const { commentId } = req.params;
      const currentUser = req.user;

      const comment = await Comment.findOne({
        where: { id: commentId, isActive: true },
      });

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: "Comment not found",
        });
      }

      await comment.decrement("likesCount");

      res.json({
        success: true,
        message: "Comment unliked successfully",
      });
    } catch (error) {
      console.error("Unlike comment error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = CommentController;
