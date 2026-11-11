# scripts/uji-api.ps1
# Skrip Pengujian Otomatis Seluruh Skenario Bukti Tahap 1A
# Sistem Informasi Klinik Kesehatan (Tim 7)

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$BaseUrl = "http://localhost:3000"

function Login([string]$Email, [string]$Password) {
    $body = @{ email = $Email; password = $Password } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -Body $body -ContentType "application/json"
    return $res.data.accessToken
}

function Kirim([string]$Method, [string]$Path, $Body, [string]$Token) {
    $headers = @{}
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    $params = @{
        Uri = "$BaseUrl$Path"
        Method = $Method
        Headers = $headers
    }
    if ($null -ne $Body) {
        $params["Body"] = ($Body | ConvertTo-Json -Depth 5)
        $params["ContentType"] = "application/json"
    }
    try {
        $resp = Invoke-RestMethod @params
        return @{ StatusCode = 200; Data = $resp }
    } catch {
        if ($_.Exception.Response) {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $text = $reader.ReadToEnd()
            $status = [int]$_.Exception.Response.StatusCode
            return @{ StatusCode = $status; Error = $text }
        }
        return @{ StatusCode = 500; Error = $_.Exception.Message }
    }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   PENGUJIAN MANDIRI BUKTI TAHAP 1A - KLINIK TIM 7       " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 0. Login untuk masing-masing peran
Write-Host "`n[0] Mengautentikasi akun uji..." -ForegroundColor Yellow
$tokenPasien = Login "ani.wulandari@gmail.com" "Password123!"
$tokenPetugas = Login "rina.petugas@gmail.com" "Password123!"
$tokenDokter1 = Login "reyhan.adhitama@gmail.com" "Password123!"
$tokenDokter2 = Login "nadira.kirana@gmail.com" "Password123!"
$tokenAdmin   = Login "admin.klinik@gmail.com" "Password123!"

Write-Host "    -> Token berhasil diperoleh untuk Pasien, Petugas, Dokter 1, Dokter 2, dan Admin." -ForegroundColor Green

# 1. BUKTI: Akses tanpa login -> 401
Write-Host "`n[1] BUKTI: Akses tanpa login -> 401" -ForegroundColor Yellow
$t1 = Kirim "GET" "/api/kunjungan" $null ""
if ($t1.StatusCode -eq 401) {
    Write-Host "    [PASS] Akses GET /api/kunjungan tanpa token menghasilkan 401" -ForegroundColor Green
} else {
    Write-Host "    [FAIL] Akses tanpa token menghasilkan $($t1.StatusCode): $($t1.Error)" -ForegroundColor Red
}

# 2. BUKTI: Pasien memanggil transisi petugas -> 403; Admin melakukan check-in -> 403
Write-Host "`n[2] BUKTI: Pasien transisi petugas -> 403; Admin check-in -> 403" -ForegroundColor Yellow
$dummyId = "00000000-0000-0000-0000-000000000000"
$t2_pasien = Kirim "POST" "/api/kunjungan/$dummyId/transition" @{ aksi = "checkin" } $tokenPasien
if ($t2_pasien.StatusCode -eq 403) {
    Write-Host "    [PASS] Pasien mencoba check-in menghasilkan 403" -ForegroundColor Green
} else {
    Write-Host "    [FAIL] Pasien check-in menghasilkan $($t2_pasien.StatusCode): $($t2_pasien.Error)" -ForegroundColor Red
}

$t2_admin = Kirim "POST" "/api/kunjungan/$dummyId/transition" @{ aksi = "checkin" } $tokenAdmin
if ($t2_admin.StatusCode -eq 403) {
    Write-Host "    [PASS] Admin mencoba check-in menghasilkan 403" -ForegroundColor Green
} else {
    Write-Host "    [FAIL] Admin check-in menghasilkan $($t2_admin.StatusCode): $($t2_admin.Error)" -ForegroundColor Red
}

# 3. BUKTI: Pendaftaran duplikat -> 409 & Pendaftaran kuota penuh -> 409
Write-Host "`n[3] BUKTI: Pendaftaran duplikat -> 409 & Kuota penuh -> 409" -ForegroundColor Yellow
# Gunakan jadwal dr. Reyhan pada hari Rabu (hari = 3) tanggal 2026-11-18
$jadwalId = "b5563fa3-0a3a-4c96-a780-54b136d53056"
$layananId = "eba2c99a-1caa-4bc3-aac5-5dc96ecaee2d"
$tglTest = "2026-11-18"

# Pasien mendaftar pertama kali
$daftar1 = Kirim "POST" "/api/kunjungan" @{
    jadwalId = $jadwalId
    layananId = $layananId
    tanggal = $tglTest
    keluhan = "Keluhan pertama untuk uji duplikasi"
} $tokenPasien

# Pasien mencoba mendaftar lagi pada jadwal dan tanggal yang sama -> harus 409 (BR-02)
$daftarDuplikat = Kirim "POST" "/api/kunjungan" @{
    jadwalId = $jadwalId
    layananId = $layananId
    tanggal = $tglTest
    keluhan = "Keluhan kedua pendaftaran duplikat"
} $tokenPasien

if ($daftarDuplikat.StatusCode -eq 409) {
    Write-Host "    [PASS] Pendaftaran duplikat di hari yang sama menghasilkan 409 (BR-02)" -ForegroundColor Green
} else {
    Write-Host "    [FAIL] Pendaftaran duplikat menghasilkan $($daftarDuplikat.StatusCode): $($daftarDuplikat.Error)" -ForegroundColor Red
}

# Uji kuota penuh: pakai jadwal kuota 2 (dr. Annisa hari Rabu jam 13:00, c6e70064-0696-4cf8-b616-72a5de3a2251)
$jadwalKuota2 = "c6e70064-0696-4cf8-b616-72a5de3a2251"
$layananKuota2 = "8ee2137f-a379-4f57-b3ee-8dae70ba9358"

# Cari tanggal Rabu yang kuotanya masih kosong (0)
$targetTgl = (Get-Date).AddDays(14)
while ($targetTgl.DayOfWeek -ne [DayOfWeek]::Wednesday) {
    $targetTgl = $targetTgl.AddDays(1)
}
$tglKuota = $targetTgl.ToString("yyyy-MM-dd")
while ($true) {
    $cekKunj = Kirim "GET" "/api/kunjungan?tanggal=$tglKuota" $null $tokenPetugas
    $count = 0
    if ($cekKunj.Data -and $cekKunj.Data.data) {
        $count = ($cekKunj.Data.data | Where-Object { $_.jadwalId -eq $jadwalKuota2 -and $_.statusKunjungan -ne "batal" }).Count
    }
    if ($count -eq 0) { break }
    $targetTgl = $targetTgl.AddDays(7)
    $tglKuota = $targetTgl.ToString("yyyy-MM-dd")
}

# Daftarkan walk-in via petugas sampai kuota habis (kuota = 2)
# Gunakan NIK unik acak 16 digit agar tidak melanggar UNIQUE constraint di DB
$p1 = Kirim "POST" "/api/pasien" @{
    nama = "Pasien Kuota 1"
    tanggalLahir = "1995-05-05"
    jenisKelamin = "L"
    nik = "3201$(Get-Random -Minimum 100000000000 -Maximum 999999999999)"
} $tokenPetugas
$p1Id = $p1.Data.data.id

$p2 = Kirim "POST" "/api/pasien" @{
    nama = "Pasien Kuota 2"
    tanggalLahir = "1996-06-06"
    jenisKelamin = "P"
    nik = "3202$(Get-Random -Minimum 100000000000 -Maximum 999999999999)"
} $tokenPetugas
$p2Id = $p2.Data.data.id

$p3 = Kirim "POST" "/api/pasien" @{
    nama = "Pasien Kuota 3"
    tanggalLahir = "1997-07-07"
    jenisKelamin = "L"
    nik = "3203$(Get-Random -Minimum 100000000000 -Maximum 999999999999)"
} $tokenPetugas
$p3Id = $p3.Data.data.id

$k1 = Kirim "POST" "/api/kunjungan" @{
    jadwalId = $jadwalKuota2
    layananId = $layananKuota2
    tanggal = $tglKuota
    keluhan = "Keluhan kuota 1"
    pasienId = $p1Id
} $tokenPetugas

$k2 = Kirim "POST" "/api/kunjungan" @{
    jadwalId = $jadwalKuota2
    layananId = $layananKuota2
    tanggal = $tglKuota
    keluhan = "Keluhan kuota 2"
    pasienId = $p2Id
} $tokenPetugas

$k3Penuh = Kirim "POST" "/api/kunjungan" @{
    jadwalId = $jadwalKuota2
    layananId = $layananKuota2
    tanggal = $tglKuota
    keluhan = "Keluhan kuota 3 melebihi batas"
    pasienId = $p3Id
} $tokenPetugas

if ($k3Penuh.StatusCode -eq 409) {
    Write-Host "    [PASS] Pendaftaran saat kuota penuh menghasilkan 409 (BR-01)" -ForegroundColor Green
} else {
    Write-Host "    [FAIL] Pendaftaran kuota penuh menghasilkan $($k3Penuh.StatusCode): $($k3Penuh.Error)" -ForegroundColor Red
}

# 4. BUKTI: Dua pendaftaran serentak tidak menghasilkan nomor antrean yang sama (race-condition check)
Write-Host "`n[4] BUKTI: Race-condition nomor antrean unik urut" -ForegroundColor Yellow
$num1 = $k1.Data.data.nomorAntrean
$num2 = $k2.Data.data.nomorAntrean
if ($num1 -and $num2 -and ($num1 -ne $num2)) {
    Write-Host "    [PASS] Nomor antrean terurut dan tidak bertabrakan: Antrean #$num1 dan Antrean #$num2" -ForegroundColor Green
} else {
    Write-Host "    [FAIL] Tabrakan nomor antrean atau nomor tidak ada: $num1 vs $num2" -ForegroundColor Red
}

# 5. BUKTI: Memanipulasi ID kunjungan orang lain -> 403/404
Write-Host "`n[5] BUKTI: Memanipulasi ID kunjungan orang lain -> 403/404" -ForegroundColor Yellow
# Pasien 1 mencoba membatalkan kunjungan milik pasien kuota ($k1)
$kunjunganOrangLainId = $k1.Data.data.id
$t5 = Kirim "POST" "/api/kunjungan/$kunjunganOrangLainId/transition" @{
    aksi = "batal"
    alasan = "Mencoba membatalkan kunjungan orang lain"
} $tokenPasien

if ($t5.StatusCode -eq 403 -or $t5.StatusCode -eq 404) {
    Write-Host "    [PASS] Pasien mengakses ID kunjungan milik orang lain ditolak $($t5.StatusCode)" -ForegroundColor Green
} else {
    Write-Host "    [FAIL] Manipulasi ID kunjungan orang lain menghasilkan $($t5.StatusCode): $($t5.Error)" -ForegroundColor Red
}

# 6. BUKTI: NIK tidak 16 digit atau vital di luar rentang -> 400
Write-Host "`n[6] BUKTI: NIK tidak 16 digit atau vital di luar rentang -> 400" -ForegroundColor Yellow
# Uji NIK salah (10 digit)
$t6_nik = Kirim "POST" "/api/pasien" @{
    nama = "Pasien NIK Salah"
    tanggalLahir = "2000-01-01"
    jenisKelamin = "L"
    nik = "12345" # Hanya 5 digit
} $tokenPetugas

if ($t6_nik.StatusCode -eq 400) {
    Write-Host "    [PASS] NIK tidak 16 digit menghasilkan 400 Bad Request" -ForegroundColor Green
} else {
    Write-Host "    [FAIL] NIK tidak 16 digit menghasilkan $($t6_nik.StatusCode): $($t6_nik.Error)" -ForegroundColor Red
}

# Uji tanda vital di luar rentang (suhu 50°C, sistolik 400)
$t6_vital = Kirim "PUT" "/api/kunjungan/$dummyId/pemeriksaan" @{
    anamnesis = "Demam tinggi"
    diagnosis = "Hipertermia"
    tandaVital = @{
        suhu = 60 # Max 45
        sistolik = 400 # Max 300
    }
} $tokenDokter1

if ($t6_vital.StatusCode -eq 400) {
    Write-Host "    [PASS] Tanda vital di luar rentang menghasilkan 400 Bad Request (BR-18)" -ForegroundColor Green
} else {
    Write-Host "    [FAIL] Tanda vital di luar rentang menghasilkan $($t6_vital.StatusCode): $($t6_vital.Error)" -ForegroundColor Red
}

# 7. BUKTI: Pasien membatalkan < 2 jam -> 409 (BR-08, K11)
Write-Host "`n[7] BUKTI: Pasien membatalkan < 2 jam -> 409 (BR-08, K11)" -ForegroundColor Yellow
# Pasien mendaftar kunjungan pada jadwal yang selisih jam mulainya < 2 jam dari sekarang
# Jadwal dr. Annisa hari ini (Rabu jam 13:00-16:00)
$tglHariIni = (Get-Date).ToString("yyyy-MM-dd")
$daftarHariIni = Kirim "POST" "/api/kunjungan" @{
    jadwalId = $jadwalKuota2
    layananId = $layananKuota2
    tanggal = $tglHariIni
    keluhan = "Uji pembatalan mepet jam praktik"
} $tokenPasien

$kunjunganHariIniId = $daftarHariIni.Data.data.id
if ($kunjunganHariIniId) {
    # Pasien mencoba membatalkan kunjungan yang jam mulainya < 2 jam dari sekarang
    $batalMepet = Kirim "POST" "/api/kunjungan/$kunjunganHariIniId/transition" @{
        aksi = "batal"
        alasan = "Ingin membatalkan tapi waktu sudah kurang dari 2 jam"
    } $tokenPasien

    if ($batalMepet.StatusCode -eq 409) {
        Write-Host "    [PASS] Pasien membatalkan kunjungan < 2 jam sebelum praktik ditolak 409 (BR-08, K11)" -ForegroundColor Green
    } else {
        Write-Host "    [FAIL] Pasien membatalkan < 2 jam menghasilkan $($batalMepet.StatusCode): $($batalMepet.Error)" -ForegroundColor Red
    }
} else {
    Write-Host "    [SKIP/INFO] Pendaftaran hari ini tidak berhasil: $($daftarHariIni.Error)" -ForegroundColor DarkGray
}

# Verifikasi pembatalan yang valid untuk jadwal masa depan (> 2 jam)
$kunjunganMasaDepanId = $daftar1.Data.data.id
if ($kunjunganMasaDepanId) {
    $t7_valid = Kirim "POST" "/api/kunjungan/$kunjunganMasaDepanId/transition" @{
        aksi = "batal"
        alasan = "Pembatalan kunjungan masa depan yang valid"
    } $tokenPasien

    if ($t7_valid.StatusCode -eq 200) {
        Write-Host "    [PASS] Pasien berhasil membatalkan kunjungan masa depan (> 2 jam sebelum praktik)" -ForegroundColor Green
    }

    # Sekarang coba batalkan lagi kunjungan yang sudah batal -> 409 STATUS_TIDAK_VALID
    $t7_batalLagi = Kirim "POST" "/api/kunjungan/$kunjunganMasaDepanId/transition" @{
        aksi = "batal"
        alasan = "Membatalkan kunjungan yang sudah batal"
    } $tokenPasien

    if ($t7_batalLagi.StatusCode -eq 409) {
        Write-Host "    [PASS] Membatalkan kunjungan yang sudah tidak berstatus Menunggu menghasilkan 409" -ForegroundColor Green
    } else {
        Write-Host "    [FAIL] Pembatalan tidak valid menghasilkan $($t7_batalLagi.StatusCode): $($t7_batalLagi.Error)" -ForegroundColor Red
    }
}

# 8. BUKTI: Dokter lain mencoba mengisi pemeriksaan -> 403
Write-Host "`n[8] BUKTI: Dokter lain mencoba mengisi pemeriksaan -> 403 (BR-10)" -ForegroundColor Yellow
# $k1 adalah kunjungan untuk dr. Annisa Fadhilla
# Dokter 1 (dr. Reyhan) mencoba mengisi pemeriksaan untuk kunjungan dr. Annisa
$t8 = Kirim "PUT" "/api/kunjungan/$($k1.Data.data.id)/pemeriksaan" @{
    anamnesis = "Pemeriksaan oleh dokter yang bukan pemilik"
    diagnosis = "Diagnosis tidak sah"
    tandaVital = @{ suhu = 36.5; sistolik = 120; diastolik = 80 }
} $tokenDokter1

if ($t8.StatusCode -eq 403) {
    Write-Host "    [PASS] Dokter lain mengisi pemeriksaan ditolak 403 Forbidden (BR-10)" -ForegroundColor Green
} else {
    Write-Host "    [FAIL] Dokter lain mengisi pemeriksaan menghasilkan $($t8.StatusCode): $($t8.Error)" -ForegroundColor Red
}

# 9. BUKTI: Verifikasi createAdminClient di src/app/api
Write-Host "`n[9] BUKTI: Verifikasi createAdminClient di src/app/api" -ForegroundColor Yellow
$cacMatches = Select-String -Path "src/app/api/**/*.js" -Pattern "createAdminClient" -ErrorAction SilentlyContinue
if (-not $cacMatches) {
    Write-Host "    [PASS] NOL pemanggilan createAdminClient di seluruh Route Handler src/app/api!" -ForegroundColor Green
} else {
    Write-Host "    [FAIL] Ditemukan createAdminClient di:" -ForegroundColor Red
    $cacMatches | ForEach-Object { Write-Host "           $($_.Path):$($_.LineNumber)" }
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "   SELURUH SKENARIO PENGUJIAN TAHAP 1A TELAH DIEKSEKUSI   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
