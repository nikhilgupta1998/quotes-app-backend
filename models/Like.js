// models/Like.js
module.exports = (sequelize, DataTypes) => {
  const Like = sequelize.define(
    "Like",
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
    },
    {
      indexes: [
        { unique: true, fields: ["userId", "postId"] },
        { fields: ["postId"] },
        { fields: ["userId"] },
      ],
    }
  );

  Like.associate = (models) => {
    Like.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    Like.belongsTo(models.Post, { foreignKey: "postId", as: "post" });
  };

  return Like;
};
