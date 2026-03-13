import { NextResponse } from 'next/server';

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'MES MVP API',
    description:
      'Manufacturing Execution System API for motor assembly operations. Follows ISA-95 Level 3 principles with event-driven architecture.',
    version: '1.0.0',
    contact: {
      name: 'MES Support',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'Current server',
    },
  ],
  tags: [
    { name: 'Health', description: 'System health and readiness checks' },
    { name: 'Work Orders', description: 'Work order management' },
    { name: 'Stations', description: 'Station operations and execution' },
    { name: 'Quality', description: 'NCR disposition and quality management' },
    { name: 'AI', description: 'AI-powered insights and analysis' },
    { name: 'Simulation', description: 'Production simulation for demos' },
    { name: 'Auth', description: 'Authentication tracking' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'System health check',
        description:
          'Returns system health status including database connectivity, memory usage, uptime, and entity counts.',
        operationId: 'getHealth',
        responses: {
          '200': {
            description: 'System is healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
                example: {
                  status: 'healthy',
                  timestamp: '2026-03-12T10:00:00.000Z',
                  uptime: 3600,
                  version: '1.0.0',
                  database: {
                    status: 'connected',
                    lastEventAt: '2026-03-12T09:59:55.000Z',
                    counts: { workOrders: 5, units: 120, events: 1500 },
                  },
                  memory: { heapUsed: 85, heapTotal: 128, rss: 150, unit: 'MB' },
                },
              },
            },
          },
          '503': {
            description: 'System is unhealthy (database disconnected)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    },
    '/ready': {
      get: {
        tags: ['Health'],
        summary: 'Readiness probe',
        description:
          'Kubernetes-style readiness probe. Returns 200 only when the application is fully ready to serve traffic: database connected, migrations applied, seed data exists.',
        operationId: 'getReady',
        responses: {
          '200': {
            description: 'Application is ready',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ready: { type: 'boolean', example: true },
                    checks: {
                      type: 'object',
                      properties: {
                        database: { type: 'string', example: 'ok' },
                        migrations: { type: 'string', example: 'ok' },
                        seedData: { type: 'string', example: 'ok' },
                      },
                    },
                  },
                },
              },
            },
          },
          '503': {
            description: 'Application is not ready',
          },
        },
      },
    },
    '/admin/work-orders': {
      get: {
        tags: ['Work Orders'],
        summary: 'List all work orders',
        description:
          'Returns all work orders with site, routing, and unit count information. Requires admin or supervisor role.',
        operationId: 'listWorkOrders',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'List of work orders',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    workOrders: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/WorkOrder' },
                    },
                    sites: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/SiteRef' },
                    },
                    routings: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/RoutingRef' },
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
      post: {
        tags: ['Work Orders'],
        summary: 'Create a new work order',
        description:
          'Creates a new work order with the specified parameters. Requires admin or supervisor role.',
        operationId: 'createWorkOrder',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateWorkOrderRequest' },
              example: {
                orderNumber: 'WO-2026-001',
                partNumber: 'MOTOR-A100',
                quantity: 50,
                priority: 2,
                siteId: 'site-uuid',
                routingId: 'routing-uuid',
                dueDate: '2026-04-01T00:00:00.000Z',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Work order created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WorkOrder' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/station/{stationId}/operation': {
      get: {
        tags: ['Stations'],
        summary: 'Get current operation for station',
        description:
          'Returns the current operation details for a specific station and work order, including process steps, quality checks, and material requirements.',
        operationId: 'getStationOperation',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'stationId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'Station UUID',
          },
          {
            name: 'workOrderId',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'Work order UUID',
          },
        ],
        responses: {
          '200': {
            description: 'Operation details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OperationDetail' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': {
            description: 'Station or operation not found',
          },
        },
      },
    },
    '/ncr/{id}/disposition': {
      post: {
        tags: ['Quality'],
        summary: 'Disposition an NCR',
        description:
          'Dispositions a Non-Conformance Record with the specified action (use-as-is, rework, scrap, return-to-vendor). Requires supervisor or admin role. Emits ncr_dispositioned event.',
        operationId: 'dispositionNCR',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'NCR UUID',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DispositionRequest' },
              example: {
                disposition: 'rework',
                notes: 'Rework stator winding on station 2',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'NCR dispositioned successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    ncr: { $ref: '#/components/schemas/NCR' },
                  },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { description: 'NCR not found' },
        },
      },
    },
    '/ai/analyze': {
      post: {
        tags: ['AI'],
        summary: 'AI production analysis',
        description:
          'Analyzes production data using AI to identify bottlenecks, quality issues, and optimization opportunities.',
        operationId: 'aiAnalyze',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  context: { type: 'string', description: 'Analysis context or question' },
                },
                required: ['context'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Analysis result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    analysis: { type: 'string' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/ai/chat': {
      post: {
        tags: ['AI'],
        summary: 'AI chat assistant',
        description:
          'Conversational AI assistant for MES operations. Answers questions about production, quality, and operations.',
        operationId: 'aiChat',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  messages: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        role: { type: 'string', enum: ['user', 'assistant'] },
                        content: { type: 'string' },
                      },
                    },
                  },
                },
                required: ['messages'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Chat response (streaming)',
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/ai/insights': {
      get: {
        tags: ['AI'],
        summary: 'Get AI-generated insights',
        description:
          'Returns AI-generated insights about current production performance, bottlenecks, and recommendations.',
        operationId: 'getAIInsights',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'AI insights',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    insights: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          type: { type: 'string' },
                          title: { type: 'string' },
                          description: { type: 'string' },
                          severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/simulation/tick': {
      post: {
        tags: ['Simulation'],
        summary: 'Advance simulation by one tick',
        description:
          'Creates a random production event (new unit, advance station, complete unit, start/end downtime) for demo purposes.',
        operationId: 'simulationTick',
        responses: {
          '200': {
            description: 'Simulation event created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    action: { type: 'string' },
                    details: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/simulation/downtime': {
      post: {
        tags: ['Simulation'],
        summary: 'Simulate downtime event',
        description: 'Creates or ends a simulated downtime event at a random station.',
        operationId: 'simulateDowntime',
        responses: {
          '200': {
            description: 'Downtime event created/ended',
          },
        },
      },
    },
    '/auth/track': {
      post: {
        tags: ['Auth'],
        summary: 'Track user login',
        description: 'Records a user login event for audit trail purposes.',
        operationId: 'trackAuth',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  action: { type: 'string', enum: ['login', 'logout'] },
                },
                required: ['action'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Auth event tracked',
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http' as const,
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Clerk JWT token or API key',
      },
    },
    schemas: {
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['healthy', 'unhealthy'] },
          timestamp: { type: 'string', format: 'date-time' },
          uptime: { type: 'integer', description: 'Uptime in seconds' },
          version: { type: 'string' },
          database: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['connected', 'disconnected'] },
              lastEventAt: { type: 'string', format: 'date-time', nullable: true },
              counts: {
                type: 'object',
                properties: {
                  workOrders: { type: 'integer' },
                  units: { type: 'integer' },
                  events: { type: 'integer' },
                },
              },
            },
          },
          memory: {
            type: 'object',
            properties: {
              heapUsed: { type: 'integer' },
              heapTotal: { type: 'integer' },
              rss: { type: 'integer' },
              unit: { type: 'string' },
            },
          },
        },
      },
      WorkOrder: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          orderNumber: { type: 'string' },
          partNumber: { type: 'string' },
          quantity: { type: 'integer' },
          completedQuantity: { type: 'integer' },
          status: {
            type: 'string',
            enum: ['draft', 'released', 'in_progress', 'completed', 'cancelled'],
          },
          priority: { type: 'integer', minimum: 1, maximum: 5 },
          dueDate: { type: 'string', format: 'date-time', nullable: true },
          siteId: { type: 'string', format: 'uuid' },
          routingId: { type: 'string', format: 'uuid', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateWorkOrderRequest: {
        type: 'object',
        required: ['orderNumber', 'partNumber', 'quantity', 'siteId'],
        properties: {
          orderNumber: { type: 'string' },
          partNumber: { type: 'string' },
          quantity: { type: 'integer', minimum: 1 },
          priority: { type: 'integer', minimum: 1, maximum: 5, default: 3 },
          siteId: { type: 'string', format: 'uuid' },
          routingId: { type: 'string', format: 'uuid' },
          dueDate: { type: 'string', format: 'date-time' },
        },
      },
      SiteRef: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
        },
      },
      RoutingRef: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
        },
      },
      OperationDetail: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          sequenceNumber: { type: 'integer' },
          stationId: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'skipped'] },
          estimatedMinutes: { type: 'integer', nullable: true },
          processSteps: {
            type: 'array',
            items: { $ref: '#/components/schemas/ProcessStep' },
          },
          qualityChecks: {
            type: 'array',
            items: { $ref: '#/components/schemas/QualityCheck' },
          },
        },
      },
      ProcessStep: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          sequenceOrder: { type: 'integer' },
          required: { type: 'boolean' },
        },
      },
      QualityCheck: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          checkType: { type: 'string', enum: ['visual', 'measurement', 'functional', 'dimensional'] },
          specification: { type: 'string', nullable: true },
          required: { type: 'boolean' },
        },
      },
      NCR: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          ncrNumber: { type: 'string' },
          unitId: { type: 'string', format: 'uuid' },
          stationId: { type: 'string', format: 'uuid' },
          defectType: { type: 'string' },
          severity: { type: 'string', enum: ['minor', 'major', 'critical'] },
          description: { type: 'string' },
          status: { type: 'string', enum: ['open', 'dispositioned', 'closed'] },
          disposition: { type: 'string', nullable: true },
          dispositionNotes: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      DispositionRequest: {
        type: 'object',
        required: ['disposition'],
        properties: {
          disposition: {
            type: 'string',
            enum: ['use-as-is', 'rework', 'scrap', 'return-to-vendor'],
          },
          notes: { type: 'string', description: 'Optional disposition notes' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
        },
      },
    },
    responses: {
      BadRequest: {
        description: 'Bad request - missing or invalid parameters',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'Missing required field: workOrderId' },
          },
        },
      },
      Unauthorized: {
        description: 'Unauthorized - authentication required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'Authentication required' },
          },
        },
      },
      Forbidden: {
        description: 'Forbidden - insufficient permissions',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'Requires admin or supervisor role' },
          },
        },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
