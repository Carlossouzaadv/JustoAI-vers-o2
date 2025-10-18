import swaggerJsDoc from 'swagger-jsdoc';

const swaggerOptions: swaggerJsDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'JustoAI V2 API',
      version: '2.0.0',
      description: 'API completa da plataforma JustoAI V2 para gestão jurídica com IA',
      contact: {
        name: 'Equipe JustoAI',
        email: 'dev@justoai.com'
      },
      license: {
        name: 'Proprietary',
        url: 'https://justoai.com/license'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production'
          ? process.env.NEXT_PUBLIC_API_URL || 'https://api.justoai.com'
          : 'http://localhost:3000',
        description: process.env.NODE_ENV === 'production'
          ? 'Servidor de Produção'
          : 'Servidor de Desenvolvimento'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT obtido através do endpoint de autenticação'
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'next-auth.session-token',
          description: 'Cookie de sessão do NextAuth'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              example: 'Mensagem de erro'
            },
            message: {
              type: 'string',
              example: 'Descrição detalhada do erro'
            },
            statusCode: {
              type: 'integer',
              example: 400
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Operação realizada com sucesso'
            },
            data: {
              type: 'object',
              description: 'Dados retornados pela operação'
            }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              example: 1,
              description: 'Página atual'
            },
            limit: {
              type: 'integer',
              example: 20,
              description: 'Itens por página'
            },
            total: {
              type: 'integer',
              example: 100,
              description: 'Total de itens'
            },
            totalPages: {
              type: 'integer',
              example: 5,
              description: 'Total de páginas'
            }
          }
        },
        Process: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '550e8400-e29b-41d4-a716-446655440000'
            },
            processNumber: {
              type: 'string',
              example: '1234567-89.2024.8.26.0001',
              description: 'Número do processo no formato CNJ'
            },
            court: {
              type: 'string',
              example: '1ª Vara Cível Central',
              description: 'Tribunal ou vara'
            },
            clientName: {
              type: 'string',
              example: 'João Silva',
              description: 'Nome do cliente associado'
            },
            monitoringStatus: {
              type: 'string',
              enum: ['ACTIVE', 'PAUSED', 'STOPPED', 'ERROR'],
              example: 'ACTIVE',
              description: 'Status do monitoramento'
            },
            syncFrequency: {
              type: 'string',
              enum: ['HOURLY', 'DAILY', 'WEEKLY', 'MANUAL'],
              example: 'DAILY',
              description: 'Frequência de sincronização'
            },
            alertsEnabled: {
              type: 'boolean',
              example: true,
              description: 'Alertas habilitados'
            },
            alertRecipients: {
              type: 'array',
              items: {
                type: 'string',
                format: 'email'
              },
              example: ['admin@escritorio.com'],
              description: 'Emails para receber alertas'
            },
            caseId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              description: 'ID do caso associado'
            },
            lastSync: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Data/hora da última sincronização'
            },
            lastSyncStatus: {
              type: 'string',
              example: 'SUCCESS',
              nullable: true,
              description: 'Status da última sincronização'
            },
            errorCount: {
              type: 'integer',
              example: 0,
              description: 'Contador de erros'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            },
            workspaceId: {
              type: 'string',
              format: 'uuid'
            }
          }
        },
        Client: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            name: {
              type: 'string',
              example: 'João Silva'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'joao@exemplo.com'
            },
            phone: {
              type: 'string',
              example: '+55 11 99999-9999'
            },
            document: {
              type: 'string',
              example: '123.456.789-00',
              description: 'CPF ou CNPJ'
            },
            type: {
              type: 'string',
              enum: ['INDIVIDUAL', 'COMPANY'],
              example: 'INDIVIDUAL'
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
              example: 'ACTIVE'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            },
            workspaceId: {
              type: 'string',
              format: 'uuid'
            }
          }
        },
        Case: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            title: {
              type: 'string',
              example: 'Ação de Cobrança'
            },
            description: {
              type: 'string',
              example: 'Descrição detalhada do caso'
            },
            type: {
              type: 'string',
              example: 'CIVIL',
              description: 'Tipo do caso jurídico'
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'PENDING', 'CLOSED', 'ARCHIVED'],
              example: 'ACTIVE'
            },
            clientId: {
              type: 'string',
              format: 'uuid'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            },
            workspaceId: {
              type: 'string',
              format: 'uuid'
            }
          }
        },
        Workspace: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            name: {
              type: 'string',
              example: 'Escritório Silva & Advogados'
            },
            slug: {
              type: 'string',
              example: 'silva-advogados'
            },
            plan: {
              type: 'string',
              enum: ['FREE', 'BASIC', 'PROFESSIONAL', 'ENTERPRISE'],
              example: 'PROFESSIONAL'
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'SUSPENDED', 'CANCELLED'],
              example: 'ACTIVE'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        HealthResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  enum: ['healthy', 'unhealthy'],
                  example: 'healthy'
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time'
                },
                version: {
                  type: 'string',
                  example: '2.0.0'
                },
                database: {
                  type: 'object',
                  properties: {
                    connected: {
                      type: 'boolean',
                      example: true
                    },
                    stats: {
                      type: 'object',
                      properties: {
                        workspaces: { type: 'integer' },
                        users: { type: 'integer' },
                        clients: { type: 'integer' },
                        cases: { type: 'integer' }
                      }
                    }
                  }
                },
                environment: {
                  type: 'string',
                  example: 'development'
                }
              }
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Token de autenticação ausente ou inválido',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'Não autorizado',
                message: 'Token de autenticação inválido ou expirado',
                statusCode: 401
              }
            }
          }
        },
        ForbiddenError: {
          description: 'Acesso negado',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'Acesso negado',
                message: 'Você não tem permissão para acessar este recurso',
                statusCode: 403
              }
            }
          }
        },
        NotFoundError: {
          description: 'Recurso não encontrado',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'Não encontrado',
                message: 'O recurso solicitado não foi encontrado',
                statusCode: 404
              }
            }
          }
        },
        ValidationError: {
          description: 'Erro de validação nos dados enviados',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'Erro de validação',
                message: 'Os dados fornecidos são inválidos',
                statusCode: 400
              }
            }
          }
        },
        InternalServerError: {
          description: 'Erro interno do servidor',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'Erro interno',
                message: 'Ocorreu um erro inesperado no servidor',
                statusCode: 500
              }
            }
          }
        }
      },
      parameters: {
        PageParam: {
          name: 'page',
          in: 'query',
          description: 'Número da página',
          required: false,
          schema: {
            type: 'integer',
            minimum: 1,
            default: 1
          }
        },
        LimitParam: {
          name: 'limit',
          in: 'query',
          description: 'Itens por página',
          required: false,
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 20
          }
        },
        SearchParam: {
          name: 'search',
          in: 'query',
          description: 'Termo de busca',
          required: false,
          schema: {
            type: 'string'
          }
        },
        SortByParam: {
          name: 'sortBy',
          in: 'query',
          description: 'Campo para ordenação',
          required: false,
          schema: {
            type: 'string',
            default: 'createdAt'
          }
        },
        SortOrderParam: {
          name: 'sortOrder',
          in: 'query',
          description: 'Direção da ordenação',
          required: false,
          schema: {
            type: 'string',
            enum: ['asc', 'desc'],
            default: 'desc'
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Health',
        description: 'Endpoints de verificação de saúde do sistema'
      },
      {
        name: 'Processos',
        description: 'Gerenciamento de processos jurídicos monitorados'
      },
      {
        name: 'Clientes',
        description: 'Gerenciamento de clientes'
      },
      {
        name: 'Casos',
        description: 'Gerenciamento de casos jurídicos'
      },
      {
        name: 'Relatórios',
        description: 'Geração e consulta de relatórios'
      },
      {
        name: 'IA',
        description: 'Endpoints de análise com inteligência artificial'
      },
      {
        name: 'Créditos',
        description: 'Gerenciamento de créditos e consumo'
      },
      {
        name: 'Workspaces',
        description: 'Gerenciamento de workspaces (escritórios)'
      },
      {
        name: 'Upload',
        description: 'Upload de documentos e arquivos'
      },
      {
        name: 'Analytics',
        description: 'Métricas e estatísticas do sistema'
      }
    ]
  },
  apis: [
    './src/app/api/**/*.ts',
    './src/lib/swagger-docs/**/*.ts'
  ]
};

export const swaggerSpec = swaggerJsDoc(swaggerOptions);

export default swaggerSpec;
