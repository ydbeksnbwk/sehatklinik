# scripts/uji-1e.ps1
# Wrapper PowerShell untuk menjalankan uji otomatis Tahap 1E
# Sistem Informasi Klinik Kesehatan (Tim 7)

param()

$ErrorActionPreference = "Stop"
Write-Host "Menjalankan suite pengujian Tahap 1E (Rate Limit, Zod utang, Pino Logger, Global Handler)..." -ForegroundColor Cyan
node --env-file=.env.local scripts/uji-1e.mjs
if ($LASTEXITCODE -ne 0) {
    Write-Host "Uji Tahap 1E gagal dengan exit code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "Seluruh uji Tahap 1E berhasil LULUS!" -ForegroundColor Green
