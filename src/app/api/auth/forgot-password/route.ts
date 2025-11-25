/**
 * API Endpoint - Forgot Password
 * POST /api/auth/forgot-password
 * Sends a password reset email to the user
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';
import { EmailService } from '@/lib/email-service';
import crypto from 'crypto';

const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido')
});

export async function POST(request: NextRequest) {
  try {
    console.log(`${ICONS.PROCESS} Password reset request`);

    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      // Don't reveal if email exists (security best practice)
      console.log(`${ICONS.INFO} Password reset requested for non-existent email: ${email}`);
      return NextResponse.json({
        success: true,
        message: 'Se o email existir na nossa base, você receberá um link de reset'
      });
    }

    // Generate reset token (valid for 24 hours)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Save reset token to database
    await prisma.passwordReset.upsert({
      where: { userId: user.id },
      update: {
        token: resetTokenHash,
        expiresAt
      },
      create: {
        userId: user.id,
        token: resetTokenHash,
        expiresAt
      }
    });

    // Send email with reset link
    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://justoai.com.br'}/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    const emailService = new EmailService();
    const emailHtml = `
      <h2>Recuperar Senha - JustoAI</h2>
      <p>Olá ${user.name || 'Usuário'},</p>
      <p>Você solicitou a recuperação de senha para sua conta. Clique no link abaixo para redefinir sua senha:</p>
      <p><a href="${resetLink}" style="background-color: #F97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Redefinir Senha</a></p>
      <p>Este link expira em 24 horas.</p>
      <p>Se você não solicitou isto, ignore este email.</p>
      <hr>
      <p style="color: #999; font-size: 12px;">JustoAI © 2025 - Análise Inteligente de Processos</p>
    `;

    await emailService.sendCustomEmail(
      user.email,
      'Recuperar Senha - JustoAI',
      emailHtml
    );

    console.log(`${ICONS.SUCCESS} Password reset email sent to: ${email}`);

    return NextResponse.json({
      success: true,
      message: 'Se o email existir na nossa base, você receberá um link de reset'
    });

  } catch (_error) {
    console.error(`${ICONS.ERROR} Error in forgot password:`, error);

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
