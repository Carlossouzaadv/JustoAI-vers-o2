// ================================
// API ROUTE: /api/contact
// Endpoints: POST (submit contact form)
// ================================
// Contact form submissions from public website

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ICONS } from '@/lib/icons';
import { captureApiError } from '@/lib/sentry-error-handler';

// ================================
// VALIDAÇÃO DE INPUT
// ================================

const contactFormSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email(),
  subject: z.string().min(3).max(200),
  company: z.string().max(200).optional().default(''),
  message: z.string().min(10).max(5000),
  formType: z.enum(['contact', 'support']).optional().default('contact'),
  problemType: z.string().max(100).optional(),
});

const supportFormSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email(),
  problemType: z.string().min(3).max(100),
  subject: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  formType: z.literal('support'),
});

type ContactFormPayload = z.infer<typeof contactFormSchema>;
type SupportFormPayload = z.infer<typeof supportFormSchema>;

// ================================
// HELPER: Send Email
// ================================

/**
 * Send email via configured service
 * Supports: Resend, SendGrid, or fallback logging
 */
async function sendContactEmail(
  formData: ContactFormPayload | SupportFormPayload,
  formType: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Check if Resend is available
    let resendAvailable = false;
    try {
      require.resolve('resend');
      resendAvailable = true;
    } catch {
      resendAvailable = false;
    }

    if (resendAvailable) {
      // Use Resend if available
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);

      const htmlContent = generateEmailHtml(formData, formType);

      const response = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'contato@justoai.com.br',
        to: 'carlossouza.pr@gmail.com',
        replyTo: formData.email,
        subject: `[JustoAI ${formType === 'support' ? 'Support' : 'Contact'}] ${formData.subject}`,
        html: htmlContent,
      });

      return {
        success: !response.error,
        messageId: response.data?.id,
        error: response.error?.message,
      };
    } else {
      // Fallback: Log and simulate success
      console.log(`${ICONS.INFO} Email would be sent via fallback handler:`, {
        from: formData.email,
        to: 'carlossouza.pr@gmail.com',
        subject: `[JustoAI ${formType === 'support' ? 'Support' : 'Contact'}] ${formData.subject}`,
        name: formData.name,
      });

      return {
        success: true,
        messageId: `fallback-${Date.now()}`,
      };
    }
  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao enviar email:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao enviar email',
    };
  }
}

// ================================
// HELPER: Generate Email HTML
// ================================

function generateEmailHtml(
  formData: ContactFormPayload | SupportFormPayload,
  formType: string
): string {
  const isSupport = formType === 'support';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #3182ce; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border-bottom: 1px solid #ddd; }
        .field { margin-bottom: 15px; }
        .label { font-weight: bold; color: #2d3748; }
        .value { background-color: white; padding: 10px; border-left: 3px solid #3182ce; margin-top: 5px; }
        .footer { background-color: #f0f0f0; padding: 15px; border-radius: 0 0 5px 5px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>${isSupport ? 'Novo Ticket de Suporte' : 'Novo Contato'}</h2>
        </div>
        <div class="content">
          <div class="field">
            <div class="label">Nome:</div>
            <div class="value">${escapeHtml(formData.name)}</div>
          </div>
          <div class="field">
            <div class="label">Email:</div>
            <div class="value"><a href="mailto:${escapeHtml(formData.email)}">${escapeHtml(formData.email)}</a></div>
          </div>
          ${'company' in formData && formData.company ? `
          <div class="field">
            <div class="label">Empresa:</div>
            <div class="value">${escapeHtml(formData.company)}</div>
          </div>
          ` : ''}
          ${isSupport && 'problemType' in formData && formData.problemType ? `
          <div class="field">
            <div class="label">Tipo de Problema:</div>
            <div class="value">${escapeHtml(formData.problemType)}</div>
          </div>
          ` : ''}
          <div class="field">
            <div class="label">Assunto:</div>
            <div class="value">${escapeHtml(formData.subject)}</div>
          </div>
          <div class="field">
            <div class="label">Mensagem:</div>
            <div class="value">${escapeHtml('message' in formData ? formData.message : 'description' in formData ? formData.description : '')}</div>
          </div>
        </div>
        <div class="footer">
          <p>Este email foi enviado automaticamente pelo formulário de contato do JustoAI.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Safely escape HTML special characters
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ================================
// POST HANDLER
// ================================

export async function POST(req: NextRequest) {
  try {
    console.log(`${ICONS.PROCESS} Nova requisição de formulário de contato`);

    // 1. Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Corpo da requisição inválido' },
        { status: 400 }
      );
    }

    // 2. Determine form type and validate accordingly
    let formData: ContactFormPayload | SupportFormPayload;
    const bodyObj = body as Record<string, unknown>;
    const formType = bodyObj.formType === 'support' ? 'support' : 'contact';

    try {
      if (formType === 'support') {
        formData = supportFormSchema.parse(body);
      } else {
        formData = contactFormSchema.parse(body);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Dados do formulário inválidos',
            details: error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }
      throw error;
    }

    console.log(`${ICONS.INFO} Formulário validado: ${formType} de ${formData.email}`);

    // 3. Send email
    const emailResult = await sendContactEmail(formData, formType);

    if (!emailResult.success) {
      console.warn(`${ICONS.WARNING} Falha ao enviar email:`, emailResult.error);
      // Don't fail the request, but log the error
      captureApiError(
        new Error(emailResult.error || 'Email send failed'),
        {
          endpoint: '/api/contact',
          method: 'POST',
          formType,
          email: formData.email,
        }
      );
    } else {
      console.log(`${ICONS.SUCCESS} Email enviado com sucesso: ${emailResult.messageId}`);
    }

    // 4. Return success response
    return NextResponse.json(
      {
        success: true,
        message: formType === 'support'
          ? 'Seu ticket foi enviado com sucesso! Nossa equipe responderá em até 24 horas úteis.'
          : 'Sua mensagem foi enviada com sucesso! Entraremos em contato em breve.',
        messageId: emailResult.messageId,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro no formulário de contato:`, error);

    captureApiError(error, {
      endpoint: '/api/contact',
      method: 'POST',
    });

    return NextResponse.json(
      { success: false, error: 'Erro ao processar formulário. Tente novamente mais tarde.' },
      { status: 500 }
    );
  }
}
