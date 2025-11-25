/**
 * Cron Job: Send trial expiration reminders
 * Runs daily to send emails to users with trials expiring in 2 days
 *
 * Can be triggered by Vercel Crons (vercel.json) or manually via GET request
 */

import { NextRequest, NextResponse } from 'next/server';
import trialService from '@/lib/services/trialService';
import { sendTrialExpiringEmail } from '@/lib/email-service';
import { ICONS } from '@/lib/icons';

export async function GET(request: NextRequest) {
  try {
    // Verify request is from Vercel with CRON_SECRET
    // CRITICAL: CRON_SECRET must be defined in production

    // Skip auth in development
    if (process.env.NODE_ENV !== 'development') {
      const cronSecret = process.env.CRON_SECRET;
      if (!cronSecret) {
        console.error(`${ICONS.ERROR} [CRON] CRON_SECRET not defined in production - rejecting request`);
        return NextResponse.json(
          { error: 'Unauthorized - CRON_SECRET not configured' },
          { status: 401 }
        );
      }

      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn(`${ICONS.WARNING} [CRON] Unauthorized trial-reminders request`);
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log(`${ICONS.CLOCK} [CRON] Starting trial expiration reminder check...`);

    // Find trials expiring in the next 2 days
    const expiringTrials = await trialService.getTrialsExpiringWithin(2);
    console.log(`${ICONS.INFO} Found ${expiringTrials.length} trials expiring in 2 days`);

    let emailsSent = 0;
    let errors = 0;

    // Send emails to each workspace admin
    for (const workspace of expiringTrials) {
      try {
        const adminUser = workspace.users.find(uw => uw.role === 'ADMIN');
        if (!adminUser?.user?.email) {
          console.warn(`${ICONS.WARNING} No admin email found for workspace ${workspace.id}`);
          continue;
        }

        const trialStatus = await trialService.getTrialStatus(workspace.id);

        // Send email
        await sendTrialExpiringEmail(
          adminUser.user.email,
          adminUser.user.name || adminUser.user.email,
          workspace.name,
          trialStatus.daysRemaining,
          trialStatus.endsAt!
        );

        emailsSent++;
        console.log(
          `${ICONS.CHECK} Sent trial reminder email to ${adminUser.user.email} ` +
          `(${trialStatus.daysRemaining} days remaining)`
        );
      } catch (error) {
        console.error(
          `${ICONS.ERROR} Error sending trial reminder for workspace ${workspace.id}:`,
          error
        );
        errors++;
      }
    }

    console.log(
      `${ICONS.DONE} Trial reminder job completed: ` +
      `${emailsSent} emails sent, ${errors} errors`
    );

    return NextResponse.json(
      {
        success: true,
        message: `Sent ${emailsSent} trial reminder emails`,
        expiringTrialsCount: expiringTrials.length,
        emailsSent,
        errors
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`${ICONS.ERROR} [CRON] Trial reminders error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Allow manual trigger via POST with secret
  return GET(request);
}
