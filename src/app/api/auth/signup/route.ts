import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, phone } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: Record<string, unknown> | undefined) {
            try {
              if (options && typeof options === 'object') {
                cookieStore.set({ name, value, ...options })
              } else {
                cookieStore.set(name, value)
              }
            } catch (_error) {
              // Cookie setting might fail in middleware
            }
          },
          remove(name: string, _options: Record<string, unknown> | undefined) {
            try {
              cookieStore.delete(name)
            } catch (_error) {
              // Cookie deletion might fail
            }
          },
        },
      }
    )

    // Sign up with Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/verify-email`,
        data: {
          name: name || email,
          phone: phone || '',
          marketingConsent: false,
          consentDate: new Date().toISOString(),
        },
      },
    })

    if (authError) {
      console.error('❌ Supabase signup error:', authError.message)
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Signup failed' },
        { status: 400 }
      )
    }

    console.log('✅ User signed up in Supabase:', authData.user.id)

    // Create user in database
    const user = await prisma.user.upsert({
      where: { supabaseId: authData.user.id },
      create: {
        supabaseId: authData.user.id,
        email,
        name: name || email,
      },
      update: {
        name: name || email,
      },
    })

    console.log('✅ User created/updated in database:', user.id)

    // Create default workspace with 7-day TRIAL plan
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7); // 7 days from now

    const workspace = await prisma.workspace.create({
      data: {
        name: `${name || email}'s Workspace`,
        slug: `workspace-${Date.now()}`,
        plan: 'TRIAL',
        trialEndsAt,
        users: {
          create: {
            userId: user.id,
            role: 'ADMIN',
          },
        },
        // Grant onboarding credits for trial
        credits: {
          create: {
            reportCreditsBalance: 50,
            fullCreditsBalance: 50,
          },
        },
      },
      include: {
        users: true,
      },
    })

    console.log('✅ Default workspace created with TRIAL plan (expires', trialEndsAt.toISOString(), '):', workspace.id)

    // Send welcome email to user
    try {
      const { sendWelcomeEmail } = await import('@/lib/email-service');
      const reportCredits = workspace.credits?.reportCreditsBalance || 50;
      const fullCredits = workspace.credits?.fullCreditsBalance || 50;
      const totalCredits = reportCredits + fullCredits;

      await sendWelcomeEmail(
        email,
        user.name || email,
        workspace.name,
        7, // trialDaysRemaining
        trialEndsAt,
        totalCredits
      );
      console.log('✅ Welcome email sent to', email);
    } catch (_error) {
      console.warn('Could not send welcome email:', _error);
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        workspace: {
          id: workspace.id,
          name: workspace.name,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('❌ Signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
