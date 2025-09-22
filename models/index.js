const { Sequelize } = require("sequelize");
const config = require("../config/database.js")[
  process.env.NODE_ENV || "development"
];

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  config
);

const db = {};

// Import models
const User = require("./User")(sequelize, Sequelize.DataTypes);
const Post = require("./Post")(sequelize, Sequelize.DataTypes);
const Like = require("./Like")(sequelize, Sequelize.DataTypes);
const Comment = require("./Comment")(sequelize, Sequelize.DataTypes);
const Follow = require("./Follow")(sequelize, Sequelize.DataTypes);
const Story = require("./Story")(sequelize, Sequelize.DataTypes);
const Message = require("./Message")(sequelize, Sequelize.DataTypes);
const Conversation = require("./Conversation")(sequelize, Sequelize.DataTypes);
const Notification = require("./Notification")(sequelize, Sequelize.DataTypes);

// Add models to db object
db.User = User;
db.Post = Post;
db.Like = Like;
db.Comment = Comment;
db.Follow = Follow;
db.Story = Story;
db.Message = Message;
db.Conversation = Conversation;
db.Notification = Notification;

// Define associations
Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
