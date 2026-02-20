import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { AppError } from './utils/errors.js';

export async function buildApp() {
  const app = Fastify({
    logger: false,
    trustProxy: true,
  });

  await app.register(cors, {
    origin: config.isDev ? true : config.cors.origins.length ? config.cors.origins : false,
    credentials: true,
  });

  await app.register(jwt, {
    secret: config.jwt.secret,
  });

  await app.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB max file size
    },
  });

  app.addHook('onRequest', async (request) => {
    logger.info(
      {
        method: request.method,
        url: request.url,
        ip: request.ip,
      },
      'Incoming request'
    );
  });

  app.addHook('onResponse', async (request, reply) => {
    logger.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      'Request completed'
    );
  });

  app.setErrorHandler(async (error, _request, reply) => {
    if (error instanceof AppError) {
      logger.warn(
        {
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
        },
        'Application error'
      );
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
        details: error.details,
      });
    }

    if (error.validation) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: error.validation,
      });
    }

    logger.error(error, 'Unhandled error');
    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: config.isDev ? error.message : 'Internal server error',
    });
  });

  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
