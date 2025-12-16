
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAuth() {
    console.log('🧪 Testando Supabase Auth...\n');

    // Teste 1: Health check básico
    console.log('📋 Teste 1: Conexão básica (Public table check)');
    try {
        // Attempting to access a public table or just checking health via a known endpoint if possible, 
        // but user script suggested checking 'users' or similar. 
        // Often 'users' is private. Let's try to list schemas or just a public query.
        // However, following the user's specific script logic from the prompt for consistency.
        // User script: await supabase.from('users').select('count').limit(1);

        const { data: data1, error: error1 } = await supabase.from('User').select('id').limit(1); // Prisma usually maps to User, but Supabase auth is auth.users. 
        // The user's prompt suggested 'users'. I should stick to their script but adapt if 'users' table doesn't exist in public schema (it's likely 'User' if using Prisma with default naming, OR 'users' if custom).
        // Let's check 'User' (capital U) as seen in route.ts (prisma.user). Prisma usually lowercases table names unless mapped.
        // Actually, route.ts uses `prisma.user`, so the table name is likely `User` or `users`.
        // I will try a safe query.

        // Actually, I should use the exact script the user provided in the prompt to avoid deviation complaints.
        const { data, error } = await supabase.from('users').select('count').limit(1);

        if (error) {
            console.warn('  ⚠️ Public table access failed (expected if RLS is on or table mismatch):', error.message);
        } else {
            console.log('  ✅ Supabase public table connected');
        }

        // Simple health check via auth
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
            console.error('  ❌ Auth connection error:', sessionError);
        } else {
            console.log('  ✅ Auth service reachable');
        }

    } catch (error) {
        console.error('  ❌ Erro de conexão:', error);
    }

    // Teste 2: Signup
    console.log('\n📋 Teste 2: Criar usuário teste');
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';

    try {
        const { data, error } = await supabase.auth.signUp({
            email: testEmail,
            password: testPassword,
        });

        if (error) {
            console.error('  ❌ Erro no signup:', error);
            console.error('  📄 Detalhes:', JSON.stringify(error, null, 2));
        } else {
            console.log('  ✅ Usuário criado com sucesso');
            console.log('  📄 User ID:', data.user?.id);
            console.log('  📄 Email:', data.user?.email);
        }
    } catch (error) {
        console.error('  ❌ Erro inesperado:', error);
    }

    // Teste 3: Verificar configuração de auth
    console.log('\n📋 Teste 3: Configuração de auth');
    console.log('  URL:', supabaseUrl);
    console.log('  Key length:', supabaseKey?.length || 0);
}

testAuth();
