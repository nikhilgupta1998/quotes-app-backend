const Joi = require("joi");

const validateRegistration = (data) => {
  const schema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().when("mobile", {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required(),
    }),
    mobile: Joi.string()
      .pattern(/^[\+]?[1-9][\d]{0,15}$/)
      .when("email", {
        is: Joi.exist(),
        then: Joi.optional(),
        otherwise: Joi.required(),
      }),
    password: Joi.string().min(6).max(100).required(),
    firstName: Joi.string().min(1).max(50).required(),
    lastName: Joi.string().min(1).max(50).required(),
  }).xor("email", "mobile"); // Either email or mobile must be provided, but not both

  return schema.validate(data);
};

const validateLogin = (data) => {
  const schema = Joi.object({
    identifier: Joi.string().required(), // can be email, mobile, or username
    password: Joi.string().required(),
  });

  return schema.validate(data);
};

const validatePost = (data) => {
  const schema = Joi.object({
    content: Joi.string().max(2200).optional(),
    location: Joi.string().max(100).optional(),
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),
    visibility: Joi.string()
      .valid("public", "followers", "private")
      .default("public"),
  });

  return schema.validate(data);
};

const validateComment = (data) => {
  const schema = Joi.object({
    content: Joi.string().min(1).max(500).required(),
    parentId: Joi.string().uuid().optional(),
  });

  return schema.validate(data);
};

module.exports = {
  validateRegistration,
  validateLogin,
  validatePost,
  validateComment,
};
