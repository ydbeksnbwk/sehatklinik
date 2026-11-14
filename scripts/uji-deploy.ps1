# scripts/uji-deploy.ps1
# Skrip Verifikasi Otomatis URL Deployment Produksi (PRD §10 Tahap 6)
# Menguji kesiapan deployment publik, flag keamanan cookie, middleware guard, dan alur API

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$BaseUrl,
    [int]$JedaMs = 300
)

# Bersihkan trailing slash bila ada
$BaseUrl = $BaseUrl.TrimEnd('/')

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   VERIFIKASI OTOMATIS DEPLOYMENT KLINIK TIM 7" -ForegroundColor Cyan
Write-Host "   Target URL : $BaseUrl" -ForegroundColor Yellow
Write-Host "   Jeda Antar-Request: $JedaMs ms" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

$totalLulus = 0
$totalGagal = 0
$hasilPemeriksaan = @()

function CatatHasil([string]$Kategori, [string]$Pemeriksaan, [bool]$Sukses, [string]$Detail) {
    if ($Sukses) {
        $global:totalLulus++
        Write-Host "  [LULUS] $Pemeriksaan - $Detail" -ForegroundColor Green
        $global:hasilPemeriksaan += [pscustomobject]@{ Kategori = $Kategori; Pemeriksaan = $Pemeriksaan; Status = "LULUS"; Detail = $Detail }
    } else {
        $global:totalGagal++
        Write-Host "  [GAGAL] $Pemeriksaan - $Detail" -ForegroundColor Red
        $global:hasilPemeriksaan += [pscustomobject]@{ Kategori = $Kategori; Pemeriksaan = $Pemeriksaan; Status = "GAGAL"; Detail = $Detail }
    }
}

# ==============================================================================
# BAGIAN 1: PEMERIKSAAN INFRASTRUKTUR & KEAMANAN TANPA LOGIN
# ==============================================================================
Write-Host "`n[1] Memeriksa Pemeriksaan Keamanan Tanpa Login..." -ForegroundColor Cyan

# 1.1 GET /api/health
try {
    Start-Sleep -Milliseconds $JedaMs
    $health = Invoke-RestMethod -Uri "$BaseUrl/api/health" -Method Get -TimeoutSec 10
    $healthOk = ($health.status -eq "ok" -and $health.db -eq "connected")
    CatatHasil "Infrastruktur" "Pemeriksaan /api/health" $healthOk "Status: $($health.status), DB: $($health.db)"
} catch {
    CatatHasil "Infrastruktur" "Pemeriksaan /api/health" $false "Gagal menghubungi endpoint: $($_.Exception.Message)"
}

# 1.2 GET /api/test-db-error (Harus 404 Not Found)
try {
    Start-Sleep -Milliseconds $JedaMs
    $resp = Invoke-WebRequest -Uri "$BaseUrl/api/test-db-error" -Method Get -TimeoutSec 10 -UseBasicParsing
    CatatHasil "Keamanan" "Isolasi Rute Uji (/api/test-db-error -> 404)" $false "Rute uji masih aktif (Status: $($resp.StatusCode))"
} catch {
    $statusCode = [int]$_.Exception.Response.StatusCode
    $is404 = ($statusCode -eq 404)
    CatatHasil "Keamanan" "Isolasi Rute Uji (/api/test-db-error -> 404)" $is404 "Rute uji tidak tersedia di produksi (Status HTTP: $statusCode)"
}

# 1.3 /admin tanpa sesi -> HTTP 307 Redirect ke /login
try {
    Start-Sleep -Milliseconds $JedaMs
    # Gunakan MaximumRedirection 0 untuk menangkap respons redirect 307
    $adminReq = Invoke-WebRequest -Uri "$BaseUrl/admin" -Method Get -MaximumRedirection 0 -TimeoutSec 10 -UseBasicParsing -ErrorAction SilentlyContinue
    $status = [int]$adminReq.StatusCode
    $loc = $adminReq.Headers["Location"]
    $isRedirectLogin = ($status -eq 307 -and $loc -match "/login")
    CatatHasil "Middleware Guard" "Proteksi Halaman Privat (/admin tanpa sesi -> 307)" $isRedirectLogin "Status: $status, Location: $loc"
} catch {
    $status = [int]$_.Exception.Response.StatusCode
    $loc = $_.Exception.Response.Headers["Location"]
    $isRedirectLogin = ($status -eq 307 -and $loc -match "/login")
    CatatHasil "Middleware Guard" "Proteksi Halaman Privat (/admin tanpa sesi -> 307)" $isRedirectLogin "Status: $status, Location: $loc"
}

# 1.4 Pemeriksaan Flag Cookie Sesi (HttpOnly & Secure saat HTTPS)
Write-Host "`n[2] Memeriksa Flag Keamanan Cookie Sesi pada Login..." -ForegroundColor Cyan
try {
    Start-Sleep -Milliseconds $JedaMs
    $loginBody = @{
        email = "pasien.ani@gmail.com" # atau ani.wulandari@gmail.com
        password = "Password123!"
    } | ConvertTo-Json

    $loginReq = Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -TimeoutSec 10 -UseBasicParsing -Headers @{ "X-Forwarded-For" = "10.88.99.1" }
    $setCookie = $loginReq.Headers["Set-Cookie"]

    if (-not $setCookie -and $loginReq.RawContent) {
        if ($loginReq.RawContent -match "Set-Cookie:\s*([^\r\n]+)") {
            $setCookie = $matches[1]
        }
    }

    $hasHttpOnly = ($setCookie -match "HttpOnly")
    $isHttps = $BaseUrl.StartsWith("https://", [System.StringComparison]::OrdinalIgnoreCase)
    $hasSecure = ($setCookie -match "Secure")
    $hasSameSiteLax = ($setCookie -match "SameSite=Lax")

    $cookieOk = $hasHttpOnly -and $hasSameSiteLax
    if ($isHttps) {
        $cookieOk = $cookieOk -and $hasSecure
    }

    CatatHasil "Keamanan Cookie" "Flag HttpOnly & SameSite=Lax" ($hasHttpOnly -and $hasSameSiteLax) "HttpOnly: $hasHttpOnly, SameSite=Lax: $hasSameSiteLax"
    if ($isHttps) {
        CatatHasil "Keamanan Cookie" "Flag Secure pada HTTPS Produksi" $hasSecure "Secure flag aktif: $hasSecure"
    } else {
        Write-Host "  [INFO] BaseUrl bukan HTTPS, verifikasi Secure flag dilewati untuk pengujian lokal." -ForegroundColor Gray
    }
} catch {
    # Coba email alternatif demo
    try {
        $loginBody = @{ email = "ani.wulandari@gmail.com"; password = "Password123!" } | ConvertTo-Json
        $loginReq = Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -TimeoutSec 10 -UseBasicParsing -Headers @{ "X-Forwarded-For" = "10.88.99.2" }
        $setCookie = $loginReq.Headers["Set-Cookie"]
        $hasHttpOnly = ($setCookie -match "HttpOnly")
        $isHttps = $BaseUrl.StartsWith("https://", [System.StringComparison]::OrdinalIgnoreCase)
        $hasSecure = ($setCookie -match "Secure")
        $hasSameSiteLax = ($setCookie -match "SameSite=Lax")
        $cookieOk = $hasHttpOnly -and $hasSameSiteLax
        if ($isHttps) { $cookieOk = $cookieOk -and $hasSecure }
        CatatHasil "Keamanan Cookie" "Flag HttpOnly & SameSite=Lax" ($hasHttpOnly -and $hasSameSiteLax) "HttpOnly: $hasHttpOnly, SameSite=Lax: $hasSameSiteLax"
        if ($isHttps) {
            CatatHasil "Keamanan Cookie" "Flag Secure pada HTTPS Produksi" $hasSecure "Secure flag aktif: $hasSecure"
        }
    } catch {
        CatatHasil "Keamanan Cookie" "Pemeriksaan Cookie Sesi" $false "Gagal login uji coba: $($_.Exception.Message)"
    }
}

# ==============================================================================
# BAGIAN 2: EKSEKUSI MASTER TEST SUITE TERHADAP URL DEPLOYMENT
# ==============================================================================
Write-Host "`n[3] Menjalankan Master Test Suite terhadap $BaseUrl..." -ForegroundColor Cyan
$suitePath = Join-Path $PSScriptRoot "uji-suite.ps1"

if (Test-Path $suitePath) {
    & $suitePath -BaseUrl $BaseUrl -JedaMs $JedaMs
    $suiteExitCode = $LASTEXITCODE
} else {
    Write-Host "  [GAGAL] File scripts/uji-suite.ps1 tidak ditemukan!" -ForegroundColor Red
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "   RINGKASAN PEMERIKSAAN DEPLOYMENT AWAL" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
$hasilPemeriksaan | Format-Table -AutoSize
Write-Host "Total Pemeriksaan Khusus: $($totalLulus + $totalGagal) | LULUS: $totalLulus | GAGAL: $totalGagal" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
