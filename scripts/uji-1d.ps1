# scripts/uji-1d.ps1
# Wrapper PowerShell untuk menjalankan uji otomatis Tahap 1D
# Sistem Informasi Klinik Kesehatan (Tim 7)

param()

$ErrorActionPreference = "Stop"
Write-Host "Menjalankan suite pengujian Tahap 1D (Admin, Rekap, Foto Dokter, Koreksi Pasien)..." -ForegroundColor Cyan
node --env-file=.env.local scripts/uji-1d.mjs
if ($LASTEXITCODE -ne 0) {
    Write-Host "Uji Tahap 1D gagal dengan exit code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "Seluruh uji Tahap 1D berhasil LULUS!" -ForegroundColor Green
