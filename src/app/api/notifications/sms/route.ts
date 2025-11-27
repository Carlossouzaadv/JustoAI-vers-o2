/**
 * API Endpoint - Send SMS Notification
 * POST /api/notifications/sms
 *
 * Sends SMS notifications via Twilio
 * Requires authentication and valid phone number in E.164 format
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper'
import { getSMSService, type SMSNotification } from '@/lib/sms-service'
import { log, logError } from '@/lib/services/logger'
import { ICONS } from '@/lib/icons'

// Validation schema for SMS request
const smsSchema = z.object({
  to: z.union([
    z.string().regex(/^\+[1-9]\d{1,14}$/),
    z.array(z.string().regex(/^\+[1-9]\d{1,14}$/)).min(1),
  ]),
  template: z.enum([
    'process-alert',
    'report-ready',
    'payment-success',
    'trial-warning',
    'batch-complete',
    'custom',
  ]),
  data: z.record(z.string(), z.unknown()).optional(),
  priority: z.enum(['high', 'normal', 'low']).optional(),
})

type SMSRequest = z.infer<typeof smsSchema>

/**
 * Type guard for SMSRequest
 */
function isValidSMSRequest(data: unknown): data is SMSRequest {
  return smsSchema.safeParse(data).success
}

export async function POST(request: NextRequest) {
  try {
    // ============================================================
    // 1. AUTHENTICATION
    // ============================================================

    const user = await getAuthenticatedUser(request)
    if (!user) {
      return unauthorizedResponse('Authentication required')
    }

    log.info({
      msg: 'SMS notification request',
      component: 'smsEndpoint',
      userId: user.id,
    })

    // ============================================================
    // 2. VALIDATE REQUEST BODY
    // ============================================================

    const rawData: unknown = await request.json()

    if (!isValidSMSRequest(rawData)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: smsSchema.safeParse(rawData).error?.issues,
        },
        { status: 400 }
      )
    }

    const { to, template, data, priority } = rawData

    // ============================================================
    // 3. SEND SMS
    // ============================================================

    const smsService = getSMSService()

    const notificationPriority = priority as 'high' | 'normal' | 'low' | undefined

    const notification: SMSNotification = {
      to,
      template,
      data: data || {},
      priority: notificationPriority,
    }

    const result = await smsService.sendNotification(notification)

    if (!result.success) {
      log.error({
        msg: 'Failed to send SMS',
        component: 'smsEndpoint',
        error: result.error,
        template,
      })

      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to send SMS',
        },
        { status: 500 }
      )
    }

    // ============================================================
    // 4. RETURN SUCCESS RESPONSE
    // ============================================================

    log.info({
      msg: 'SMS sent successfully',
      component: 'smsEndpoint',
      messageId: result.messageId,
      template,
      recipients: Array.isArray(to) ? to.length : 1,
    })

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      status: result.status,
      provider: result.provider,
    })
  } catch (error) {
    logError(error, 'Error in SMS notification endpoint', { component: 'smsEndpoint' })

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
