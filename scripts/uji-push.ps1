# scripts/uji-push.ps1
# Wrapper PowerShell untuk uji otomatis bukti Web Push dan Worker (PRD §7)
param()

$ErrorActionPreference = "Stop"
Write-Host "Menjalankan suite pengujian Web Push & Worker..." -ForegroundColor Cyan
node --env-file=.env.local scripts/uji-push.mjs
if ($LASTEXITCODE -ne 0) {
    Write-Host "Uji Web Push gagal dengan exit code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "Uji Web Push berhasil selesai!" -ForegroundColor Green
