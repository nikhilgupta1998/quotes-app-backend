// models/Follow.js
module.exports = (sequelize, DataTypes) => {
  const Follow = sequelize.define(
    "Follow",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      followerId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
      followingId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
      status: {
        type: DataTypes.ENUM("pending", "accepted"),
        defaultValue: "accepted",
      },
    },
    {
      indexes: [
        { unique: true, fields: ["followerId", "followingId"] },
        { fields: ["followerId"] },
        { fields: ["followingId"] },
        { fields: ["status"] },
      ],
    }
  );

  Follow.associate = (models) => {
    Follow.belongsTo(models.User, { foreignKey: "followerId", as: "follower" });
    Follow.belongsTo(models.User, {
      foreignKey: "followingId",
      as: "following",
    });
  };

  return Follow;
};
