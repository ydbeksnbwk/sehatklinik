import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: kunjunganId } = await params
    const body = await request.json()
    const { dokterId, anamnesis, tandaVital, diagnosis, catatan, tindakan = [] } = body

    const supabase = createAdminClient()

    // 1. Simpan pemeriksaan
    const { data: newExam, error: examErr } = await supabase
      .from('pemeriksaan')
      .upsert(
        [
          {
            kunjungan_id: kunjunganId,
            dokter_id: dokterId,
            anamnesis: anamnesis || '',
            tanda_vital: tandaVital || {},
            diagnosis: diagnosis || '',
            catatan: catatan || '',
          },
        ],
        { onConflict: 'kunjungan_id' }
      )
      .select()
      .single()

    if (examErr) {
      return NextResponse.json({ error: examErr.message }, { status: 500 })
    }

    // 2. Simpan tindakan medis jika ada
    if (tindakan && tindakan.length > 0) {
      const actionsToInsert = tindakan.map((t: any) => ({
        pemeriksaan_id: newExam.id,
        nama_tindakan: t.name || t.nama_tindakan || '',
        keterangan: t.description || t.keterangan || '',
        saran: t.advice || t.saran || '',
      }))

      // Hapus tindakan lama untuk pemeriksaan ini (replace)
      await supabase.from('tindakan').delete().eq('pemeriksaan_id', newExam.id)
      await supabase.from('tindakan').insert(actionsToInsert)
    }

    return NextResponse.json({
      success: true,
      data: newExam,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

