/**
 * openapi.ts — Registers @fastify/swagger and @fastify/swagger-ui.
 * The OpenAPI spec is auto-generated from route schemas defined inline.
 */
import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

/**
 * Tags that are internal-only and should be excluded from the public API docs.
 * These routes are still fully functional — they just won't appear in /docs.
 */
const INTERNAL_TAGS = new Set([
  'Account',
  'Auth',
  'System',
  'Billing',
  'Webhooks',
  'Admin',
]);


import type { FastifyInstance } from 'fastify';

export async function registerOpenApi(app: FastifyInstance) {
  await app.register(swagger, {
    // Hide internal routes from the generated OpenAPI spec.
    // The transform runs before shouldRouteHide(), so returning hide:true
    // here is equivalent to adding { schema: { hide: true } } to each route.
    transform({ schema, url }: { schema: Record<string, unknown>; url: string }) {
      const tags = (schema?.tags as string[] | undefined) ?? [];
      if (tags.some((t) => INTERNAL_TAGS.has(t))) {
        return { schema: { ...schema, hide: true }, url };
      }
      return { schema, url };
    },
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'VINSTUB.com API',
        description:
          'VIN stub lookup API — returns the Vehicle Descriptor Section (VIN stub) for a given year, make, model, and optional submodel.',
        version: '1.0.0',
        contact: {
          name: 'VINSTUB Support',
          email: 'support@vinstub.com',
          url: 'https://vinstub.com',
        },
        license: {
          name: 'Commercial',
          url: 'https://vinstub.com/legal/terms',
        },
      },
      servers: [
        { url: 'https://api.vinstub.com/v1', description: 'Production' },
        { url: 'http://localhost:3001/v1', description: 'Local development' },
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'API Key (vs_live_<48-hex-chars>)',
            description:
              'Pass your API key as a Bearer token. Example: `Authorization: Bearer vs_live_abc123...`',
          },
        },
        schemas: {
          ErrorResponse: {
            type: 'object',
            required: ['success', 'error', 'message', 'request_id'],
            properties: {
              success: { type: 'boolean', example: false },
              error: { type: 'string', example: 'rate_limit_exceeded' },
              message: { type: 'string' },
              retry_after: { type: 'integer', description: 'Seconds until retry (429 only)' },
              reset_at: { type: 'string', format: 'date-time' },
              upgrade_url: { type: 'string', format: 'uri' },
              request_id: { type: 'string', example: 'req_01J9AB3XYZ' },
            },
          },
        },
      },
      tags: [
        // Only public-facing tags are listed here. Internal tags (Account, Auth,
        // System, Billing, Webhooks, Admin) are hidden via the transform above.
        { name: 'VIN Lookup', description: 'Core VIN stub lookup endpoint' },
        { name: 'Reference', description: 'Vehicle makes and models reference data' },
      ],
    },
  });

  // Register ErrorResponse as a Fastify shared schema so routes can use
  // $ref: 'ErrorResponse#' in their serialization schemas.
  // (OpenAPI components.schemas is swagger metadata only — Fastify's serializer
  // does not read from it; addSchema() is the separate registry it uses.)
  app.addSchema({
    $id: 'ErrorResponse',
    type: 'object',
    required: ['success', 'error', 'message', 'request_id'],
    properties: {
      success: { type: 'boolean' },
      error: { type: 'string' },
      message: { type: 'string' },
      retry_after: { type: 'integer' },
      reset_at: { type: 'string' },
      upgrade_url: { type: 'string' },
      request_id: { type: 'string' },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      persistAuthorization: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });
}
