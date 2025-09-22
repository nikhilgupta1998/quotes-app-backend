// models/User.js
const bcrypt = require("bcryptjs");

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      username: {
        type: DataTypes.STRING(30),
        unique: true,
        allowNull: false,
        validate: {
          len: [3, 30],
          isAlphanumeric: true,
        },
      },
      email: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: true,
        validate: {
          isEmail: true,
        },
      },
      mobile: {
        type: DataTypes.STRING(15),
        unique: true,
        allowNull: true,
        validate: {
          is: /^[\+]?[1-9][\d]{0,15}$/,
        },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          len: [6, 100],
        },
      },
      firstName: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          len: [1, 50],
        },
      },
      lastName: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          len: [1, 50],
        },
      },
      profilePicture: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      coverPhoto: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      bio: {
        type: DataTypes.TEXT,
        allowNull: true,
        validate: {
          len: [0, 500],
        },
      },
      dateOfBirth: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      gender: {
        type: DataTypes.ENUM("male", "female", "other"),
        allowNull: true,
      },
      location: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      website: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isUrl: true,
        },
      },
      isEmailVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      isMobileVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      isPrivate: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      lastActiveAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      emailVerificationToken: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      mobileVerificationCode: {
        type: DataTypes.STRING(6),
        allowNull: true,
      },
      mobileVerificationExpires: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      passwordResetToken: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      passwordResetExpires: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      refreshToken: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      followersCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      followingCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      postsCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
    },
    {
      hooks: {
        beforeSave: async (user) => {
          if (user.changed("password")) {
            const salt = await bcrypt.genSalt(12);
            user.password = await bcrypt.hash(user.password, salt);
          }
        },
      },
      indexes: [
        { fields: ["email"] },
        { fields: ["mobile"] },
        { fields: ["username"] },
        { fields: ["isActive"] },
        { fields: ["createdAt"] },
      ],
    }
  );

  User.associate = (models) => {
    // Posts
    User.hasMany(models.Post, {
      foreignKey: "userId",
      as: "posts",
      onDelete: "CASCADE",
    });

    // Followers (users who follow this user)
    User.hasMany(models.Follow, {
      foreignKey: "followingId",
      as: "followers",
      onDelete: "CASCADE",
    });

    // Following (users this user follows)
    User.hasMany(models.Follow, {
      foreignKey: "followerId",
      as: "following",
      onDelete: "CASCADE",
    });

    // Likes
    User.hasMany(models.Like, {
      foreignKey: "userId",
      as: "likes",
      onDelete: "CASCADE",
    });

    // Comments
    User.hasMany(models.Comment, {
      foreignKey: "userId",
      as: "comments",
      onDelete: "CASCADE",
    });

    // Stories
    User.hasMany(models.Story, {
      foreignKey: "userId",
      as: "stories",
      onDelete: "CASCADE",
    });

    // Messages
    User.hasMany(models.Message, {
      foreignKey: "senderId",
      as: "sentMessages",
      onDelete: "CASCADE",
    });

    User.hasMany(models.Message, {
      foreignKey: "receiverId",
      as: "receivedMessages",
      onDelete: "CASCADE",
    });

    // Notifications
    User.hasMany(models.Notification, {
      foreignKey: "userId",
      as: "notifications",
      onDelete: "CASCADE",
    });
  };

  // Instance methods
  User.prototype.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  };

  User.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.password;
    delete values.refreshToken;
    delete values.emailVerificationToken;
    delete values.mobileVerificationCode;
    delete values.mobileVerificationExpires;
    delete values.passwordResetToken;
    delete values.passwordResetExpires;
    return values;
  };

  return User;
};
