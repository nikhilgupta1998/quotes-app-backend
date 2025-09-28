// models/Post.js
module.exports = (sequelize, DataTypes) => {
  const Post = sequelize.define(
    "Post",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: true,
        validate: {
          len: [0, 2200],
        },
      },
      mediaUrls: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
      },
      mediaType: {
        type: DataTypes.ENUM("image", "video", "mixed"),
        allowNull: true,
      },
      location: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true,
      },
      longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true,
      },
      hashtags: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
      },
      mentions: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
      },
      likesCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      commentsCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      sharesCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      isPinned: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      visibility: {
        type: DataTypes.ENUM("public", "followers", "private"),
        defaultValue: "public",
      },
    },
    {
      tableName: "posts",
      indexes: [
        { fields: ["userId"] },
        { fields: ["createdAt"] },
        { fields: ["isActive"] },
        { fields: ["visibility"] },
        { fields: ["isPinned"] },
      ],
    }
  );

  Post.associate = (models) => {
    // User relationship
    Post.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });

    // Likes
    Post.hasMany(models.Like, {
      foreignKey: "postId",
      as: "likes",
      onDelete: "CASCADE",
    });

    // Comments
    Post.hasMany(models.Comment, {
      foreignKey: "postId",
      as: "comments",
      onDelete: "CASCADE",
    });
  };

  return Post;
};
