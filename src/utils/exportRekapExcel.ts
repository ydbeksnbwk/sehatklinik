import type ExcelJS from "exceljs"
import {
  dateLabel,
  type Doctor,
  type Patient,
  type Service,
  type Visit,
} from "../clinic-data"
import type { ClinicProfile } from "../context/ClinicContext"

export type ExportRekapParams = {
  visits: Visit[]
  patients: Patient[]
  doctors: Doctor[]
  services: Service[]
  clinic: ClinicProfile
  periodLabel: string
  sortOrder: "asc" | "desc"
  fileSuffix: string
}

const COLORS = {
  navy: "FF1E3A8A",
  navyDark: "FF172554",
  softBlue: "FFEFF6FF",
  accentBorder: "FF93C5FD",
  slateDark: "FF0F172A",
  slateMuted: "FF475569",
  zebra: "FFF8FAFC",
  white: "FFFFFFFF",
  border: "FFCBD5E1",
  footerBg: "FFE2E8F0",
}

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: COLORS.border } },
  left: { style: "thin", color: { argb: COLORS.border } },
  bottom: { style: "thin", color: { argb: COLORS.border } },
  right: { style: "thin", color: { argb: COLORS.border } },
}

const STATUS_STYLES: Record<string, { bg: string; fg: string }> = {
  Selesai: { bg: "FFECFDF5", fg: "FF047857" },
  Hadir: { bg: "FFEFF6FF", fg: "FF1D4ED8" },
  Dipanggil: { bg: "FFEFF6FF", fg: "FF1D4ED8" },
  "Sedang Diperiksa": { bg: "FFEFF6FF", fg: "FF1D4ED8" },
  Menunggu: { bg: "FFFFFBEB", fg: "FFB45309" },
  Terdaftar: { bg: "FFFFFBEB", fg: "FFB45309" },
  Dibatalkan: { bg: "FFFEF2F2", fg: "FFB91C1C" },
  Dilewati: { bg: "FFFEF2F2", fg: "FFB91C1C" },
}

function lastColLetter(colCount: number): string {
  return String.fromCharCode(64 + colCount)
}

function applyStatusBadgeStyle(cell: ExcelJS.Cell, value: string) {
  const match = STATUS_STYLES[value]
  if (!match) return
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: match.bg } }
  cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: match.fg } }
}

/**
 * Adds a clinic letterhead and report title banner at the top of a worksheet.
 */
function styleKopHeader(
  sheet: ExcelJS.Worksheet,
  colCount: number,
  clinic: ClinicProfile,
  reportTitle: string,
  metaText: string,
) {
  const endCol = lastColLetter(colCount)

  sheet.mergeCells(`A1:${endCol}1`)
  const r1 = sheet.getRow(1)
  r1.height = 28
  const c1 = sheet.getCell("A1")
  c1.value = (clinic.name || "Klinik Sehat Sentosa").toUpperCase()
  c1.font = { name: "Calibri", size: 15, bold: true, color: { argb: COLORS.navy } }
  c1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.softBlue } }
  c1.alignment = { vertical: "middle", horizontal: "center" }

  sheet.mergeCells(`A2:${endCol}2`)
  const r2 = sheet.getRow(2)
  r2.height = 20
  const c2 = sheet.getCell("A2")
  const contactParts = [
    clinic.address,
    clinic.phone ? `Telp: ${clinic.phone}` : "",
    clinic.email ? `Email: ${clinic.email}` : "",
  ].filter(Boolean)
  c2.value = contactParts.join("   •   ")
  c2.font = { name: "Calibri", size: 9.5, color: { argb: COLORS.slateMuted } }
  c2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.softBlue } }
  c2.alignment = { vertical: "middle", horizontal: "center" }
  c2.border = { bottom: { style: "medium", color: { argb: COLORS.accentBorder } } }

  sheet.mergeCells(`A3:${endCol}3`)
  const r3 = sheet.getRow(3)
  r3.height = 24
  const c3 = sheet.getCell("A3")
  c3.value = reportTitle
  c3.font = { name: "Calibri", size: 12, bold: true, color: { argb: COLORS.slateDark } }
  c3.alignment = { vertical: "middle", horizontal: "center" }

  sheet.mergeCells(`A4:${endCol}4`)
  const r4 = sheet.getRow(4)
  r4.height = 19
  const c4 = sheet.getCell("A4")
  c4.value = metaText
  c4.font = { name: "Calibri", size: 9.5, italic: true, color: { argb: COLORS.slateMuted } }
  c4.alignment = { vertical: "middle", horizontal: "center" }

  sheet.getRow(5).height = 8
}

/**
 * Renders a titled breakdown table on the summary worksheet.
 */
function addBreakdownTable(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  sectionTitle: string,
  colHeader: string,
  items: { label: string; count: number }[],
  totalVisits: number,
): number {
  let rowIdx = startRow

  sheet.mergeCells(`A${rowIdx}:C${rowIdx}`)
  const titleRow = sheet.getRow(rowIdx)
  titleRow.height = 22
  const titleCell = sheet.getCell(`A${rowIdx}`)
  titleCell.value = sectionTitle
  titleCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: COLORS.navy } }
  titleCell.alignment = { vertical: "middle", horizontal: "left" }
  rowIdx++

  const headerRow = sheet.getRow(rowIdx)
  headerRow.height = 24
  ;[colHeader, "Jumlah Kunjungan", "Persentase"].forEach((text, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = text
    cell.font = { name: "Calibri", size: 10.5, bold: true, color: { argb: COLORS.white } }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navy } }
    cell.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "center" }
    cell.border = THIN_BORDER
  })
  rowIdx++

  items.forEach((item, idx) => {
    const row = sheet.getRow(rowIdx)
    row.height = 21
    const bg = idx % 2 === 1 ? COLORS.zebra : COLORS.white
    const ratio = totalVisits > 0 ? item.count / totalVisits : 0

    const cLabel = row.getCell(1)
    cLabel.value = item.label
    cLabel.alignment = { vertical: "middle", horizontal: "left" }

    const cCount = row.getCell(2)
    cCount.value = item.count
    cCount.numFmt = "#,##0"
    cCount.alignment = { vertical: "middle", horizontal: "center" }

    const cPct = row.getCell(3)
    cPct.value = ratio
    cPct.numFmt = "0.0%"
    cPct.alignment = { vertical: "middle", horizontal: "center" }

    ;[cLabel, cCount, cPct].forEach((c) => {
      c.font = { name: "Calibri", size: 10, color: { argb: COLORS.slateDark } }
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } }
      c.border = THIN_BORDER
    })
    rowIdx++
  })

  const totalRow = sheet.getRow(rowIdx)
  totalRow.height = 22
  const t1 = totalRow.getCell(1)
  t1.value = "Total"
  t1.alignment = { vertical: "middle", horizontal: "left" }
  const t2 = totalRow.getCell(2)
  t2.value = totalVisits
  t2.numFmt = "#,##0"
  t2.alignment = { vertical: "middle", horizontal: "center" }
  const t3 = totalRow.getCell(3)
  t3.value = totalVisits > 0 ? 1 : 0
  t3.numFmt = "0.0%"
  t3.alignment = { vertical: "middle", horizontal: "center" }

  ;[t1, t2, t3].forEach((c) => {
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: COLORS.slateDark } }
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.footerBg } }
    c.border = THIN_BORDER
  })

  return rowIdx + 2
}

/**
 * Builds a formatted multi-sheet ExcelJS workbook for visit recapitulation.
 */
export async function buildRekapWorkbook(
  params: ExportRekapParams,
): Promise<ExcelJS.Workbook> {
  const mod = await import("exceljs")
  const Excel = (mod.default || mod) as typeof ExcelJS
  const {
    visits,
    patients,
    doctors,
    services,
    clinic,
    periodLabel,
    sortOrder,
  } = params

  const patientMap = new Map(patients.map((p) => [p.id, p]))
  const doctorMap = new Map(doctors.map((d) => [d.id, d.name]))
  const serviceMap = new Map(services.map((s) => [s.id, s.name]))

  const sortLabel =
    sortOrder === "asc" ? "Terlama → Terbaru" : "Terbaru → Terlama"
  const printedAt = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  const metaLine = `Periode: ${periodLabel}   |   Urutan: ${sortLabel}   |   Total Data: ${visits.length} Kunjungan   |   Dicetak: ${printedAt}`

  const wb = new Excel.Workbook()
  wb.creator = clinic.name || "Sistem Informasi Klinik"
  wb.created = new Date()

  // ==================== SHEET 1: DATA KUNJUNGAN ====================
  const wsData = wb.addWorksheet("Data Kunjungan", {
    views: [{ state: "frozen", ySplit: 6 }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: "6:6",
    },
  })

  const colWidths = [6, 20, 19, 24, 20, 26, 22, 13, 18, 19, 34]
  colWidths.forEach((width, idx) => {
    wsData.getColumn(idx + 1).width = width
  })

  styleKopHeader(
    wsData,
    colWidths.length,
    clinic,
    "LAPORAN REKAPITULASI KUNJUNGAN PASIEN",
    metaLine,
  )

  const headers = [
    "No",
    "No. Referensi",
    "Tanggal Kunjungan",
    "Nama Pasien",
    "NIK Pasien",
    "Dokter Pemeriksa",
    "Layanan / Poli",
    "Sumber",
    "Status Kunjungan",
    "Status Pelayanan",
    "Keluhan Pasien",
  ]
  const headerRow = wsData.getRow(6)
  headerRow.height = 28
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = h
    cell.font = {
      name: "Calibri",
      size: 10.5,
      bold: true,
      color: { argb: COLORS.white },
    }
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.navy },
    }
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true }
    cell.border = THIN_BORDER
  })

  wsData.autoFilter = {
    from: { row: 6, column: 1 },
    to: { row: 6 + visits.length, column: colWidths.length },
  }

  visits.forEach((v, idx) => {
    const rowNumber = 7 + idx
    const row = wsData.getRow(rowNumber)
    const patientObj = patientMap.get(v.patient)
    const complaint = v.complaint?.trim() || "-"
    const estimatedLines = Math.max(1, Math.ceil(complaint.length / 32))
    row.height = Math.max(22, estimatedLines * 15 + 6)

    const safeDate = v.date ? v.date.slice(0, 10) : ""
    const rowValues = [
      idx + 1,
      v.id,
      safeDate ? dateLabel(safeDate) : "-",
      patientObj?.name || "Pasien",
      patientObj?.nik || "-",
      doctorMap.get(v.doctor) || "Dokter",
      serviceMap.get(v.service) || "Layanan",
      v.source,
      v.status,
      v.queue,
      complaint,
    ]

    const bg = idx % 2 === 1 ? COLORS.zebra : COLORS.white
    const centerCols = new Set([1, 2, 3, 5, 8, 9, 10])

    rowValues.forEach((val, colIdx) => {
      const colNumber = colIdx + 1
      const cell = row.getCell(colNumber)
      cell.value = val
      cell.font = {
        name: "Calibri",
        size: 10,
        color: { argb: COLORS.slateDark },
      }
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } }
      cell.border = THIN_BORDER
      cell.alignment = {
        vertical: "middle",
        horizontal: centerCols.has(colNumber) ? "center" : "left",
        wrapText: !centerCols.has(colNumber),
      }
      // Prevent Excel from formatting 16-digit NIK as scientific notation
      if (colNumber === 5) {
        cell.numFmt = "@"
      }
      if (colNumber === 9 || colNumber === 10) {
        applyStatusBadgeStyle(cell, String(val))
      }
    })
  })

  // Footer total row
  const footerRowNum = 7 + visits.length
  wsData.mergeCells(`A${footerRowNum}:J${footerRowNum}`)
  const footerRow = wsData.getRow(footerRowNum)
  footerRow.height = 24
  for (let c = 1; c <= colWidths.length; c++) {
    const cell = footerRow.getCell(c)
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.footerBg },
    }
    cell.border = THIN_BORDER
    cell.font = {
      name: "Calibri",
      size: 10.5,
      bold: true,
      color: { argb: COLORS.slateDark },
    }
  }
  const fLabel = footerRow.getCell(1)
  fLabel.value = "TOTAL KUNJUNGAN PADA PERIODE TERPILIH"
  fLabel.alignment = { vertical: "middle", horizontal: "right" }
  const fCount = footerRow.getCell(11)
  fCount.value = `${visits.length} Kunjungan`
  fCount.alignment = { vertical: "middle", horizontal: "center" }

  // ==================== SHEET 2: RINGKASAN & STATISTIK ====================
  const wsSummary = wb.addWorksheet("Ringkasan & Statistik", {
    pageSetup: {
      orientation: "portrait",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  })
  wsSummary.getColumn(1).width = 34
  wsSummary.getColumn(2).width = 22
  wsSummary.getColumn(3).width = 18

  styleKopHeader(
    wsSummary,
    3,
    clinic,
    "RINGKASAN STATISTIK KUNJUNGAN",
    metaLine,
  )

  let nextRow = 6

  // Info metadata block
  wsSummary.mergeCells(`A${nextRow}:C${nextRow}`)
  const infoTitle = wsSummary.getRow(nextRow)
  infoTitle.height = 22
  const infoTitleCell = wsSummary.getCell(`A${nextRow}`)
  infoTitleCell.value = "A. Informasi Periode Laporan"
  infoTitleCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: COLORS.navy } }
  infoTitleCell.alignment = { vertical: "middle", horizontal: "left" }
  nextRow++

  const infoPairs: [string, string | number][] = [
    ["Periode Data", periodLabel],
    ["Urutan Tanggal", sortLabel],
    ["Tanggal Cetak", printedAt],
    ["Total Kunjungan Direkap", visits.length],
  ]
  infoPairs.forEach(([k, val], idx) => {
    const r = wsSummary.getRow(nextRow)
    r.height = 21
    wsSummary.mergeCells(`B${nextRow}:C${nextRow}`)
    const ck = r.getCell(1)
    ck.value = k
    ck.font = { name: "Calibri", size: 10, bold: true, color: { argb: COLORS.slateDark } }
    ck.alignment = { vertical: "middle", horizontal: "left" }
    const cv = r.getCell(2)
    cv.value = val
    cv.font = { name: "Calibri", size: 10, color: { argb: COLORS.slateDark } }
    cv.alignment = { vertical: "middle", horizontal: "left" }
    const bg = idx % 2 === 1 ? COLORS.zebra : COLORS.white
    ;[1, 2, 3].forEach((c) => {
      const cell = r.getCell(c)
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } }
      cell.border = THIN_BORDER
    })
    nextRow++
  })

  nextRow += 1

  // Breakdown by Queue / Service Status
  const statusOrder = [
    "Selesai",
    "Sedang Diperiksa",
    "Dipanggil",
    "Menunggu",
    "Dilewati",
    "Dibatalkan",
  ]
  nextRow = addBreakdownTable(
    wsSummary,
    nextRow,
    "B. Rekapitulasi Status Pelayanan",
    "Status Pelayanan",
    statusOrder.map((st) => ({
      label: st,
      count: visits.filter((v) => v.queue === st).length,
    })),
    visits.length,
  )

  // Breakdown by Registration Source
  nextRow = addBreakdownTable(
    wsSummary,
    nextRow,
    "C. Rekapitulasi Sumber Pendaftaran",
    "Sumber Pendaftaran",
    [
      { label: "Online", count: visits.filter((v) => v.source === "Online").length },
      { label: "Walk-in", count: visits.filter((v) => v.source === "Walk-in").length },
    ],
    visits.length,
  )

  // Breakdown by Service
  const serviceCounts = new Map<string, number>()
  visits.forEach((v) => {
    const name = serviceMap.get(v.service) || "Layanan Lainnya"
    serviceCounts.set(name, (serviceCounts.get(name) || 0) + 1)
  })
  nextRow = addBreakdownTable(
    wsSummary,
    nextRow,
    "D. Rekapitulasi per Layanan / Poli",
    "Nama Layanan",
    Array.from(serviceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count })),
    visits.length,
  )

  // Breakdown by Doctor
  const doctorCounts = new Map<string, number>()
  visits.forEach((v) => {
    const name = doctorMap.get(v.doctor) || "Dokter"
    doctorCounts.set(name, (doctorCounts.get(name) || 0) + 1)
  })
  addBreakdownTable(
    wsSummary,
    nextRow,
    "E. Rekapitulasi per Dokter",
    "Nama Dokter",
    Array.from(doctorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count })),
    visits.length,
  )

  return wb
}

/**
 * Generates and downloads a styled `.xlsx` report file in the browser.
 */
export async function downloadRekapExcel(params: ExportRekapParams) {
  const wb = await buildRekapWorkbook(params)
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `Rekap-Kunjungan-${params.fileSuffix}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
