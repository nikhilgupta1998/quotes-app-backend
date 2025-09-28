// server.js
const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
// const cron = require("node-cron");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// Import database and routes
const db = require("./models");
const routes = require("./routes");
const { generalLimiter } = require("./middleware/rateLimiter");
// const NotificationHelper = require("./utils/notificationHelper");
// const EmailNotifications = require("./utils/emailNotifications");

const app = express();
const server = http.createServer(app);

// Socket.IO setup with CORS
const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    allowedHeaders: ["Authorization"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// Make io available globally
app.set("io", io);

// Security middleware
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
  })
);

// Compression middleware
app.use(compression());

// CORS middleware
// app.use(
//   cors({
//     origin: function (origin, callback) {
//       const allowedOrigins = [
//         process.env.FRONTEND_URL || "http://localhost:3000",
//         "http://localhost:3001",
//         "https://your-domain.com",
//       ];
//       if (!origin || allowedOrigins.includes(origin)) {
//         callback(null, true);
//       } else {
//         callback(new Error("Not allowed by CORS"));
//       }
//     },
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
//   })
// );

app.use(cors());

// Logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Body parsing middleware
app.use(
  express.json({
    limit: "50mb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "50mb",
  })
);

// Request ID middleware for tracking
app.use((req, res, next) => {
  req.requestId = Math.random().toString(36).substring(7);
  res.setHeader("X-Request-ID", req.requestId);
  next();
});

// Rate limiting middleware
app.use("/api", generalLimiter);

// Health check endpoint (before rate limiting)
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Social Media API is healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
  });
});

// API routes
app.use("/api", routes);

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return next(new Error("Authentication token required"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { User } = require("./models");

    const user = await User.findOne({
      where: {
        id: decoded.userId,
        isActive: true,
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
    });

    if (!user) {
      return next(new Error("User not found or inactive"));
    }

    socket.userId = user.id;
    socket.user = user;
    socket.username = user.username;
    next();
  } catch (error) {
    console.error("Socket authentication error:", error);
    next(new Error("Authentication failed"));
  }
});

// Active users management
const activeUsers = new Map();
const userSockets = new Map(); // userId -> Set of socket IDs

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`✅ User ${socket.user.username} connected (${socket.id})`);

  // Store active user
  activeUsers.set(socket.userId, {
    socketId: socket.id,
    user: socket.user,
    lastSeen: new Date(),
    status: "online",
  });

  // Track multiple sockets per user
  if (!userSockets.has(socket.userId)) {
    userSockets.set(socket.userId, new Set());
  }
  userSockets.get(socket.userId).add(socket.id);

  // Join user to their personal room
  socket.join(`user_${socket.userId}`);

  // Update user's last active time
  socket.user.update({ lastActiveAt: new Date() });

  // Emit user online status to followers
  socket.broadcast.emit("user_online", {
    userId: socket.userId,
    username: socket.user.username,
    status: "online",
    lastSeen: new Date(),
  });

  // Send user their unread notification count
  socket.emit("unread_count", { count: 0 }); // You can implement actual count

  // Handle joining conversation rooms
  socket.on("join_conversation", async (data) => {
    try {
      const { conversationId } = data;
      const { Conversation } = require("./models");
      const { Op } = require("sequelize");

      // Verify user has access to conversation
      const conversation = await Conversation.findOne({
        where: {
          id: conversationId,
          participants: {
            [Op.contains]: [socket.userId],
          },
        },
      });

      if (conversation) {
        socket.join(`conversation_${conversationId}`);
        console.log(
          `📝 User ${socket.user.username} joined conversation ${conversationId}`
        );

        socket.emit("joined_conversation", { conversationId });
      } else {
        socket.emit("error", { message: "Access denied to conversation" });
      }
    } catch (error) {
      console.error("Join conversation error:", error);
      socket.emit("error", { message: "Failed to join conversation" });
    }
  });

  // Handle leaving conversation rooms
  socket.on("leave_conversation", (data) => {
    const { conversationId } = data;
    socket.leave(`conversation_${conversationId}`);
    console.log(
      `📝 User ${socket.user.username} left conversation ${conversationId}`
    );
    socket.emit("left_conversation", { conversationId });
  });

  // Handle new messages
  socket.on("send_message", async (data) => {
    try {
      const { conversationId, content, mediaUrl, mediaType = "text" } = data;

      // Verify user has access to conversation
      const { Conversation, Message, User } = require("./models");
      const { Op } = require("sequelize");

      const conversation = await Conversation.findOne({
        where: {
          id: conversationId,
          participants: {
            [Op.contains]: [socket.userId],
          },
        },
      });

      if (!conversation) {
        socket.emit("error", { message: "Invalid conversation access" });
        return;
      }

      // Create message
      const message = await Message.create({
        conversationId,
        senderId: socket.userId,
        content: content || "",
        mediaUrl,
        mediaType,
      });

      // Update conversation
      await conversation.update({
        lastMessageId: message.id,
        lastMessageAt: new Date(),
      });

      // Fetch message with sender info
      const messageWithSender = await Message.findByPk(message.id, {
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

      // Emit to conversation room
      io.to(`conversation_${conversationId}`).emit(
        "new_message",
        messageWithSender
      );

      // Send notifications to offline participants
      const otherParticipants = conversation.participants.filter(
        (id) => id !== socket.userId
      );
      for (const participantId of otherParticipants) {
        // Check if user is online
        const isOnline = activeUsers.has(participantId);

        if (!isOnline) {
          // Send push notification for offline users
          // await NotificationHelper.notifyMessage(
          //   participantId,
          //   socket.user,
          //   conversation
          // );
        } else {
          // Send real-time notification badge update for online users
          io.to(`user_${participantId}`).emit("new_message_notification", {
            conversationId,
            senderId: socket.userId,
            senderName: `${socket.user.firstName} ${socket.user.lastName}`,
            preview: content ? content.substring(0, 50) : "Sent a media file",
          });
        }
      }

      // Confirm message sent
      socket.emit("message_sent", {
        messageId: message.id,
        tempId: data.tempId, // For client-side message tracking
      });
    } catch (error) {
      console.error("Send message error:", error);
      socket.emit("message_error", {
        message: "Failed to send message",
        tempId: data.tempId,
      });
    }
  });

  // Handle message read receipts
  socket.on("message_read", async (data) => {
    try {
      const { messageId, conversationId } = data;
      const { Message } = require("./models");

      const message = await Message.findOne({
        where: {
          id: messageId,
          conversationId,
        },
      });

      if (message && message.senderId !== socket.userId) {
        await message.update({
          isRead: true,
          readAt: new Date(),
        });

        // Emit read receipt to conversation
        socket.to(`conversation_${conversationId}`).emit("message_read", {
          messageId,
          readBy: socket.userId,
          readByName: `${socket.user.firstName} ${socket.user.lastName}`,
          readAt: new Date(),
        });
      }
    } catch (error) {
      console.error("Message read error:", error);
    }
  });

  // Handle typing indicators
  socket.on("typing_start", (data) => {
    const { conversationId } = data;
    socket.to(`conversation_${conversationId}`).emit("user_typing", {
      userId: socket.userId,
      username: socket.user.username,
      firstName: socket.user.firstName,
      isTyping: true,
    });
  });

  socket.on("typing_stop", (data) => {
    const { conversationId } = data;
    socket.to(`conversation_${conversationId}`).emit("user_typing", {
      userId: socket.userId,
      username: socket.user.username,
      firstName: socket.user.firstName,
      isTyping: false,
    });
  });

  // Handle user status updates
  socket.on("status_update", (data) => {
    const { status } = data; // 'online', 'away', 'busy', 'offline'

    if (activeUsers.has(socket.userId)) {
      activeUsers.get(socket.userId).status = status;
    }

    socket.broadcast.emit("user_status_changed", {
      userId: socket.userId,
      username: socket.user.username,
      status,
      timestamp: new Date(),
    });
  });

  // Handle video call signaling
  socket.on("call_initiate", async (data) => {
    try {
      const { targetUserId, offer, callType = "video" } = data; // 'video' or 'audio'

      // Check if target user is online
      if (activeUsers.has(targetUserId)) {
        socket.to(`user_${targetUserId}`).emit("incoming_call", {
          callerId: socket.userId,
          callerName: `${socket.user.firstName} ${socket.user.lastName}`,
          callerAvatar: socket.user.profilePicture,
          offer,
          callType,
          timestamp: new Date(),
        });
      } else {
        socket.emit("call_failed", {
          message: "User is offline",
          targetUserId,
        });
      }
    } catch (error) {
      console.error("Call initiate error:", error);
      socket.emit("call_error", { message: "Failed to initiate call" });
    }
  });

  socket.on("call_answer", (data) => {
    const { callerId, answer } = data;
    socket.to(`user_${callerId}`).emit("call_answered", {
      answer,
      answererId: socket.userId,
      answererName: `${socket.user.firstName} ${socket.user.lastName}`,
    });
  });

  socket.on("call_reject", (data) => {
    const { callerId, reason = "declined" } = data;
    socket.to(`user_${callerId}`).emit("call_rejected", {
      rejectedBy: socket.userId,
      rejectedByName: `${socket.user.firstName} ${socket.user.lastName}`,
      reason,
    });
  });

  socket.on("call_end", (data) => {
    const { targetUserId } = data;
    socket.to(`user_${targetUserId}`).emit("call_ended", {
      endedBy: socket.userId,
      endedByName: `${socket.user.firstName} ${socket.user.lastName}`,
      timestamp: new Date(),
    });
  });

  socket.on("ice_candidate", (data) => {
    const { targetUserId, candidate } = data;
    socket.to(`user_${targetUserId}`).emit("ice_candidate", {
      candidate,
      from: socket.userId,
    });
  });

  // Handle live post updates
  socket.on("post_like", async (data) => {
    try {
      const { postId, action } = data; // action: 'like' or 'unlike'

      // Emit to all users following this post's updates
      socket.broadcast.emit("post_updated", {
        postId,
        action,
        userId: socket.userId,
        username: socket.user.username,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Post like broadcast error:", error);
    }
  });

  // Handle live story views
  socket.on("story_view", (data) => {
    const { storyId, ownerId } = data;

    // Notify story owner of the view
    socket.to(`user_${ownerId}`).emit("story_viewed", {
      storyId,
      viewerId: socket.userId,
      viewerName: `${socket.user.firstName} ${socket.user.lastName}`,
      viewerAvatar: socket.user.profilePicture,
      timestamp: new Date(),
    });
  });

  // Handle errors
  socket.on("error", (error) => {
    console.error("Socket error:", error);
    socket.emit("error_response", { message: "An error occurred" });
  });

  // Handle disconnect
  socket.on("disconnect", (reason) => {
    console.log(
      `❌ User ${socket.user.username} disconnected: ${reason} (${socket.id})`
    );

    // Remove socket from user's socket set
    if (userSockets.has(socket.userId)) {
      userSockets.get(socket.userId).delete(socket.id);

      // If no more sockets for this user, mark as offline
      if (userSockets.get(socket.userId).size === 0) {
        userSockets.delete(socket.userId);
        activeUsers.delete(socket.userId);

        // Update last seen in database
        socket.user.update({ lastActiveAt: new Date() });

        // Emit user offline status
        socket.broadcast.emit("user_offline", {
          userId: socket.userId,
          username: socket.user.username,
          lastSeen: new Date(),
        });
      }
    }
  });

  // Handle manual disconnect
  socket.on("manual_disconnect", () => {
    socket.disconnect();
  });
});

// Export io for use in other parts of the application
module.exports.io = io;

// Cron jobs for maintenance and cleanup
// console.log("🕐 Setting up cron jobs...");

// Clean up expired stories every hour
// cron.schedule("0 * * * *", async () => {
//   try {
//     const { Story } = require("./models");
//     const { Op } = require("sequelize");

//     const result = await Story.update(
//       { isActive: false },
//       {
//         where: {
//           expiresAt: { [Op.lt]: new Date() },
//           isActive: true,
//         },
//       }
//     );

//     if (result[0] > 0) {
//       console.log(`🧹 Cleaned up ${result[0]} expired stories`);
//     }
//   } catch (error) {
//     console.error("Story cleanup error:", error);
//   }
// });

// // Clean up old notifications (older than 30 days) - daily at midnight
// cron.schedule("0 0 * * *", async () => {
//   try {
//     const { Notification } = require("./models");
//     const { Op } = require("sequelize");

//     const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

//     const result = await Notification.destroy({
//       where: {
//         createdAt: { [Op.lt]: thirtyDaysAgo },
//         isRead: true, // Only delete read notifications
//       },
//     });

//     if (result > 0) {
//       console.log(`🧹 Cleaned up ${result} old notifications`);
//     }
//   } catch (error) {
//     console.error("Notification cleanup error:", error);
//   }
// });

// Send weekly digest emails - every Sunday at 9 AM
// cron.schedule("0 9 * * 0", async () => {
//   try {
//     if (process.env.NODE_ENV === "production") {
//       const { User, Notification } = require("./models");
//       const { Op } = require("sequelize");

//       const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

//       const users = await User.findAll({
//         where: {
//           isActive: true,
//           isEmailVerified: true,
//           email: { [Op.ne]: null },
//         },
//         include: [
//           {
//             model: Notification,
//             as: "notifications",
//             where: {
//               createdAt: { [Op.gte]: oneWeekAgo },
//               isRead: false,
//             },
//             required: false,
//           },
//         ],
//       });

//       let emailsSent = 0;
//       for (const user of users) {
//         if (user.notifications && user.notifications.length >= 3) {
//           // Only send if 3+ notifications
//           try {
//             await EmailNotifications.sendWeeklyDigest(user, user.notifications);
//             emailsSent++;
//           } catch (emailError) {
//             console.error(
//               `Failed to send digest to ${user.email}:`,
//               emailError
//             );
//           }
//         }
//       }

//       console.log(`📧 Sent ${emailsSent} weekly email digests`);
//     }
//   } catch (error) {
//     console.error("Weekly digest error:", error);
//   }
// });

// // Cleanup inactive socket connections every 5 minutes
// cron.schedule("*/5 * * * *", () => {
//   const now = Date.now();
//   let cleaned = 0;

//   for (const [userId, userData] of activeUsers.entries()) {
//     // Remove users inactive for more than 30 minutes
//     if (now - userData.lastSeen.getTime() > 30 * 60 * 1000) {
//       activeUsers.delete(userId);
//       cleaned++;
//     }
//   }

//   if (cleaned > 0) {
//     console.log(`🧹 Cleaned up ${cleaned} inactive socket connections`);
//   }
// });

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`❌ Error ${req.requestId}:`, err.stack);

  // Sequelize validation errors
  if (err.name === "SequelizeValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors: err.errors.map((e) => ({
        field: e.path,
        message: e.message,
      })),
    });
  }

  // Sequelize unique constraint errors
  if (err.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({
      success: false,
      message: "Resource already exists",
      field: err.errors[0]?.path,
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }

  // Multer file upload errors
  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size too large",
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Too many files",
      });
    }
  }

  // Default error response
  res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
    requestId: req.requestId,
  });
});

// 404 handler
// app.use("*", (req, res) => {
//   res.status(404).json({
//     success: false,
//     message: "Endpoint not found",
//     path: req.originalUrl,
//     method: req.method,
//   });
// });

// Database connection and server startup
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";

const startServer = async () => {
  try {
    console.log("🚀 Starting Social Media Backend Server...");

    // Test database connection
    await db.sequelize.authenticate();
    console.log("✅ Database connection established successfully");

    // Sync database models
    if (process.env.NODE_ENV === "development") {
      await db.sequelize.sync({ force: false });
      console.log("✅ Database models synchronized (development mode)");
    } else {
      await db.sequelize.sync();
      console.log("✅ Database models verified");
    }

    // Start HTTP server with Socket.IO
    server.listen(PORT, HOST, () => {
      console.log("");
      console.log("🎉 =================================== 🎉");
      console.log("🚀 Social Media Backend Server Started");
      console.log("🎉 =================================== 🎉");
      console.log("");
      console.log(`🌐 Server URL: http://${HOST}:${PORT}`);
      console.log(`📱 Socket.IO: Ready for real-time connections`);
      console.log(`🗄️  Database: Connected to MySQL`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`⚡ API Base: http://${HOST}:${PORT}/api`);
      console.log(`💓 Health Check: http://${HOST}:${PORT}/health`);
      console.log("");
      console.log("📋 Available Services:");
      console.log("  ✅ User Authentication (Email/Mobile)");
      console.log("  ✅ Posts & Comments");
      console.log("  ✅ Real-time Messaging");
      console.log("  ✅ Stories & Media Upload");
      console.log("  ✅ Follow System & Notifications");
      console.log("  ✅ Video Call Signaling");
      console.log("");
    });

    // Log active users count every minute (development only)
    if (process.env.NODE_ENV === "development") {
      setInterval(() => {
        const activeCount = activeUsers.size;
        if (activeCount > 0) {
          console.log(`👥 Active users: ${activeCount}`);
        }
      }, 60000);
    }
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    console.log("🔌 HTTP server closed");

    try {
      // Close database connections
      await db.sequelize.close();
      console.log("🗄️  Database connections closed");

      // Notify all connected users about server shutdown
      io.emit("server_shutdown", {
        message: "Server is restarting. You will be reconnected automatically.",
        timestamp: new Date(),
      });

      // Close Socket.IO
      io.close(() => {
        console.log("📱 Socket.IO server closed");
        console.log("✅ Graceful shutdown completed");
        process.exit(0);
      });
    } catch (error) {
      console.error("❌ Error during shutdown:", error);
      process.exit(1);
    }
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error("⚠️  Forcing shutdown after timeout");
    process.exit(1);
  }, 10000);
};

// Handle process termination
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("💥 Uncaught Exception:", error);
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
  gracefulShutdown("UNHANDLED_REJECTION");
});

// Start the server
startServer();

// Export app for testing
module.exports = app;
