/**
 * middleware/request-id.ts
 *
 * Fastify already generates a request ID via genReqId in app.ts.
 * This plugin ensures the ID is always echoed back in the response header
 * and is available as a consistent string on the request object.
 *
 * We register this as a plugin so it can be used with decorateRequest.
 */
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

const requestIdPlugin: FastifyPluginAsync = async (fastify) => {
  // Ensure request.user and request.rateLimitData are always initialised
  // before any middleware runs — Fastify requires decorateRequest to be called
  // before the property is accessed on the request object.
  fastify.decorateRequest('user', null);
  fastify.decorateRequest('rateLimitData', null);

  // Echo the request ID back in the response on every request
  fastify.addHook('onRequest', async (request, reply) => {
    reply.header('X-Request-Id', request.id);
  });
};

// fastify-plugin unwraps the encapsulation so decorateRequest is global
export const requestIdMiddleware = fp(requestIdPlugin, {
  name: 'request-id',
  fastify: '4.x',
});
