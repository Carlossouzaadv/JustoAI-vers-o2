import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

/**
 * POST /api/contact/enterprise
 * Receives enterprise contact form submissions and sends notification to sales team
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate required fields
        const { name, email, phone, firmSize, needs } = body;
        if (!name || !email || !phone || !firmSize) {
            return NextResponse.json(
                { success: false, error: 'Campos obrigatórios: name, email, phone, firmSize' },
                { status: 400 }
            );
        }

        // Email to sales team
        const resendApiKey = process.env.RESEND_API_KEY;
        const salesEmail = process.env.SALES_EMAIL || 'vendas@justoai.com';

        if (resendApiKey) {
            const resend = new Resend(resendApiKey);

            await resend.emails.send({
                from: 'JustoAI <noreply@justoai.com>',
                to: [salesEmail],
                subject: `[Enterprise Lead] ${name} - ${firmSize}`,
                html: `
          <h2>Nova Solicitação Enterprise</h2>
          <table style="border-collapse: collapse; width: 100%;">
            <tr>
              <td style="padding: 8px; background: #f3f4f6;"><strong>Nome:</strong></td>
              <td style="padding: 8px;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background: #f3f4f6;"><strong>Email:</strong></td>
              <td style="padding: 8px;"><a href="mailto:${email}">${email}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px; background: #f3f4f6;"><strong>Telefone:</strong></td>
              <td style="padding: 8px;"><a href="tel:${phone}">${phone}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px; background: #f3f4f6;"><strong>Tamanho:</strong></td>
              <td style="padding: 8px;">${firmSize}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background: #f3f4f6;"><strong>Necessidades:</strong></td>
              <td style="padding: 8px;">${needs || 'Não especificado'}</td>
            </tr>
          </table>
          <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
            Recebido em ${new Date().toLocaleString('pt-BR')}
          </p>
        `,
            });
        }

        // Log the lead (could be stored in DB later)
        console.log('Enterprise lead received:', { name, email, firmSize });

        return NextResponse.json({
            success: true,
            message: 'Solicitação enviada com sucesso! Nossa equipe entrará em contato em breve.',
        });

    } catch (error) {
        console.error('Error processing enterprise contact:', error);
        return NextResponse.json(
            { success: false, error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
