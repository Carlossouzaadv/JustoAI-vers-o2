import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

// Re-export createClient for compatibility
export { createClient }

// Test connection function
export async function testSupabaseConnection() {
  try {
    const { error } = await supabase.from('test').select('*').limit(1)
    if (error && error.code !== 'PGRST116') { // PGRST116 is "table not found" which is expected
      throw error
    }
    return { success: true, message: 'Supabase connection successful!' }
  } catch (error) {
    return {
      success: false,
      message: `Supabase connection failed: ${error}`
    }
  }
}