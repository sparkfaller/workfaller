import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL과 Anon Key를 .env.local 파일에 설정해주세요')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
