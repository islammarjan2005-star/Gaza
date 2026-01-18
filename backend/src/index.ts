import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config';
import routes from './routes';
import { privacyMiddleware } from './middleware/privacy';
import { apiLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { closePool } from './config/database';
import { closeRedis } from './config/redis';

const app = express();

// Trust proxy for rate limiting behind load balancer
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS
app.use(cors({
  origin: config.corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Token', 'X-API-Key', 'X-Privacy-Consent'],
  credentials: true,
  maxAge: 86400,
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
if (config.nodeEnv !== 'test') {
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => {
        logger.info(message.trim());
      },
    },
  }));
}

// Privacy middleware
app.use(privacyMiddleware);

// Rate limiting
app.use(apiLimiter);

// API routes
app.use(`/api/${config.apiVersion}`, routes);

// Legacy route support (redirect /api/search to /api/v1/search)
app.use('/api/search', (req, res) => {
  res.redirect(301, `/api/${config.apiVersion}/search${req.url}`);
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, starting graceful shutdown`);

  try {
    await closePool();
    await closeRedis();
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: (error as Error).message });
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled rejection handler
process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled rejection', { reason: reason?.message || reason });
});

// Uncaught exception handler
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Start server
const server = app.listen(config.port, () => {
  logger.info(`Server started on port ${config.port}`, {
    env: config.nodeEnv,
    apiVersion: config.apiVersion,
  });
});

// Server timeout
server.timeout = 30000;
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

export default app;
