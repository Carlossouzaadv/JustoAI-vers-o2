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
          set(name: string, value: string, options: unknown) {
            try {
              cookieStore.set(name, value, options)
            } catch (error) {
              // Cookie setting might fail in middleware
            }
          },
          remove(name: string, options: unknown) {
            try {
              cookieStore.delete(name)
            } catch (error) {
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

    // Create default workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: `${name || email}'s Workspace`,
        slug: `workspace-${Date.now()}`,
        users: {
          create: {
            userId: user.id,
            role: 'OWNER',
          },
        },
      },
      include: {
        users: true,
      },
    })

    console.log('✅ Default workspace created:', workspace.id)

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
