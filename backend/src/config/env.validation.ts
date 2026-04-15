import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // NODE_ENV: Joi.string()
  //   .valid('development', 'production', 'test')
  //   .default('development'),
  // PORT: Joi.number().default(3000),

  DATABASE_URL: Joi.string().required(),

  // JWT_SECRET: Joi.string().min(32).required(),
  // JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  // JWT_ACCESS_EXPIRY: Joi.string().default('7d'),
  // JWT_REFRESH_EXPIRY: Joi.string().default('30d'),

  // REDIS_URL: Joi.string().required(),

  // GEMINI_API_KEY: Joi.string().required(),

  // FRONTEND_URL: Joi.string().required(),

  //   MAIL_HOST: Joi.string().required(),
  //   MAIL_PORT: Joi.number().default(587),
  //   MAIL_USER: Joi.string().required(),
  //   MAIL_PASS: Joi.string().required(),
  //   MAIL_FROM: Joi.string().required(),
});
