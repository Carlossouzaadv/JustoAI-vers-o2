/**
 * SMS Service - Twilio Integration for SMS Notifications
 * ================================================================
 * Centralized SMS service for JustoAI using Twilio API
 *
 * Features:
 * - Send SMS messages to users
 * - Track delivery status
 * - Retry failed messages
 * - Support for different message templates
 */

import { ICONS } from './icons'
import { log, logError } from '@/lib/services/logger'

export interface SMSTemplate {
  body: string
  variables?: Record<string, string>
}

export interface SMSNotification {
  to: string | string[] // Phone number(s) in E.164 format (+5511987654321)
  template: 'process-alert' | 'report-ready' | 'payment-success' | 'trial-warning' | 'batch-complete' | 'custom'
  data: unknown
  priority?: 'high' | 'normal' | 'low'
}

export interface SMSResult {
  success: boolean
  messageId?: string
  status?: 'queued' | 'sending' | 'sent' | 'failed' | 'undelivered'
  error?: string
  provider: 'twilio'
}

export interface SMSDeliveryStatus {
  messageId: string
  to: string
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'undelivered'
  sentAt?: Date
  deliveredAt?: Date
  error?: string
}

/**
 * SMS Service using Twilio
 * Handles all SMS communications for JustoAI
 */
export class SMSService {
  private readonly accountSid: string
  private readonly authToken: string
  private readonly fromNumber: string
  private readonly baseUrl = 'https://api.twilio.com'
  private readonly maxRetries = 3
  private readonly retryDelays = [5000, 30000, 300000] // 5s, 30s, 5m

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || ''
    this.authToken = process.env.TWILIO_AUTH_TOKEN || ''
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || ''

    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      logError(
        new Error('Missing Twilio configuration'),
        'SMS Service not fully configured',
        { component: 'smsService' }
      )
    }
  }

  /**
   * Send SMS notification
   */
  async sendNotification(notification: SMSNotification): Promise<SMSResult> {
    try {
      const recipients = Array.isArray(notification.to) ? notification.to : [notification.to]

      // Validate phone numbers
      for (const phone of recipients) {
        if (!this.isValidPhoneNumber(phone)) {
          logError(
            new Error(`Invalid phone number: ${phone}`),
            'Invalid phone number format',
            { component: 'smsService', phone }
          )
          return {
            success: false,
            error: `Invalid phone number: ${phone}`,
            provider: 'twilio',
          }
        }
      }

      // Get template content
      const template = this.getTemplate(notification.template, notification.data)

      // Send to all recipients
      const results: SMSResult[] = []
      for (const to of recipients) {
        const result = await this.sendSMS(to, template.body, notification.priority)
        results.push(result)
      }

      // If any succeeded, overall success
      const overallSuccess = results.some((r) => r.success)
      const firstResult = results[0]

      log.info({
        msg: 'SMS notifications sent',
        component: 'smsService',
        total: results.length,
        successful: results.filter((r) => r.success).length,
        template: notification.template,
      })

      return {
        success: overallSuccess,
        messageId: firstResult?.messageId,
        status: firstResult?.status,
        error: results.find((r) => !r.success)?.error,
        provider: 'twilio',
      }
    } catch (_error) {
      logError(_error, 'Error sending SMS notification', { component: 'smsService' })

      return {
        success: false,
        error: _error instanceof Error ? _error.message : 'Unknown error',
        provider: 'twilio',
      }
    }
  }

  /**
   * Send single SMS message
   */
  private async sendSMS(to: string, body: string, priority?: string): Promise<SMSResult> {
    try {
      // Construct request to Twilio API
      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')

      const response = await fetch(
        `${this.baseUrl}/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: to,
            From: this.fromNumber,
            Body: body,
          }).toString(),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        logError(
          new Error(error.message),
          'Twilio API error',
          { component: 'smsService', statusCode: response.status }
        )

        return {
          success: false,
          error: error.message || 'Twilio API error',
          status: 'failed',
          provider: 'twilio',
        }
      }

      const responseData = await response.json() as Record<string, unknown>
      const messageSid = typeof responseData.sid === 'string' ? responseData.sid : ''
      const messageStatus = typeof responseData.status === 'string'
        ? (responseData.status as 'queued' | 'sending' | 'sent' | 'failed' | 'undelivered')
        : 'sent'

      log.info({
        msg: 'SMS sent successfully',
        component: 'smsService',
        messageId: messageSid,
        to,
        status: messageStatus,
      })

      return {
        success: true,
        messageId: messageSid,
        status: messageStatus,
        provider: 'twilio',
      }
    } catch (_error) {
      logError(_error, 'Failed to send SMS via Twilio', { component: 'smsService' })

      return {
        success: false,
        error: _error instanceof Error ? _error.message : 'Unknown error',
        status: 'failed',
        provider: 'twilio',
      }
    }
  }

  /**
   * Get SMS message template
   */
  private getTemplate(
    templateType: SMSNotification['template'],
    data: unknown
  ): { body: string } {
    const maxLength = 160 // Standard SMS length

    // Type-safe data extraction
    function getString(obj: unknown, key: string, fallback = ''): string {
      if (typeof obj === 'object' && obj !== null) {
        const value = (obj as Record<string, unknown>)[key]
        return typeof value === 'string' ? value : fallback
      }
      return fallback
    }

    function getNumber(obj: unknown, key: string, fallback = 0): number {
      if (typeof obj === 'object' && obj !== null) {
        const value = (obj as Record<string, unknown>)[key]
        return typeof value === 'number' ? value : fallback
      }
      return fallback
    }

    switch (templateType) {
      case 'process-alert': {
        const processNumber = getString(data, 'processNumber', 'N/A')
        const description = getString(data, 'description', '')
        const urgency = getString(data, 'urgency', 'normal')
        return {
          body: `JustoAI ALERTA: Processo ${processNumber}. ${description} [Urgência: ${urgency}]`.substring(
            0,
            maxLength
          ),
        }
      }

      case 'report-ready': {
        const reportName = getString(data, 'reportName', 'seu relatório')
        return {
          body: `JustoAI: Seu relatório "${reportName}" está pronto para download.`.substring(
            0,
            maxLength
          ),
        }
      }

      case 'payment-success': {
        const credits = getNumber(data, 'credits', 0)
        return {
          body: `JustoAI: Pagamento confirmado! ${credits} créditos adicionados à sua conta.`.substring(
            0,
            maxLength
          ),
        }
      }

      case 'trial-warning': {
        const daysRemaining = getNumber(data, 'daysRemaining', 0)
        return {
          body: `JustoAI: Seu período de teste expira em ${daysRemaining} dia(s). Faça upgrade agora!`.substring(
            0,
            maxLength
          ),
        }
      }

      case 'batch-complete': {
        const batchName = getString(data, 'batchName', 'lote')
        const successCount = getNumber(data, 'successCount', 0)
        const totalCount = getNumber(data, 'totalCount', 0)
        return {
          body: `JustoAI: Lote "${batchName}" processado. ${successCount}/${totalCount} itens.`.substring(
            0,
            maxLength
          ),
        }
      }

      case 'custom': {
        const body = getString(data, 'body', 'Mensagem do JustoAI')
        return {
          body: body.substring(0, maxLength),
        }
      }

      default: {
        const _exhaustiveCheck: never = templateType
        throw new Error(`Unknown SMS template: ${_exhaustiveCheck}`)
      }
    }
  }

  /**
   * Check delivery status of SMS
   */
  async checkDeliveryStatus(messageId: string): Promise<SMSDeliveryStatus> {
    try {
      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')

      const response = await fetch(
        `${this.baseUrl}/2010-04-01/Accounts/${this.accountSid}/Messages/${messageId}.json`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to get message status: ${response.statusText}`)
      }

      const responseData = await response.json() as Record<string, unknown>
      const messageSid = typeof responseData.sid === 'string' ? responseData.sid : messageId
      const messageStatus = typeof responseData.status === 'string'
        ? (responseData.status as 'queued' | 'sending' | 'sent' | 'failed' | 'undelivered')
        : 'sent'

      return {
        messageId: messageSid,
        to: typeof responseData.to === 'string' ? responseData.to : '',
        status: messageStatus,
        sentAt: typeof responseData.date_sent === 'string' ? new Date(responseData.date_sent) : undefined,
        deliveredAt: typeof responseData.date_updated === 'string' ? new Date(responseData.date_updated) : undefined,
        error: typeof responseData.error_message === 'string' ? responseData.error_message : undefined,
      }
    } catch (_error) {
      logError(_error, 'Failed to check SMS delivery status', { component: 'smsService' })

      return {
        messageId,
        to: '',
        status: 'failed',
        error: _error instanceof Error ? _error.message : 'Unknown error',
      }
    }
  }

  /**
   * Validate phone number format (E.164)
   */
  private isValidPhoneNumber(phone: string): boolean {
    // E.164 format: +[country code][number]
    // Example: +5511987654321 (Brazil)
    const e164Regex = /^\+[1-9]\d{1,14}$/

    return e164Regex.test(phone)
  }

  /**
   * Format phone number to E.164
   */
  static formatPhoneNumber(phone: string, countryCode: string = '55'): string {
    // Remove non-digits
    const digits = phone.replace(/\D/g, '')

    // If already starts with country code, just add +
    if (digits.startsWith(countryCode)) {
      return `+${digits}`
    }

    // If starts with 0, remove it (Brazilian format)
    if (digits.startsWith('0')) {
      return `+${countryCode}${digits.substring(1)}`
    }

    // Add country code
    return `+${countryCode}${digits}`
  }

  /**
   * Retry failed SMS with exponential backoff
   */
  async retryFailedSMS(to: string, body: string, attempt: number = 0): Promise<SMSResult> {
    if (attempt >= this.maxRetries) {
      return {
        success: false,
        error: 'Max retries exceeded',
        status: 'failed',
        provider: 'twilio',
      }
    }

    try {
      // Wait before retry
      if (attempt > 0) {
        const delay = this.retryDelays[Math.min(attempt - 1, this.retryDelays.length - 1)]
        await new Promise((resolve) => setTimeout(resolve, delay))
      }

      const result = await this.sendSMS(to, body)

      if (result.success) {
        return result
      }

      // Recursively retry
      return await this.retryFailedSMS(to, body, attempt + 1)
    } catch (_error) {
      logError(_error, `SMS retry failed (attempt ${attempt + 1}/${this.maxRetries})`, {
        component: 'smsService',
        to,
      })

      return {
        success: false,
        error: _error instanceof Error ? _error.message : 'Unknown error',
        status: 'failed',
        provider: 'twilio',
      }
    }
  }
}

// Singleton instance
let smsService: SMSService | null = null

export function getSMSService(): SMSService {
  if (!smsService) {
    smsService = new SMSService()
  }
  return smsService
}
