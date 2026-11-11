import type { Examination, Visit } from "../clinic-data"

type PrintVisitSummaryInput = {
  visit: Visit
  patientName: string
  doctorName: string
  serviceName: string
  dateText: string
  timeRange: string
  clinicName: string
  clinicAddress: string
  clinicPhone: string
  examination: Examination
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

export function printVisitSummary({
  visit,
  patientName,
  doctorName,
  serviceName,
  dateText,
  timeRange,
  clinicName,
  clinicAddress,
  clinicPhone,
  examination,
}: PrintVisitSummaryInput) {
  if (typeof window === "undefined" || typeof document === "undefined") return

  const printedAt = new Date().toLocaleString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const actionsHtml = examination.actions.length
    ? examination.actions
        .map(
          (a, i) => `
          <div class="action-card">
            <div class="action-title">${i + 1}. ${escapeHtml(a.name || "Tindakan Medis")}</div>
            ${a.description ? `<p><strong>Keterangan:</strong> ${escapeHtml(a.description)}</p>` : ""}
            ${a.advice ? `<p><strong>Saran Lanjutan:</strong> ${escapeHtml(a.advice)}</p>` : ""}
          </div>
        `
        )
        .join("")
    : `<p class="muted">Tidak ada tindakan tambahan.</p>`

  const vitalsItems = [
    { label: "Tekanan Darah", value: examination.pressure ? `${examination.pressure} mmHg` : "—" },
    { label: "Suhu Tubuh", value: examination.temperature ? `${examination.temperature} °C` : "—" },
    { label: "Berat Badan", value: examination.weight ? `${examination.weight} kg` : "—" },
    { label: "Tinggi Badan", value: examination.height ? `${examination.height} cm` : "—" },
  ]

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Ringkasan Kunjungan - ${escapeHtml(visit.id)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 28px 34px;
      font-size: 12.5px;
      line-height: 1.55;
      background: #ffffff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 14px;
      margin-bottom: 18px;
      gap: 20px;
    }
    .clinic-name {
      font-size: 19px;
      font-weight: 700;
      color: #172c4f;
      margin: 0 0 4px;
    }
    .clinic-meta {
      font-size: 11px;
      color: #64748b;
      margin: 0;
    }
    .doc-tag {
      text-align: right;
    }
    .doc-tag b {
      display: block;
      font-size: 13px;
      color: #2563eb;
      letter-spacing: 0.4px;
      text-transform: uppercase;
    }
    .doc-tag span {
      font-size: 11px;
      color: #64748b;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 24px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 18px;
    }
    .info-row span {
      display: block;
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .info-row b {
      font-size: 12.5px;
      color: #0f172a;
    }
    h2 {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #2563eb;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 5px;
      margin: 18px 0 10px;
    }
    .vitals-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }
    .vital-box {
      border: 1px solid #e2e8f0;
      border-radius: 7px;
      padding: 10px 12px;
      background: #ffffff;
    }
    .vital-box span {
      display: block;
      font-size: 10px;
      color: #64748b;
    }
    .vital-box b {
      font-size: 13.5px;
      color: #0f172a;
    }
    .field-block {
      margin-bottom: 12px;
    }
    .field-label {
      font-size: 10.5px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 3px;
    }
    .field-value {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 9px 12px;
      white-space: pre-wrap;
    }
    .action-card {
      border: 1px solid #e2e8f0;
      border-radius: 7px;
      padding: 10px 12px;
      margin-bottom: 8px;
    }
    .action-title {
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .action-card p {
      margin: 2px 0;
      font-size: 11.5px;
      color: #334155;
    }
    .muted {
      color: #64748b;
      font-style: italic;
    }
    .footer {
      margin-top: 28px;
      padding-top: 12px;
      border-top: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 11px;
      color: #64748b;
    }
    .signature {
      text-align: center;
      min-width: 190px;
    }
    .signature-line {
      margin-top: 42px;
      border-top: 1px solid #475569;
      padding-top: 4px;
      font-weight: 600;
      color: #0f172a;
    }
    @media print {
      body { padding: 12px 16px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="clinic-name">${escapeHtml(clinicName)}</h1>
      <p class="clinic-meta">${escapeHtml(clinicAddress)} · Telp: ${escapeHtml(clinicPhone)}</p>
    </div>
    <div class="doc-tag">
      <b>Ringkasan Kunjungan</b>
      <span>No. Ref: ${escapeHtml(visit.id)}</span>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-row">
      <span>Nama Pasien / No. RM</span>
      <b>${escapeHtml(patientName)} (${escapeHtml(visit.patient)})</b>
    </div>
    <div class="info-row">
      <span>Tanggal & Sesi</span>
      <b>${escapeHtml(dateText)}${timeRange ? ` · ${escapeHtml(timeRange)}` : ""}</b>
    </div>
    <div class="info-row">
      <span>Dokter Pemeriksa</span>
      <b>${escapeHtml(doctorName)}</b>
    </div>
    <div class="info-row">
      <span>Layanan & Sumber</span>
      <b>${escapeHtml(serviceName)} (${escapeHtml(visit.source)})</b>
    </div>
  </div>

  <h2>Tanda Vital</h2>
  <div class="vitals-grid">
    ${vitalsItems
      .map(
        (v) => `
      <div class="vital-box">
        <span>${escapeHtml(v.label)}</span>
        <b>${escapeHtml(v.value)}</b>
      </div>
    `
      )
      .join("")}
  </div>

  <h2>Hasil Pemeriksaan Klinis</h2>
  <div class="field-block">
    <div class="field-label">Keluhan Utama</div>
    <div class="field-value">${escapeHtml(visit.complaint || "—")}</div>
  </div>
  <div class="field-block">
    <div class="field-label">Anamnesis</div>
    <div class="field-value">${escapeHtml(examination.anamnesis || "—")}</div>
  </div>
  <div class="field-block">
    <div class="field-label">Diagnosis</div>
    <div class="field-value">${escapeHtml(examination.diagnosis || "—")}</div>
  </div>
  <div class="field-block">
    <div class="field-label">Catatan Pemeriksaan</div>
    <div class="field-value">${escapeHtml(examination.notes || "—")}</div>
  </div>

  <h2>Tindakan & Saran Lanjutan</h2>
  ${actionsHtml}

  <div class="footer">
    <div>Dicetak pada ${escapeHtml(printedAt)}</div>
    <div class="signature">
      <div>Dokter Pemeriksa,</div>
      <div class="signature-line">${escapeHtml(doctorName)}</div>
    </div>
  </div>
</body>
</html>`

  const iframe = document.createElement("iframe")
  iframe.style.position = "fixed"
  iframe.style.right = "0"
  iframe.style.bottom = "0"
  iframe.style.width = "0"
  iframe.style.height = "0"
  iframe.style.border = "0"
  iframe.setAttribute("aria-hidden", "true")
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc || !iframe.contentWindow) {
    document.body.removeChild(iframe)
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  const cleanup = () => {
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
    }, 500)
  }

  iframe.contentWindow.onafterprint = cleanup
  setTimeout(() => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
  }, 100)
}

