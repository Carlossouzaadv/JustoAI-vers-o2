// ================================================================
// EMAIL SERVICE - Resend Integration for JustoAI
// ================================================================
// Centralized email service using Resend API for all email communications

import { ICONS } from './icons';

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface EmailNotification {
  to: string | string[];
  subject: string;
  template: 'process-alert' | 'report-ready' | 'payment-success' | 'system-notification' | 'custom';
  data: unknown;
  priority?: 'high' | 'normal' | 'low';
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: 'resend';
}

/**
 * Email Service using Resend
 * Handles all email communications for JustoAI
 */
export class EmailService {
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly baseUrl = 'https://api.resend.com';

  constructor() {
    this.apiKey = process.env.SMTP_PASSWORD || '';
    this.fromEmail = process.env.FROM_EMAIL || 'contato@justoai.com.br';

    if (!this.apiKey) {
      console.warn(`${ICONS.WARNING} Resend API key not configured - emails will be simulated`);
    }
  }

  /**
   * Send email notification using predefined templates
   */
  async sendNotification(notification: EmailNotification): Promise<EmailResult> {
    console.log(`${ICONS.MAIL} Enviando notificação por email...`);

    if (!this.apiKey) {
      console.log(`${ICONS.WARNING} Simulando envio de email (API key não configurada)`);
      return { success: true, messageId: 'simulated-' + Date.now(), provider: 'resend' };
    }

    try {
      const template = this.getTemplate(notification.template, notification.data);

      const emailData = {
        from: this.fromEmail,
        to: Array.isArray(notification.to) ? notification.to : [notification.to],
        subject: template.subject,
        html: template.html,
        text: template.text,
        attachments: notification.attachments?.map(att => ({
          filename: att.filename,
          content: att.content.toString('base64'),
          content_type: att.contentType
        }))
      };

      const response = await fetch(`${this.baseUrl}/emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Resend API error: ${errorData.message || response.statusText}`);
      }

      const result = await response.json();
      console.log(`${ICONS.SUCCESS} Email enviado com sucesso: ${result.id}`);

      return {
        success: true,
        messageId: result.id,
        provider: 'resend'
      };

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao enviar email:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'resend'
      };
    }
  }

  /**
   * Send custom email with HTML content
   */
  async sendCustomEmail(
    to: string | string[],
    subject: string,
    html: string,
    text?: string,
    attachments?: EmailAttachment[]
  ): Promise<EmailResult> {
    return this.sendNotification({
      to,
      subject,
      template: 'custom',
      data: { html, text },
      attachments
    });
  }

  /**
   * Send process alert email
   */
  async sendProcessAlert(
    to: string,
    processNumber: string,
    alertType: string,
    description: string,
    urgency: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<EmailResult> {
    return this.sendNotification({
      to,
      subject: `🚨 Alerta de Processo - ${processNumber}`,
      template: 'process-alert',
      data: {
        processNumber,
        alertType,
        description,
        urgency,
        timestamp: new Date().toLocaleString('pt-BR')
      },
      priority: urgency === 'high' ? 'high' : 'normal'
    });
  }

  /**
   * Send report ready notification
   */
  async sendReportReady(
    to: string,
    reportName: string,
    downloadUrl: string,
    expiresAt?: Date
  ): Promise<EmailResult> {
    return this.sendNotification({
      to,
      subject: `📊 Relatório Pronto - ${reportName}`,
      template: 'report-ready',
      data: {
        reportName,
        downloadUrl,
        expiresAt: expiresAt?.toLocaleString('pt-BR'),
        timestamp: new Date().toLocaleString('pt-BR')
      }
    });
  }

  /**
   * Send payment success notification
   */
  async sendPaymentSuccess(
    to: string,
    amount: number,
    credits: number,
    transactionId: string
  ): Promise<EmailResult> {
    return this.sendNotification({
      to,
      subject: '✅ Pagamento Confirmado - JustoAI',
      template: 'payment-success',
      data: {
        amount: amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        credits,
        transactionId,
        timestamp: new Date().toLocaleString('pt-BR')
      }
    });
  }

  /**
   * Get email template based on type
   */
  private getTemplate(templateType: EmailNotification['template'], data: unknown): EmailTemplate {
    switch (templateType) {
      case 'process-alert':
        return this.getProcessAlertTemplate(data);
      case 'report-ready':
        return this.getReportReadyTemplate(data);
      case 'payment-success':
        return this.getPaymentSuccessTemplate(data);
      case 'system-notification':
        return this.getSystemNotificationTemplate(data);
      case 'custom':
        return {
          subject: data.subject || 'Notificação JustoAI',
          html: data.html,
          text: data.text
        };
      default:
        throw new Error(`Template não encontrado: ${templateType}`);
    }
  }

  private getProcessAlertTemplate(data: unknown): EmailTemplate {
    const urgencyIcon = data.urgency === 'high' ? '🔴' : data.urgency === 'medium' ? '🟡' : '🟢';

    return {
      subject: `${urgencyIcon} Alerta de Processo - ${data.processNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #333; margin: 0;">${urgencyIcon} Alerta de Processo</h2>
          </div>

          <div style="background: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px;">
            <h3 style="color: #495057; margin-top: 0;">Processo: ${data.processNumber}</h3>
            <p><strong>Tipo de Alerta:</strong> ${data.alertType}</p>
            <p><strong>Descrição:</strong></p>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 10px 0;">
              ${data.description}
            </div>
            <p><strong>Urgência:</strong> ${data.urgency.toUpperCase()}</p>
            <p><strong>Data/Hora:</strong> ${data.timestamp}</p>
          </div>

          <div style="text-align: center; margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              Este é um email automático do sistema JustoAI.<br>
              Acesse seu dashboard para mais detalhes.
            </p>
          </div>
        </div>
      `,
      text: `
        Alerta de Processo - ${data.processNumber}

        Tipo: ${data.alertType}
        Descrição: ${data.description}
        Urgência: ${data.urgency.toUpperCase()}
        Data/Hora: ${data.timestamp}

        Acesse seu dashboard para mais detalhes.
      `
    };
  }

  private getReportReadyTemplate(data: unknown): EmailTemplate {
    return {
      subject: `📊 Relatório Pronto - ${data.reportName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #333; margin: 0;">📊 Relatório Pronto</h2>
          </div>

          <div style="background: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px;">
            <h3 style="color: #495057; margin-top: 0;">${data.reportName}</h3>
            <p>Seu relatório foi gerado com sucesso e está pronto para download.</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.downloadUrl}"
                 style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                📥 Baixar Relatório
              </a>
            </div>

            ${data.expiresAt ? `<p style="color: #dc3545; font-size: 14px;"><strong>Atenção:</strong> Este link expira em ${data.expiresAt}</p>` : ''}
            <p><strong>Gerado em:</strong> ${data.timestamp}</p>
          </div>

          <div style="text-align: center; margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              JustoAI - Inteligência Artificial para Advocacia
            </p>
          </div>
        </div>
      `,
      text: `
        Relatório Pronto: ${data.reportName}

        Seu relatório foi gerado com sucesso.
        Link para download: ${data.downloadUrl}
        ${data.expiresAt ? `Expira em: ${data.expiresAt}` : ''}
        Gerado em: ${data.timestamp}
      `
    };
  }

  private getPaymentSuccessTemplate(data: unknown): EmailTemplate {
    return {
      subject: '✅ Pagamento Confirmado - JustoAI',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #c3e6cb;">
            <h2 style="color: #155724; margin: 0;">✅ Pagamento Confirmado</h2>
          </div>

          <div style="background: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px;">
            <h3 style="color: #495057; margin-top: 0;">Pagamento Processado com Sucesso</h3>

            <div style="background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0;">
              <p style="margin: 5px 0;"><strong>Valor:</strong> ${data.amount}</p>
              <p style="margin: 5px 0;"><strong>Créditos Adicionados:</strong> ${data.credits}</p>
              <p style="margin: 5px 0;"><strong>ID da Transação:</strong> ${data.transactionId}</p>
              <p style="margin: 5px 0;"><strong>Data/Hora:</strong> ${data.timestamp}</p>
            </div>

            <p>Seus créditos já estão disponíveis em sua conta e você pode começar a usar imediatamente.</p>
          </div>

          <div style="text-align: center; margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              Obrigado por usar o JustoAI!<br>
              Em caso de dúvidas, entre em contato conosco.
            </p>
          </div>
        </div>
      `,
      text: `
        Pagamento Confirmado - JustoAI

        Valor: ${data.amount}
        Créditos Adicionados: ${data.credits}
        ID da Transação: ${data.transactionId}
        Data/Hora: ${data.timestamp}

        Seus créditos já estão disponíveis em sua conta.
      `
    };
  }

  private getSystemNotificationTemplate(data: unknown): EmailTemplate {
    return {
      subject: data.subject || 'Notificação do Sistema - JustoAI',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #333; margin: 0;">🔔 Notificação do Sistema</h2>
          </div>

          <div style="background: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px;">
            ${data.html || data.message}
          </div>

          <div style="text-align: center; margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              JustoAI - Inteligência Artificial para Advocacia
            </p>
          </div>
        </div>
      `,
      text: data.text || data.message
    };
  }

  /**
   * Test email connectivity
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.apiKey) {
      return { success: false, error: 'API key not configured' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/domains`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      return { success: response.ok };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

/**
 * Singleton instance
 */
let emailServiceInstance: EmailService | null = null;

export function getEmailService(): EmailService {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService();
  }
  return emailServiceInstance;
}

/**
 * Quick helper functions
 */
export const sendProcessAlert = (to: string, processNumber: string, alertType: string, description: string, urgency: 'high' | 'medium' | 'low' = 'medium') =>
  getEmailService().sendProcessAlert(to, processNumber, alertType, description, urgency);

export const sendReportReady = (to: string, reportName: string, downloadUrl: string, expiresAt?: Date) =>
  getEmailService().sendReportReady(to, reportName, downloadUrl, expiresAt);

export const sendPaymentSuccess = (to: string, amount: number, credits: number, transactionId: string) =>
  getEmailService().sendPaymentSuccess(to, amount, credits, transactionId);