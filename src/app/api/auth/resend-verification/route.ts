/**
 * API Endpoint - Resend Verification Email
 * POST /api/auth/resend-verification
 * Resends the email verification link to unverified accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';
import { EmailService } from '@/lib/email-service';
import crypto from 'crypto';

const resendVerificationSchema = z.object({
  email: z.string().email('Email inválido')
});

export async function POST(request: NextRequest) {
  try {
    console.log(`${ICONS.PROCESS} Resend verification email request`);

    const body = await request.json();
    const { email } = resendVerificationSchema.parse(body);

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      // Don't reveal if email exists (security best practice)
      console.log(`${ICONS.INFO} Verification resend requested for non-existent email: ${email}`);
      return NextResponse.json({
        success: true,
        message: 'Se o email existir na nossa base, você receberá um link de verificação'
      });
    }

    // Check if user is already verified
    if (user.emailVerified) {
      console.log(`${ICONS.INFO} Verification resend requested for already verified user: ${email}`);
      return NextResponse.json({
        success: true,
        message: 'Sua conta já está verificada'
      });
    }

    // Generate new verification token (valid for 24 hours)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with new verification token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationTokenHash,
        emailVerificationTokenExpiresAt: expiresAt
      }
    });

    // Send verification email
    const verifyLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://justoai.com.br'}/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;

    const emailService = new EmailService();
    const emailHtml = `
      <h2>Verificar Email - JustoAI</h2>
      <p>Olá ${user.name || 'Usuário'},</p>
      <p>Bem-vindo à JustoAI! Para completar seu registro, clique no link abaixo para verificar seu email:</p>
      <p><a href="${verifyLink}" style="background-color: #F97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verificar Email</a></p>
      <p>Este link expira em 24 horas.</p>
      <p>Se você não solicitou isto, ignore este email.</p>
      <hr>
      <p style="color: #999; font-size: 12px;">JustoAI © 2025 - Análise Inteligente de Processos</p>
    `;

    await emailService.sendCustomEmail(
      user.email,
      'Verificar Email - JustoAI',
      emailHtml
    );

    console.log(`${ICONS.SUCCESS} Verification email resent to: ${email}`);

    return NextResponse.json({
      success: true,
      message: 'Se o email existir na nossa base, você receberá um link de verificação'
    });

  } catch (_error) {
    console.error(`${ICONS.ERROR} Error in resend verification:`, error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Email inválido' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Erro ao processar solicitação' },
      { status: 500 }
    );
  }
}
