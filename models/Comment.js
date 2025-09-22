// models/Comment.js
module.exports = (sequelize, DataTypes) => {
  const Comment = sequelize.define(
    "Comment",
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
      postId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "posts",
          key: "id",
        },
      },
      parentId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "comments",
          key: "id",
        },
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
          len: [1, 500],
        },
      },
      likesCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      repliesCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      indexes: [
        { fields: ["postId"] },
        { fields: ["userId"] },
        { fields: ["parentId"] },
        { fields: ["createdAt"] },
      ],
    }
  );

  Comment.associate = (models) => {
    Comment.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    Comment.belongsTo(models.Post, { foreignKey: "postId", as: "post" });
    Comment.belongsTo(models.Comment, { foreignKey: "parentId", as: "parent" });
    Comment.hasMany(models.Comment, { foreignKey: "parentId", as: "replies" });
  };

  return Comment;
};
