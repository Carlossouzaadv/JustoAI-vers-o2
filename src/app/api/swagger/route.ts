import { NextResponse } from 'next/server';
import { swaggerSpec } from '@/lib/swagger';

/**
 * @swagger
 * /api/swagger:
 *   get:
 *     summary: Retorna a especificação OpenAPI em JSON
 *     description: Endpoint que retorna o documento OpenAPI completo em formato JSON
 *     tags:
 *       - Documentation
 *     responses:
 *       200:
 *         description: Especificação OpenAPI em JSON
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
export async function GET() {
  return NextResponse.json(swaggerSpec);
}
