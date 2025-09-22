// models/Conversation.js
module.exports = (sequelize, DataTypes) => {
  const Conversation = sequelize.define("Conversation", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    participants: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    lastMessageId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    lastMessageAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    isGroup: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    groupName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    groupImage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  });

  Conversation.associate = (models) => {
    Conversation.hasMany(models.Message, {
      foreignKey: "conversationId",
      as: "messages",
    });
  };

  return Conversation;
};
