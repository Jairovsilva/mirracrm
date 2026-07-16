import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Log de diagnóstico temporário para confirmar qual banco de dados está sendo lido
if (typeof window !== 'undefined') {
  console.log('🔌 MirraCRM conectando ao Supabase URL:', supabaseUrl);
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '❌ ERRO CRÍTICO: Variáveis NEXT_PUBLIC_SUPABASE_URL e/ou NEXT_PUBLIC_SUPABASE_ANON_KEY não configuradas.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});