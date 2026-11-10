import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { target, reason } = body

    const supabase = createAdminClient()

    let newVisitStatus: string | null = null
    let newQueueStatus: string | null = null
    const updates: Record<string, any> = {}

    switch (target) {
      case 'checkin':
        newVisitStatus = 'hadir'
        newQueueStatus = 'menunggu'
        break
      case 'call':
        newVisitStatus = 'hadir'
        newQueueStatus = 'dipanggil'
        updates.waktu_dipanggil = new Date().toISOString()
        break
      case 'start':
        newVisitStatus = 'hadir'
        newQueueStatus = 'diperiksa'
        break
      case 'finish':
        newVisitStatus = 'selesai'
        newQueueStatus = 'selesai'
        break
      case 'skip':
        newQueueStatus = 'dilewati'
        if (reason) updates.alasan = reason
        break
      case 'cancel':
        newVisitStatus = 'batal'
        newQueueStatus = 'batal'
        if (reason) updates.alasan = reason
        break
      default:
        return NextResponse.json({ error: 'Target status tidak valid' }, { status: 400 })
    }

    // Update kunjungan jika status kunjungan berubah
    if (newVisitStatus) {
      await supabase
        .from('kunjungan')
        .update({ status: newVisitStatus })
        .eq('id', id)
    }

    // Update antrean
    if (newQueueStatus) {
      updates.status = newQueueStatus
      await supabase
        .from('antrean')
        .update(updates)
        .eq('kunjungan_id', id)
    }

    return NextResponse.json({
      success: true,
      data: {
        kunjunganId: id,
        visitStatus: newVisitStatus,
        queueStatus: newQueueStatus,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

