const { Post, Comment } = require("../models");

const CommentController = {
  // Create a comment on a post
  createComment: async (req, res) => {
    try {
      const { postId } = req.params;
      const { content } = req.body;
      const currentUser = req.user;

      if (!content) {
        return res.status(400).json({
          success: false,
          message: "Comment content is required",
        });
      }

      const post = await Post.findByPk(postId);
      if (!post) {
        return res.status(404).json({
          success: false,
          message: "Post not found",
        });
      }

      const comment = await Comment.create({
        postId,
        userId: currentUser.id,
        content,
      });

      res.status(201).json({
        success: true,
        message: "Comment created successfully",
        data: { comment },
      });
    } catch (error) {
      console.error("Create comment error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
  // Get comments for a post
  getComments: async (req, res) => {
    try {
      const { postId } = req.params;
      const { page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;
      const post = await Post.findByPk(postId);
      if (!post) {
        return res.status(404).json({
          success: false,
          message: "Post not found",
        });
      }

      const comments = await Comment.findAll({
        where: { postId },
        limit,
        offset,
        order: [["createdAt", "DESC"]],
      });

      res.status(200).json({
        success: true,
        data: {
          comments,
          pagination: {
            page,
            limit,
          },
        },
      });
    } catch (error) {
      console.error("Get comments error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
  // Delete a comment
  deleteComment: async (req, res) => {
    try {
      const { commentId } = req.params;
      const currentUser = req.user;
      const comment = await Comment.findByPk(commentId);
      if (!comment) {
        return res.status(404).json({
          success: false,
          message: "Comment not found",
        });
      }
      if (comment.userId !== currentUser.id) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to delete this comment",
        });
      }
      await comment.destroy();
      res.status(200).json({
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
  },
  // Update a comment
  updateComment: async (req, res) => {
    try {
      const { commentId } = req.params;
      const { content } = req.body;
      const currentUser = req.user;
      if (!content) {
        return res.status(400).json({
          success: false,
          message: "Comment content is required",
        });
      }
      const comment = await Comment.findByPk(commentId);
      if (!comment) {
        return res.status(404).json({
          success: false,
          message: "Comment not found",
        });
      }
      if (comment.userId !== currentUser.id) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to update this comment",
        });
      }
      comment.content = content;
      await comment.save();
      res.status(200).json({
        success: true,
        message: "Comment updated successfully",
        data: { comment },
      });
    } catch (error) {
      console.error("Update comment error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};

module.exports = CommentController;
