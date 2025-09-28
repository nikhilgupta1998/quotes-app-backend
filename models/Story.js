module.exports = (sequelize, DataTypes) => {
  const Story = sequelize.define(
    "Story",
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
      mediaUrl: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      mediaType: {
        type: DataTypes.ENUM("image", "video"),
        allowNull: false,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      viewsCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: "stories",
      indexes: [
        { fields: ["userId"] },
        { fields: ["expiresAt"] },
        { fields: ["isActive"] },
      ],
    }
  );

  Story.associate = (models) => {
    Story.belongsTo(models.User, { foreignKey: "userId", as: "user" });
  };

  return Story;
};
