import { createClient } from '@supabase/supabase-js'

/**
 * createAdminClient — hanya untuk Supabase Auth Admin dan Storage di server.
 * DILARANG dipakai untuk query tabel bisnis (kunjungan, pasien, dll.).
 * Gunakan Drizzle ORM (db atau denganRls) untuk seluruh data bisnis.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY belum diisi di .env.local')
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

