import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  // Server
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().default(3000),
  apiVersion: z.string().default('v1'),

  // Database
  databaseUrl: z.string(),
  databasePoolSize: z.coerce.number().default(20),
  databaseSsl: z.coerce.boolean().default(false),

  // Redis
  redisUrl: z.string().default('redis://localhost:6379'),
  redisPassword: z.string().optional(),

  // Bing Search API
  bingSearchApiKey: z.string(),
  bingSearchEndpoint: z.string().default('https://api.bing.microsoft.com/v7.0/search'),
  bingCustomConfigId: z.string().optional(),

  // Microsoft Ads API
  microsoftAdsClientId: z.string(),
  microsoftAdsClientSecret: z.string(),
  microsoftAdsDeveloperToken: z.string(),
  microsoftAdsRefreshToken: z.string(),
  microsoftAdsCustomerId: z.string(),
  microsoftAdsAccountId: z.string(),

  // Security
  jwtSecret: z.string(),
  jwtExpiresIn: z.string().default('7d'),
  apiKeySecret: z.string(),
  encryptionKey: z.string().min(32),

  // Rate Limiting
  rateLimitWindowMs: z.coerce.number().default(60000),
  rateLimitMaxRequests: z.coerce.number().default(100),

  // AWS/Cloud Storage
  awsRegion: z.string().default('us-east-1'),
  awsAccessKeyId: z.string().optional(),
  awsSecretAccessKey: z.string().optional(),
  s3BucketReceipts: z.string().default('ecosia-gaza-receipts'),

  // Logging
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  logFormat: z.enum(['json', 'pretty']).default('json'),

  // CORS
  corsOrigins: z.string().transform((val) => val.split(',')),

  // Admin
  adminEmail: z.string().email(),

  // Disbursement
  disbursementDayOfMonth: z.coerce.number().min(1).max(28).default(5),
  minimumDisbursementAmount: z.coerce.number().default(100),
});

const configData = {
  nodeEnv: process.env.NODE_ENV,
  port: process.env.PORT,
  apiVersion: process.env.API_VERSION,
  databaseUrl: process.env.DATABASE_URL,
  databasePoolSize: process.env.DATABASE_POOL_SIZE,
  databaseSsl: process.env.DATABASE_SSL,
  redisUrl: process.env.REDIS_URL,
  redisPassword: process.env.REDIS_PASSWORD,
  bingSearchApiKey: process.env.BING_SEARCH_API_KEY,
  bingSearchEndpoint: process.env.BING_SEARCH_ENDPOINT,
  bingCustomConfigId: process.env.BING_CUSTOM_CONFIG_ID,
  microsoftAdsClientId: process.env.MICROSOFT_ADS_CLIENT_ID,
  microsoftAdsClientSecret: process.env.MICROSOFT_ADS_CLIENT_SECRET,
  microsoftAdsDeveloperToken: process.env.MICROSOFT_ADS_DEVELOPER_TOKEN,
  microsoftAdsRefreshToken: process.env.MICROSOFT_ADS_REFRESH_TOKEN,
  microsoftAdsCustomerId: process.env.MICROSOFT_ADS_CUSTOMER_ID,
  microsoftAdsAccountId: process.env.MICROSOFT_ADS_ACCOUNT_ID,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  apiKeySecret: process.env.API_KEY_SECRET,
  encryptionKey: process.env.ENCRYPTION_KEY,
  rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS,
  rateLimitMaxRequests: process.env.RATE_LIMIT_MAX_REQUESTS,
  awsRegion: process.env.AWS_REGION,
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  s3BucketReceipts: process.env.S3_BUCKET_RECEIPTS,
  logLevel: process.env.LOG_LEVEL,
  logFormat: process.env.LOG_FORMAT,
  corsOrigins: process.env.CORS_ORIGINS || 'http://localhost:3000',
  adminEmail: process.env.ADMIN_EMAIL,
  disbursementDayOfMonth: process.env.DISBURSEMENT_DAY_OF_MONTH,
  minimumDisbursementAmount: process.env.MINIMUM_DISBURSEMENT_AMOUNT,
};

export const config = configSchema.parse(configData);

export type Config = z.infer<typeof configSchema>;
