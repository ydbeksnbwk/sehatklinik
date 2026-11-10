import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const body = await request.json()
    const { email, password, nama, telepon, tanggalLahir, jenisKelamin, nik } = body

    if (!email || !password || !nama) {
      return NextResponse.json(
        { error: 'Email, password, dan nama wajib diisi' },
        { status: 400 }
      )
    }

    // 1. Daftarkan akun di Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: nama,
          role: 'pasien',
          nik: nik || null,
        },
      },
    })

    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 400 })
    }

    const userId = authData.user?.id

    // 2. Buat profil pasien
    if (userId) {
      const { count } = await supabase.from('pasien').select('*', { count: 'exact', head: true })
      const nextRM = `RM-${String((count || 0) + 128).padStart(5, '0')}`

      await supabase.from('pasien').insert([
        {
          no_rekam_medis: nextRM,
          profile_id: userId,
          nama,
          nik: nik || null,
          tanggal_lahir: tanggalLahir || '2000-01-01',
          jenis_kelamin: jenisKelamin === 'Perempuan' || jenisKelamin === 'P' ? 'P' : 'L',
          telepon: telepon || '-',
        },
      ])
    }

    return NextResponse.json({
      success: true,
      message: 'Registrasi akun berhasil!',
      user: {
        id: userId,
        email,
        nama,
        role: 'Pasien',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

