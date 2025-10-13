/**
 * Documentação adicional de endpoints da API JustoAI V2
 * Este arquivo contém a documentação Swagger para endpoints adicionais
 */

/**
 * @swagger
 * /api/workspaces:
 *   get:
 *     summary: Listar workspaces
 *     description: Retorna lista de workspaces do usuário autenticado
 *     tags:
 *       - Workspaces
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de workspaces
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Workspace'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

/**
 * @swagger
 * /api/workspaces/{id}:
 *   get:
 *     summary: Obter detalhes do workspace
 *     description: Retorna informações detalhadas de um workspace específico
 *     tags:
 *       - Workspaces
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID do workspace
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Detalhes do workspace
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Workspace'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

/**
 * @swagger
 * /api/credits/balance:
 *   get:
 *     summary: Consultar saldo de créditos
 *     description: Retorna o saldo atual de créditos do workspace
 *     tags:
 *       - Créditos
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Saldo de créditos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     balance:
 *                       type: number
 *                       example: 1500.50
 *                       description: Saldo atual de créditos
 *                     currency:
 *                       type: string
 *                       example: BRL
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

/**
 * @swagger
 * /api/credits/history:
 *   get:
 *     summary: Histórico de créditos
 *     description: Retorna histórico de consumo e compra de créditos
 *     tags:
 *       - Créditos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: type
 *         in: query
 *         description: Tipo de transação
 *         required: false
 *         schema:
 *           type: string
 *           enum: [PURCHASE, CONSUMPTION, REFUND, BONUS]
 *     responses:
 *       200:
 *         description: Histórico de créditos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       type:
 *                         type: string
 *                         enum: [PURCHASE, CONSUMPTION, REFUND, BONUS]
 *                       amount:
 *                         type: number
 *                         example: 100.00
 *                       description:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

/**
 * @swagger
 * /api/reports/generate:
 *   post:
 *     summary: Gerar relatório
 *     description: Gera um novo relatório baseado nos parâmetros fornecidos
 *     tags:
 *       - Relatórios
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - format
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [PROCESS_SUMMARY, CLIENT_REPORT, CASE_ANALYSIS, FINANCIAL]
 *                 description: Tipo de relatório
 *               format:
 *                 type: string
 *                 enum: [PDF, DOCX, XLSX]
 *                 description: Formato do relatório
 *               filters:
 *                 type: object
 *                 properties:
 *                   dateFrom:
 *                     type: string
 *                     format: date
 *                   dateTo:
 *                     type: string
 *                     format: date
 *                   clientIds:
 *                     type: array
 *                     items:
 *                       type: string
 *                   caseIds:
 *                     type: array
 *                     items:
 *                       type: string
 *     responses:
 *       200:
 *         description: Relatório gerado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     reportId:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       example: PROCESSING
 *                     downloadUrl:
 *                       type: string
 *                       format: uri
 *                       nullable: true
 *                 message:
 *                   type: string
 *                   example: "Relatório em processamento"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

/**
 * @swagger
 * /api/ai/analyze:
 *   post:
 *     summary: Análise com IA
 *     description: Executa análise de documentos ou processos utilizando inteligência artificial
 *     tags:
 *       - IA
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - content
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [DOCUMENT, PROCESS, CASE]
 *                 description: Tipo de análise
 *               content:
 *                 type: string
 *                 description: Conteúdo a ser analisado (texto ou ID do documento)
 *               options:
 *                 type: object
 *                 properties:
 *                   deepAnalysis:
 *                     type: boolean
 *                     default: false
 *                     description: Realizar análise profunda (consome mais créditos)
 *                   language:
 *                     type: string
 *                     default: pt-BR
 *                   includeRecommendations:
 *                     type: boolean
 *                     default: true
 *     responses:
 *       200:
 *         description: Análise concluída
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     analysisId:
 *                       type: string
 *                       format: uuid
 *                     summary:
 *                       type: string
 *                     insights:
 *                       type: array
 *                       items:
 *                         type: string
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: string
 *                     confidence:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 1
 *                       example: 0.95
 *                     creditsConsumed:
 *                       type: number
 *                       example: 10.5
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       402:
 *         description: Créditos insuficientes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/upload/excel:
 *   post:
 *     summary: Upload de arquivo Excel
 *     description: Faz upload de planilha Excel para importação em lote de processos
 *     tags:
 *       - Upload
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Arquivo Excel (.xlsx ou .xls)
 *               workspaceId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Upload realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     batchId:
 *                       type: string
 *                       format: uuid
 *                     totalRows:
 *                       type: integer
 *                       example: 150
 *                     validRows:
 *                       type: integer
 *                       example: 145
 *                     invalidRows:
 *                       type: integer
 *                       example: 5
 *                     status:
 *                       type: string
 *                       example: PROCESSING
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

/**
 * @swagger
 * /api/analytics:
 *   get:
 *     summary: Analytics do sistema
 *     description: Retorna métricas e estatísticas do workspace
 *     tags:
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: period
 *         in: query
 *         description: Período para análise
 *         required: false
 *         schema:
 *           type: string
 *           enum: [day, week, month, year]
 *           default: month
 *     responses:
 *       200:
 *         description: Métricas retornadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalProcesses:
 *                       type: integer
 *                       example: 250
 *                     activeProcesses:
 *                       type: integer
 *                       example: 180
 *                     totalClients:
 *                       type: integer
 *                       example: 75
 *                     totalCases:
 *                       type: integer
 *                       example: 320
 *                     creditsConsumed:
 *                       type: number
 *                       example: 1250.50
 *                     aiAnalysisCount:
 *                       type: integer
 *                       example: 450
 *                     reportCount:
 *                       type: integer
 *                       example: 85
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

export {}; // Make this a module
