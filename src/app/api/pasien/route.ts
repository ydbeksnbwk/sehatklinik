import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

// GET /api/pasien - Ambil daftar pasien
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')

    let query = supabase.from('pasien').select('*')
    if (q) {
      query = query.or(`nama.ilike.%${q}%,no_rekam_medis.ilike.%${q}%,telepon.ilike.%${q}%`)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.warn('API /api/pasien note:', error.message)
      return NextResponse.json({
        data: [],
        warning: error.message,
      })
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

// POST /api/pasien - Tambah pasien baru (misalnya pasien walk-in)
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const body = await request.json()
    const {
      nama,
      tanggalLahir,
      jenisKelamin = 'L',
      telepon,
      alamat,
      kontakDarurat,
      nik,
      profileId,
    } = body

    if (!nama) {
      return NextResponse.json({ error: 'Nama pasien wajib diisi' }, { status: 400 })
    }

    // Generate no rekam medis unik otomatis
    const { count } = await supabase.from('pasien').select('*', { count: 'exact', head: true })
    const nextRM = `RM-${String((count || 0) + 128).padStart(5, '0')}`

    const { data: newPatient, error } = await supabase
      .from('pasien')
      .insert([
        {
          no_rekam_medis: nextRM,
          profile_id: profileId || null,
          nama,
          tanggal_lahir: tanggalLahir || '2000-01-01',
          jenis_kelamin: jenisKelamin === 'Perempuan' || jenisKelamin === 'P' ? 'P' : 'L',
          telepon: telepon || '-',
          alamat: alamat || '-',
          kontak_darurat: kontakDarurat || '-',
          nik: nik || null,
        },
      ])
      .select()
      .single()

    if (error) {
      console.warn('API /api/pasien note:', error.message)
      return NextResponse.json({
        data: [],
        warning: error.message,
      })
    }

    return NextResponse.json({ data: newPatient })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
