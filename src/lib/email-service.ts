// ================================================================
// EMAIL SERVICE - Resend Integration for JustoAI
// ================================================================
// Centralized email service using Resend API for all email communications

import { ICONS } from './icons';
import { log, logError } from '@/lib/services/logger';

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface EmailNotification {
  to: string | string[];
  subject: string;
  template: 'process-alert' | 'report-ready' | 'payment-success' | 'system-notification' | 'trial-expiring' | 'welcome' | 'custom';
  data: unknown;
  priority?: 'high' | 'normal' | 'low';
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

// Template-specific data types
export interface ProcessAlertData {
  processNumber: string;
  alertType: string;
  description: string;
  urgency: 'high' | 'medium' | 'low';
  timestamp: string;
}

export interface ReportReadyData {
  reportName: string;
  downloadUrl: string;
  expiresAt?: string;
  timestamp: string;
}

export interface PaymentSuccessData {
  amount: string;
  credits: number;
  transactionId: string;
  timestamp: string;
}

export interface TrialExpiringData {
  userName: string;
  workspaceName: string;
  daysRemaining: number;
  expiresAt: string; // ISO date string
  timestamp: string;
}

export interface WelcomeData {
  userName: string;
  workspaceName: string;
  trialDaysRemaining: number;
  trialEndsAt: string; // ISO date string
  onboardingCredits: number;
  timestamp: string;
}

export interface SystemNotificationData {
  subject?: string;
  html?: string;
  text?: string;
  message?: string;
}

export interface CustomEmailData {
  subject?: string;
  html: string;
  text?: string;
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
      log.warn({ msg: 'Resend API key not configured - emails will be simulated' });
    }
  }

  /**
   * Send email notification using predefined templates
   */
  async sendNotification(notification: EmailNotification): Promise<EmailResult> {
    log.info({ msg: 'Enviando notificação por email...' });

    if (!this.apiKey) {
      log.info({ msg: 'Simulando envio de email (API key não configurada)' });
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
      log.info({ msg: 'Email enviado com sucesso:' });

      return {
        success: true,
        messageId: result.id,
        provider: 'resend'
      };

    } catch (_error) {
      logError(error, '${ICONS.ERROR} Erro ao enviar email:', { component: 'refactored' });
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
   * Send trial expiration reminder email
   */
  async sendTrialExpiring(
    to: string,
    userName: string,
    workspaceName: string,
    daysRemaining: number,
    expiresAt: Date
  ): Promise<EmailResult> {
    return this.sendNotification({
      to,
      subject: `⏰ Seu período de trial expira em ${daysRemaining} dias - JustoAI`,
      template: 'trial-expiring',
      priority: 'high',
      data: {
        userName,
        workspaceName,
        daysRemaining,
        expiresAt: expiresAt.toISOString(),
        timestamp: new Date().toLocaleString('pt-BR')
      }
    });
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcome(
    to: string,
    userName: string,
    workspaceName: string,
    trialDaysRemaining: number,
    trialEndsAt: Date,
    onboardingCredits: number
  ): Promise<EmailResult> {
    return this.sendNotification({
      to,
      subject: '👋 Bem-vindo ao JustoAI - Seu trial de 7 dias está ativo!',
      template: 'welcome',
      data: {
        userName,
        workspaceName,
        trialDaysRemaining,
        trialEndsAt: trialEndsAt.toISOString(),
        onboardingCredits,
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
        if (!this.isProcessAlertData(data)) {
          throw new Error('Invalid data for process-alert template');
        }
        return this.getProcessAlertTemplate(data);
      case 'report-ready':
        if (!this.isReportReadyData(data)) {
          throw new Error('Invalid data for report-ready template');
        }
        return this.getReportReadyTemplate(data);
      case 'payment-success':
        if (!this.isPaymentSuccessData(data)) {
          throw new Error('Invalid data for payment-success template');
        }
        return this.getPaymentSuccessTemplate(data);
      case 'trial-expiring':
        if (!this.isTrialExpiringData(data)) {
          throw new Error('Invalid data for trial-expiring template');
        }
        return this.getTrialExpiringTemplate(data);
      case 'welcome':
        if (!this.isWelcomeData(data)) {
          throw new Error('Invalid data for welcome template');
        }
        return this.getWelcomeTemplate(data);
      case 'system-notification':
        if (!this.isSystemNotificationData(data)) {
          throw new Error('Invalid data for system-notification template');
        }
        return this.getSystemNotificationTemplate(data);
      case 'custom':
        if (!this.isCustomEmailData(data)) {
          throw new Error('Invalid data for custom template');
        }
        return {
          subject: data.subject || 'Notificação JustoAI',
          html: data.html,
          text: data.text
        };
      default:
        throw new Error(`Template não encontrado: ${templateType}`);
    }
  }

  /**
   * Type guards for email data validation (Padrão-Ouro - 100% Type Safe)
   */
  private isProcessAlertData(data: unknown): data is ProcessAlertData {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    const obj = data as Record<string, unknown>;
    return (
      typeof obj.processNumber === 'string' &&
      typeof obj.alertType === 'string' &&
      typeof obj.description === 'string' &&
      (obj.urgency === 'high' || obj.urgency === 'medium' || obj.urgency === 'low') &&
      typeof obj.timestamp === 'string'
    );
  }

  private isReportReadyData(data: unknown): data is ReportReadyData {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    const obj = data as Record<string, unknown>;
    return (
      typeof obj.reportName === 'string' &&
      typeof obj.downloadUrl === 'string' &&
      (obj.expiresAt === undefined || typeof obj.expiresAt === 'string') &&
      typeof obj.timestamp === 'string'
    );
  }

  private isPaymentSuccessData(data: unknown): data is PaymentSuccessData {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    const obj = data as Record<string, unknown>;
    return (
      typeof obj.amount === 'string' &&
      typeof obj.credits === 'number' &&
      typeof obj.transactionId === 'string' &&
      typeof obj.timestamp === 'string'
    );
  }

  private isTrialExpiringData(data: unknown): data is TrialExpiringData {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    const obj = data as Record<string, unknown>;
    return (
      typeof obj.userName === 'string' &&
      typeof obj.workspaceName === 'string' &&
      typeof obj.daysRemaining === 'number' &&
      typeof obj.expiresAt === 'string' &&
      typeof obj.timestamp === 'string'
    );
  }

  private isWelcomeData(data: unknown): data is WelcomeData {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    const obj = data as Record<string, unknown>;
    return (
      typeof obj.userName === 'string' &&
      typeof obj.workspaceName === 'string' &&
      typeof obj.trialDaysRemaining === 'number' &&
      typeof obj.trialEndsAt === 'string' &&
      typeof obj.onboardingCredits === 'number' &&
      typeof obj.timestamp === 'string'
    );
  }

  private isSystemNotificationData(data: unknown): data is SystemNotificationData {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    const obj = data as Record<string, unknown>;
    return (
      (obj.subject === undefined || typeof obj.subject === 'string') &&
      (obj.html === undefined || typeof obj.html === 'string') &&
      (obj.text === undefined || typeof obj.text === 'string') &&
      (obj.message === undefined || typeof obj.message === 'string')
    );
  }

  private isCustomEmailData(data: unknown): data is CustomEmailData {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    const obj = data as Record<string, unknown>;
    return (
      typeof obj.html === 'string' &&
      (obj.subject === undefined || typeof obj.subject === 'string') &&
      (obj.text === undefined || typeof obj.text === 'string')
    );
  }

  private getProcessAlertTemplate(data: ProcessAlertData): EmailTemplate {
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

  private getReportReadyTemplate(data: ReportReadyData): EmailTemplate {
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

  private getPaymentSuccessTemplate(data: PaymentSuccessData): EmailTemplate {
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

  private getTrialExpiringTemplate(data: TrialExpiringData): EmailTemplate {
    const expiresAtDate = new Date(data.expiresAt);
    const formattedDate = expiresAtDate.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return {
      subject: `⏰ Seu período de trial expira em ${data.daysRemaining} dias - JustoAI`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #ffeaa7;">
            <h2 style="color: #856404; margin: 0;">⏰ Seu Trial Está Terminando</h2>
          </div>

          <div style="background: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px;">
            <h3 style="color: #495057; margin-top: 0;">Olá, ${data.userName}!</h3>

            <p>Você está usando o <strong>${data.workspaceName}</strong> em período de trial.</p>

            <div style="background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <p style="margin: 5px 0;"><strong>⏳ Tempo Restante:</strong> ${data.daysRemaining} ${data.daysRemaining === 1 ? 'dia' : 'dias'}</p>
              <p style="margin: 5px 0;"><strong>📅 Expira em:</strong> ${formattedDate}</p>
            </div>

            <p style="color: #495057;">Seu período de trial está chegando ao fim. Para continuar usando o JustoAI sem interrupção, você precisa escolher um plano pago e adicionar um método de pagamento.</p>

            <h4 style="color: #495057; margin-top: 25px;">Próximos Passos:</h4>
            <ol style="color: #666; line-height: 1.8;">
              <li>Acesse seu dashboard</li>
              <li>Clique em "Billing" ou "Planos"</li>
              <li>Escolha entre <strong>Gestão (R$ 497)</strong> ou <strong>Performance (R$ 1.197)</strong></li>
              <li>Adicione seu método de pagamento</li>
            </ol>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://justoai.com.br'}/dashboard/billing"
                 style="background: #ffc107; color: #333; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                ✨ Escolher Plano Agora
              </a>
            </div>

            <p style="color: #666; font-size: 14px; margin-top: 20px;">
              <strong>Ao expirar o trial:</strong>
            </p>
            <ul style="color: #666; font-size: 14px;">
              <li>Seu workspace será automaticamente convertido para o plano FREE</li>
              <li>Você terá acesso limitado aos seus dados</li>
              <li>Qualquer momento você pode fazer upgrade para um plano pago</li>
            </ul>
          </div>

          <div style="text-align: center; margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              Em caso de dúvidas, entre em contato conosco pelo nosso support chat.
            </p>
          </div>
        </div>
      `,
      text: `
        Seu Período de Trial Está Terminando - JustoAI

        Olá, ${data.userName}!

        Você está usando o ${data.workspaceName} em período de trial.

        ⏳ Tempo Restante: ${data.daysRemaining} ${data.daysRemaining === 1 ? 'dia' : 'dias'}
        📅 Expira em: ${formattedDate}

        Para continuar usando o JustoAI sem interrupção, escolha um plano pago:
        - Gestão: R$ 497/mês (200 processos)
        - Performance: R$ 1.197/mês (500 processos)

        Acesse seu dashboard para fazer upgrade: ${process.env.NEXT_PUBLIC_APP_URL || 'https://justoai.com.br'}/dashboard/billing

        Após expirar o trial, seu workspace será convertido para o plano FREE com acesso limitado.
      `
    };
  }

  private getWelcomeTemplate(data: WelcomeData): EmailTemplate {
    const trialEndsAtDate = new Date(data.trialEndsAt);
    const formattedDate = trialEndsAtDate.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return {
      subject: '👋 Bem-vindo ao JustoAI - Seu trial de 7 dias está ativo!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
            <h2 style="color: white; margin: 0; font-size: 28px;">👋 Bem-vindo, ${data.userName}!</h2>
          </div>

          <div style="background: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px;">
            <p style="font-size: 16px; color: #495057; margin-top: 0;">
              Você se registrou com sucesso no <strong>JustoAI</strong>. Sua jornada para automatizar a geração de relatórios executivos começa agora!
            </p>

            <div style="background: #f0f4ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
              <h3 style="margin-top: 0; color: #667eea;">🎁 Seu Trial Gratuito</h3>
              <p style="margin: 5px 0; color: #495057;">
                <strong>Workspace:</strong> ${data.workspaceName}
              </p>
              <p style="margin: 5px 0; color: #495057;">
                <strong>Dias Disponíveis:</strong> ${data.trialDaysRemaining} dias
              </p>
              <p style="margin: 5px 0; color: #495057;">
                <strong>Expira em:</strong> ${formattedDate}
              </p>
              <p style="margin: 5px 0; color: #495057;">
                <strong>Créditos de Boas-vindas:</strong> ${data.onboardingCredits} créditos para usar imediatamente
              </p>
            </div>

            <h3 style="color: #333; margin-top: 25px;">🚀 Próximos Passos:</h3>
            <ol style="color: #495057; line-height: 1.8; margin-top: 10px;">
              <li>
                <strong>Acesse seu Dashboard:</strong> Entre em seu workspace para explorar todas as funcionalidades
              </li>
              <li>
                <strong>Faça um Upload de Teste:</strong> Teste a análise inteligente com seus próprios dados
              </li>
              <li>
                <strong>Configure Relatórios:</strong> Crie relatórios executivos automáticos personalizados para seus clientes
              </li>
              <li>
                <strong>Experimente as Integrações:</strong> Teste nossas integrações com ERP e sistemas jurídicos
              </li>
            </ol>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://justoai.com.br'}/dashboard"
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
                Acessar Dashboard Agora
              </a>
            </div>

            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 20px;">
              <h4 style="margin-top: 0; color: #495057;">💡 Dicas para Aproveitar Melhor:</h4>
              <ul style="color: #666; font-size: 14px; margin-bottom: 0;">
                <li>Comece com um pequeno upload (5-10 processos) para entender como o sistema funciona</li>
                <li>Explore diferentes tipos de relatórios para ver qual se encaixa melhor com seus clientes</li>
                <li>Configure lembretes de email para não perder prazos importantes</li>
                <li>Acesse a seção de Ajuda para tutoriais e documentação completa</li>
              </ul>
            </div>

            <div style="background: #e7f5ff; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #339af0;">
              <p style="margin: 0; color: #0066cc; font-weight: bold;">
                📈 Planos Pagos Disponíveis
              </p>
              <p style="margin: 5px 0; color: #495057; font-size: 13px;">
                Quando seu trial expirar, escolha entre:
              </p>
              <ul style="margin: 5px 0; color: #495057; font-size: 13px;">
                <li><strong>Gestão:</strong> R$ 497/mês - 200 processos por mês</li>
                <li><strong>Performance:</strong> R$ 1.197/mês - 500 processos por mês</li>
              </ul>
            </div>
          </div>

          <div style="text-align: center; margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              Tem dúvidas? Entre em contato via nosso <strong>chat de suporte</strong> - nossa equipe está aqui para ajudar!
            </p>
            <p style="margin: 10px 0 0 0; color: #999; font-size: 12px;">
              Este é um email automático do JustoAI. ${data.timestamp}
            </p>
          </div>
        </div>
      `,
      text: `
        Bem-vindo ao JustoAI, ${data.userName}!

        Você se registrou com sucesso. Seu workspace "${data.workspaceName}" está ativo.

        🎁 TRIAL GRATUITO
        - Duração: ${data.trialDaysRemaining} dias
        - Expira em: ${formattedDate}
        - Créditos de boas-vindas: ${data.onboardingCredits}

        🚀 PRÓXIMOS PASSOS:
        1. Acesse seu dashboard: ${process.env.NEXT_PUBLIC_APP_URL || 'https://justoai.com.br'}/dashboard
        2. Faça um upload de teste para explorar a análise inteligente
        3. Configure seus primeiros relatórios executivos
        4. Explore as integrações disponíveis

        💡 DICAS:
        - Comece com um pequeno upload (5-10 processos)
        - Explore diferentes tipos de relatórios
        - Acesse a seção de Ajuda para tutoriais completos

        📈 PLANOS PAGOS (quando o trial expirar):
        - Gestão: R$ 497/mês (200 processos)
        - Performance: R$ 1.197/mês (500 processos)

        Tem dúvidas? Use nosso chat de suporte - estamos aqui para ajudar!

        JustoAI - Inteligência Artificial para Advocacia
      `
    };
  }

  private getSystemNotificationTemplate(data: SystemNotificationData): EmailTemplate {
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
    } catch (_error) {
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

export const sendTrialExpiringEmail = (to: string, userName: string, workspaceName: string, daysRemaining: number, expiresAt: Date) =>
  getEmailService().sendTrialExpiring(to, userName, workspaceName, daysRemaining, expiresAt);

export const sendWelcomeEmail = (to: string, userName: string, workspaceName: string, trialDaysRemaining: number, trialEndsAt: Date, onboardingCredits: number) =>
  getEmailService().sendWelcome(to, userName, workspaceName, trialDaysRemaining, trialEndsAt, onboardingCredits);