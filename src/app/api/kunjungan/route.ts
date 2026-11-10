import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

// GET /api/kunjungan - Ambil daftar kunjungan beserta antrean
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const dokterId = searchParams.get('dokterId')
    const tanggal = searchParams.get('tanggal')

    let query = supabase.from('kunjungan').select(`
      id,
      no_referensi,
      pasien_id,
      dokter_id,
      layanan_id,
      jadwal_id,
      tanggal,
      keluhan,
      sumber,
      status,
      created_at,
      antrean (
        id,
        nomor_antrean,
        status,
        alasan,
        waktu_dipanggil
      )
    `)

    if (dokterId) query = query.eq('dokter_id', dokterId)
    if (tanggal) query = query.eq('tanggal', tanggal)

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.warn('API /api/kunjungan note:', error.message)
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

// POST /api/kunjungan - Pendaftaran kunjungan baru (online atau walk-in)
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const body = await request.json()
    const {
      pasienId,
      dokterId,
      layananId,
      jadwalId,
      tanggal,
      keluhan,
      sumber = 'online',
    } = body

    if (!dokterId || !layananId || !tanggal) {
      return NextResponse.json(
        { error: 'Dokter, Layanan, dan Tanggal wajib diisi' },
        { status: 400 }
      )
    }

    // 1. Hitung nomor antrean berikutnya untuk dokter dan tanggal ini
    const { data: existingQueues } = await supabase
      .from('antrean')
      .select('nomor_antrean')
      .eq('dokter_id', dokterId)
      .eq('tanggal', tanggal)
      .order('nomor_antrean', { ascending: false })
      .limit(1)

    const nextQueueNumber =
      existingQueues && existingQueues.length > 0
        ? existingQueues[0].nomor_antrean + 1
        : 1

    const noRef = `KJ-${tanggal.replace(/-/g, '')}-${String(nextQueueNumber).padStart(3, '0')}`

    // 2. Simpan ke tabel kunjungan
    const { data: newVisit, error: visitErr } = await supabase
      .from('kunjungan')
      .insert([
        {
          no_referensi: noRef,
          pasien_id: pasienId || null,
          dokter_id: dokterId,
          layanan_id: layananId,
          jadwal_id: jadwalId || null,
          tanggal: tanggal,
          keluhan: keluhan || '',
          sumber: sumber === 'Walk-in' || sumber === 'walk_in' ? 'walk_in' : 'online',
          status: 'terdaftar',
        },
      ])
      .select()
      .single()

    if (visitErr) {
      return NextResponse.json({ error: visitErr.message }, { status: 500 })
    }

    // 3. Simpan ke tabel antrean
    const { data: newQueue, error: queueErr } = await supabase
      .from('antrean')
      .insert([
        {
          kunjungan_id: newVisit.id,
          dokter_id: dokterId,
          tanggal: tanggal,
          nomor_antrean: nextQueueNumber,
          status: 'menunggu',
        },
      ])
      .select()
      .single()

    return NextResponse.json({
      data: {
        ...newVisit,
        antrean: newQueue || null,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
