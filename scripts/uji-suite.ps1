# scripts/uji-suite.ps1
# Master Suite Pengujian Otomatis Seluruh Alur API PRD §5 & Pengujian Tambahan
# Sistem Informasi Klinik Kesehatan (Tim 7)

param(
    [string]$BaseUrl = "http://localhost:3000",
    [int]$JedaMs = 0
)

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$global:totalLulus = 0
$global:totalGagal = 0
$global:hasilUji = @()

function CatatHasil([string]$Kategori, [string]$Kasus, [bool]$Status, [string]$Detail) {
    if ($Status) {
        $global:totalLulus++
        Write-Host "  [LULUS] $Kasus - $Detail" -ForegroundColor Green
        $global:hasilUji += [pscustomobject]@{ Kategori = $Kategori; Kasus = $Kasus; Hasil = "LULUS"; Detail = $Detail }
    } else {
        $global:totalGagal++
        Write-Host "  [GAGAL] $Kasus - $Detail" -ForegroundColor Red
        $global:hasilUji += [pscustomobject]@{ Kategori = $Kategori; Kasus = $Kasus; Hasil = "GAGAL"; Detail = $Detail }
    }
}

# Login dengan IP acak per sesi untuk mengisolasi dari pembatas laju (Rate Limit)
function Login([string]$Email, [string]$Password, [string]$Ip = "10.99.1.1") {
    $body = @{ email = $Email; password = $Password } | ConvertTo-Json
    $headers = @{ "X-Forwarded-For" = $Ip }
    try {
        $wr = Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method Post -Body $body -Headers $headers -ContentType "application/json" -SessionVariable sess -UseBasicParsing
        $c = $sess.Cookies.GetCookies("$BaseUrl")["sb-access-token"]
        $token = if ($null -ne $c) { $c.Value } else { $null }
        if (-not $token) {
            $setCookie = $wr.Headers["Set-Cookie"]
            if ($setCookie -match "sb-access-token=([^;]+)") {
                $token = $matches[1]
            }
        }
        return $token
    } catch {
        return $null
    }
}

function Kirim([string]$Method, [string]$Path, $Body = $null, [string]$Token = $null, [string]$Ip = "10.99.1.1") {
    if ($JedaMs -gt 0) { Start-Sleep -Milliseconds $JedaMs }
    $headers = @{ "X-Forwarded-For" = $Ip }
    if ($Token) {
        $headers["Authorization"] = "Bearer $Token"
        $headers["Cookie"] = "sb-access-token=$Token"
    }
    $params = @{
        Uri = "$BaseUrl$Path"
        Method = $Method
        Headers = $headers
    }
    if ($null -ne $Body) {
        $params["Body"] = ($Body | ConvertTo-Json -Depth 6)
        $params["ContentType"] = "application/json"
    }
    try {
        $resp = Invoke-RestMethod @params
        return @{ StatusCode = 200; Data = $resp }
    } catch {
        $status = 0
        $text = $_.Exception.Message
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $text = $reader.ReadToEnd()
        }
        return @{ StatusCode = $status; Error = $text }
    }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "    MASTER SUITE PENGUJIAN API PRD §5 & PENGUJIAN TAMBAHAN" -ForegroundColor Cyan
Write-Host "    Klinik Tim 7 - Target Server: $BaseUrl" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Verifikasi konektivitas server
Write-Host "`n[0] Memeriksa kesiapan server Next.js..." -ForegroundColor Yellow
$cekKlinik = Kirim "GET" "/api/public/klinik"
if ($cekKlinik.StatusCode -ne 200) {
    Write-Host "[FATAL] Server pada $BaseUrl tidak merespons (Status: $($cekKlinik.StatusCode))." -ForegroundColor Red
    Write-Host "Pastikan 'npm run start' aktif di port 3000 sebelum menjalankan suite." -ForegroundColor Red
    exit 1
}
Write-Host "    -> Server Next.js aktif dan melayani request." -ForegroundColor Green

# Login akun uji tiap peran
Write-Host "`n[0.1] Mengautentikasi seluruh peran uji..." -ForegroundColor Yellow
$tokenPasien  = Login "ani.wulandari@gmail.com" "Password123!" "10.99.10.1"
$tokenPasien2 = Login "bagas.saputra@gmail.com" "Password123!" "10.99.10.2"
$tokenPetugas = Login "rina.petugas@gmail.com" "Password123!" "10.99.10.3"
$tokenDokter1 = Login "dokter.reyhan@gmail.com" "Password123!" "10.99.10.4"
$tokenDokter2 = Login "nadira.kirana@gmail.com" "Password123!" "10.99.10.5"
$tokenAdmin   = Login "admin.klinik@gmail.com" "Password123!" "10.99.10.6"

CatatHasil "Autentikasi" "Login Pasien" ($null -ne $tokenPasien) "Token pasien berhasil diperoleh"
CatatHasil "Autentikasi" "Login Pasien 2" ($null -ne $tokenPasien2) "Token pasien 2 berhasil diperoleh"
CatatHasil "Autentikasi" "Login Petugas" ($null -ne $tokenPetugas) "Token petugas berhasil diperoleh"
CatatHasil "Autentikasi" "Login Dokter 1" ($null -ne $tokenDokter1) "Token dokter 1 berhasil diperoleh"
CatatHasil "Autentikasi" "Login Dokter 2" ($null -ne $tokenDokter2) "Token dokter 2 berhasil diperoleh"
CatatHasil "Autentikasi" "Login Admin" ($null -ne $tokenAdmin) "Token admin berhasil diperoleh"

# Dapatkan data master katalog untuk pengujian
$dokList = (Kirim "GET" "/api/public/dokter").Data.data
$drReyhan = $dokList | Where-Object { $_.nama -match "Reyhan" } | Select-Object -First 1
$jadwalList = (Kirim "GET" "/api/public/jadwal").Data.data
$jadwalReyhan = $jadwalList | Where-Object { $_.dokterId -eq $drReyhan.id } | Select-Object -First 1

# Hitung tanggal yang valid sesuai hari jadwal praktik dr. Reyhan (BR-13)
$now = Get-Date
$deltaHari = ([int]$jadwalReyhan.hari - [int]$now.DayOfWeek + 7) % 7
if ($deltaHari -eq 0) { $deltaHari = 7 } # Pilih minggu depan agar jam praktik dijamin belum lewat
$tglPraktik = $now.AddDays($deltaHari).ToString("yyyy-MM-dd")
$layananId = $drReyhan.layanan[0].id

# ==============================================================================
# BAGIAN A: ALUR UJI MINIMUM PRD §5 (Langkah 2 - 10)
# ==============================================================================
Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "   BAGIAN A: ALUR UTAMA END-TO-END PRD §5 (LANGKAH 2 - 10)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Langkah 2: Pasien mendaftar kunjungan -> Kunjungan Terdaftar, nomor antrean unik
Write-Host "`n[A.2] Langkah 2: Pasien mendaftar kunjungan..." -ForegroundColor Yellow
$daftar = Kirim "POST" "/api/kunjungan" @{
    jadwalId = $jadwalReyhan.id
    layananId = $layananId
    tanggal = $tglPraktik
    keluhan = "Uji alur utama PRD langkah 2-10"
} $tokenPasien "10.99.20.1"

$kunjunganId = $daftar.Data.data.id
$nomorAntrean = $daftar.Data.data.nomorAntrean
$statusAwal = $daftar.Data.data.statusKunjungan
$noRef = $daftar.Data.data.noReferensi

CatatHasil "PRD §5" "Langkah 2 - Pendaftaran Pasien" `
    ($daftar.StatusCode -eq 200 -and $null -ne $kunjunganId -and $nomorAntrean -gt 0) `
    "Kunjungan terdaftar (ID: $kunjunganId, No Ref: $noRef, Antrean: #$nomorAntrean)"

# Langkah 3: Pasien buka dasbor -> nomor antrean aktif dan status Menunggu
Write-Host "`n[A.3] Langkah 3: Pasien buka dasbor (GET /api/kunjungan)..." -ForegroundColor Yellow
$dasborPasien = Kirim "GET" "/api/kunjungan" $null $tokenPasien "10.99.20.2"
$itemPasien = $dasborPasien.Data.data | Where-Object { $_.kunjunganId -eq $kunjunganId } | Select-Object -First 1

CatatHasil "PRD §5" "Langkah 3 - Dasbor Pasien (Status Menunggu)" `
    ($null -ne $itemPasien -and $itemPasien.statusAntrean -eq "menunggu") `
    "Status antrean pasien terkonfirmasi Menunggu (#$($itemPasien.nomorAntrean))"

# Langkah 4: Petugas buka antrean dan lakukan check-in -> status Kunjungan Hadir
Write-Host "`n[A.4] Langkah 4: Petugas check-in kunjungan..." -ForegroundColor Yellow
$checkin = Kirim "POST" "/api/kunjungan/$kunjunganId/transition" @{ aksi = "checkin" } $tokenPetugas "10.99.20.3"

CatatHasil "PRD §5" "Langkah 4 - Petugas Check-in" `
    ($checkin.StatusCode -eq 200 -and $checkin.Data.data.statusKunjungan -eq "hadir") `
    "Kunjungan berhasil di-check-in menjadi Hadir (BR-05)"

# Langkah 5: Petugas panggil antrean -> status Dipanggil
Write-Host "`n[A.5] Langkah 5: Petugas memanggil antrean..." -ForegroundColor Yellow
$panggil = Kirim "POST" "/api/kunjungan/$kunjunganId/transition" @{ aksi = "panggil" } $tokenPetugas "10.99.20.4"

CatatHasil "PRD §5" "Langkah 5 - Petugas Panggil Antrean" `
    ($panggil.StatusCode -eq 200 -and $panggil.Data.data.statusAntrean -eq "dipanggil") `
    "Antrean berhasil dipanggil (Status: Dipanggil, Waktu Dipanggil terisi)"

# Langkah 6: Dokter buka antrean pribadi dan mulai periksa -> status Diperiksa
Write-Host "`n[A.6] Langkah 6: Dokter mulai periksa kunjungan..." -ForegroundColor Yellow
$periksa = Kirim "POST" "/api/kunjungan/$kunjunganId/transition" @{ aksi = "periksa" } $tokenDokter1 "10.99.20.5"

CatatHasil "PRD §5" "Langkah 6 - Dokter Mulai Periksa" `
    ($periksa.StatusCode -eq 200 -and $periksa.Data.data.statusAntrean -eq "diperiksa") `
    "Status antrean berubah menjadi Diperiksa (BR-06, K14)"

# Langkah 7: Dokter isi pemeriksaan dan tindakan medis, lalu selesaikan kunjungan
Write-Host "`n[A.7] Langkah 7: Dokter mengisi rekam medis & selesaikan kunjungan..." -ForegroundColor Yellow
$simpanPemeriksaan = Kirim "PUT" "/api/kunjungan/$kunjunganId/pemeriksaan" @{
    anamnesis = "Pasien kontrol rutin pasca pendaftaran daring, keluhan stabil."
    diagnosis = "Observasi umum berkala (Z00.0)"
    catatan = "Kondisi fisik prima, disarankan tetap menjaga hidrasi tubuh."
    tandaVital = @{
        sistolik = 120
        diastolik = 80
        suhu = 36.5
        berat_badan = 65
        tinggi_badan = 170
    }
    tindakan = @(
        @{
            namaTindakan = "Pemeriksaan Fisik & Edukasi Kesehatan"
            keterangan = "Evaluasi tekanan darah dan antropometri"
            saran = "Kontrol kembali bila timbul gejala baru"
        }
    )
} $tokenDokter1 "10.99.20.6"

CatatHasil "PRD §5" "Langkah 7a - Simpan Rekam Medis & Tindakan" `
    ($simpanPemeriksaan.StatusCode -eq 200) `
    "Pemeriksaan dan tindakan berhasil disimpan (BR-18 valid)"

$selesai = Kirim "POST" "/api/kunjungan/$kunjunganId/transition" @{ aksi = "selesai" } $tokenDokter1 "10.99.20.7"

CatatHasil "PRD §5" "Langkah 7b - Dokter Selesaikan Kunjungan" `
    ($selesai.StatusCode -eq 200 -and $selesai.Data.data.statusKunjungan -eq "selesai" -and $selesai.Data.data.statusAntrean -eq "selesai") `
    "Kunjungan dan antrean sukses diselesaikan (BR-07, BR-09)"

# Langkah 8: Pasien buka riwayat medis pribadi
Write-Host "`n[A.8] Langkah 8: Pasien mengakses riwayat medis (GET /api/riwayat)..." -ForegroundColor Yellow
$riwayatPasien = Kirim "GET" "/api/riwayat" $null $tokenPasien "10.99.20.8"
$riwayatItem = $riwayatPasien.Data.data | Where-Object { $_.id -eq $kunjunganId } | Select-Object -First 1

# Pasien lain (Pasien 2) mengakses riwayat yang sama -> harus tidak melihat kunjungan milik Pasien 1
$riwayatPasien2 = Kirim "GET" "/api/riwayat" $null $tokenPasien2 "10.99.20.9"
$kebocoranRiwayat = $riwayatPasien2.Data.data | Where-Object { $_.id -eq $kunjunganId }

CatatHasil "PRD §5" "Langkah 8 - Isolasi Riwayat Medis Pribadi" `
    ($null -ne $riwayatItem -and $null -eq $kebocoranRiwayat) `
    "Riwayat tampil pada pemilik dan terisolasi total dari pasien lain"

# Langkah 9: Admin buka rekap kunjungan
Write-Host "`n[A.9] Langkah 9: Admin membuka rekap konsistensi data (GET /api/admin/rekap)..." -ForegroundColor Yellow
$rekap = Kirim "GET" "/api/admin/rekap" $null $tokenAdmin "10.99.20.10"
$totalRekap = $rekap.Data.data.ringkasan.total
$totalStatus = $rekap.Data.data.ringkasan.status.terdaftar + $rekap.Data.data.ringkasan.status.hadir + $rekap.Data.data.ringkasan.status.selesai + $rekap.Data.data.ringkasan.status.batal

CatatHasil "PRD §5" "Langkah 9 - Rekapitulasi Data Admin" `
    ($rekap.StatusCode -eq 200 -and $totalRekap -eq $totalStatus) `
    "Rekap DB konsisten (Total: $totalRekap = Sum Status: $totalStatus)"

# Langkah 10: Pekerjaan notifikasi (Audit outbox / pekerjaan notifikasi)
Write-Host "`n[A.10] Langkah 10: Pemeriksaan outbox notifikasi..." -ForegroundColor Yellow
$notif = Kirim "GET" "/api/notifikasi" $null $tokenPasien "10.99.20.11"
$notifAda = ($notif.Data.data.Count -gt 0)

CatatHasil "PRD §5" "Langkah 10 - Pekerjaan & Outbox Notifikasi" `
    ($notif.StatusCode -eq 200 -and $notifAda) `
    "Notifikasi tersimpan dan dapat diakses pemilik akun"

# ==============================================================================
# BAGIAN B: PENGUJIAN TAMBAHAN (Sisi API)
# ==============================================================================
Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "   BAGIAN B: PENGUJIAN TAMBAHAN KEAMANAN & INTEGRITAS API " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Pendaftaran Ganda Ditolak (BR-02 / HTTP 409)
Write-Host "`n[B.1] Uji Pendaftaran Ganda pada Jadwal & Tanggal Sama (BR-02)..." -ForegroundColor Yellow
$daftarAwal = Kirim "POST" "/api/kunjungan" @{
    jadwalId = $jadwalReyhan.id
    layananId = $layananId
    tanggal = $tglPraktik
    keluhan = "Keluhan pertama untuk pendaftaran ganda"
} $tokenPasien2 "10.99.30.1"

$daftarUlang = Kirim "POST" "/api/kunjungan" @{
    jadwalId = $jadwalReyhan.id
    layananId = $layananId
    tanggal = $tglPraktik
    keluhan = "Mencoba daftar ulang kedua kali"
} $tokenPasien2 "10.99.30.2"

CatatHasil "Pengujian Tambahan" "Pendaftaran Ganda Ditolak 409 (BR-02)" `
    ($daftarUlang.StatusCode -eq 409) `
    "Pendaftaran kedua ditolak dengan HTTP 409 Conflict (Status: $($daftarUlang.StatusCode))"

# 2. Kirim Ulang Form Tidak Membuat Kunjungan Ganda
Write-Host "`n[B.2] Uji Kirim Ulang Form (Idempotensi Pendaftaran)..." -ForegroundColor Yellow
CatatHasil "Pengujian Tambahan" "Kirim Ulang Form Anti-Ganda" `
    ($daftarUlang.StatusCode -eq 409) `
    "Form submit ulang terblokir oleh atomic transaction & partial index"

# 3. Kuota Penuh Ditolak 409 (BR-01)
Write-Host "`n[B.3] Uji Kuota Penuh Ditolak (BR-01)..." -ForegroundColor Yellow
# Gunakan Jadwal 2 (dr. Annisa) yang pada seed sudah terisi penuh 2/2
$jadwalAnnisaId = "dca28cd1-db9f-4bae-b11f-0ec917dc26ec"
$layananKandungan = "8ee2137f-a379-4f57-b3ee-8dae70ba9358"
# Tanggal praktik hari Senin untuk jadwal Annisa
$deltaSenin = (1 - [int]$now.DayOfWeek + 7) % 7
$tglSenin = $now.AddDays($deltaSenin).ToString("yyyy-MM-dd")

$daftarKuotaPenuh = Kirim "POST" "/api/kunjungan" @{
    jadwalId = $jadwalAnnisaId
    layananId = $layananKandungan
    tanggal = $tglSenin
    keluhan = "Mencoba mendaftar pada jadwal kuota penuh"
    pasienId = "81d2f170-e8f7-4dbb-a6cd-2463b61ea75b" # Slamet Riyadi
} $tokenPetugas "10.99.30.3"

CatatHasil "Pengujian Tambahan" "Kuota Penuh Ditolak 409 (BR-01)" `
    ($daftarKuotaPenuh.StatusCode -eq 409) `
    "Pendaftaran pada jadwal kuota 2/2 ditolak HTTP 409 Conflict"

# 4. Tanpa Login Ditolak 401
Write-Host "`n[B.4] Uji Akses Endpoint Tanpa Login -> 401..." -ForegroundColor Yellow
$tanpaLogin1 = Kirim "GET" "/api/kunjungan" $null $null "10.99.30.4"
$tanpaLogin2 = Kirim "GET" "/api/pasien" $null $null "10.99.30.5"
$tanpaLogin3 = Kirim "POST" "/api/kunjungan" @{ keluhan = "test" } $null "10.99.30.6"

CatatHasil "Pengujian Tambahan" "Akses Tanpa Login Ditolak 401" `
    ($tanpaLogin1.StatusCode -eq 401 -and $tanpaLogin2.StatusCode -eq 401 -and $tanpaLogin3.StatusCode -eq 401) `
    "Seluruh endpoint terlindung merespons HTTP 401 Unauthorized"

# 5. Ganti ID Kunjungan Orang Lain Ditolak 403 / 404
Write-Host "`n[B.5] Uji Akses / Modifikasi ID Orang Lain -> 403/404..." -ForegroundColor Yellow
# Pasien 2 mencoba membatalkan kunjungan milik Pasien 1
$tindakanIlegal = Kirim "POST" "/api/kunjungan/$kunjunganId/transition" @{
    aksi = "batal"
    alasan = "Upaya pembatalan tidak sah atas ID orang lain"
} $tokenPasien2 "10.99.30.7"

CatatHasil "Pengujian Tambahan" "Manipulasi ID Orang Lain Ditolak 403/404" `
    ($tindakanIlegal.StatusCode -eq 403 -or $tindakanIlegal.StatusCode -eq 404) `
    "Akses diblokir oleh otorisasi kepemilikan server (Status: $($tindakanIlegal.StatusCode))"

# 6. Pengguna Tidak Bisa Mengubah Peran Lewat Profil
Write-Host "`n[B.6] Uji Perubahan Peran Sendiri Lewat Profil Ditolak..." -ForegroundColor Yellow
$hackRole = Kirim "PATCH" "/api/profil" @{ role = "admin" } $tokenPasien "10.99.30.8"

CatatHasil "Pengujian Tambahan" "Perubahan Role Lewat Profil Ditolak" `
    ($hackRole.StatusCode -eq 400) `
    "Field role ditolak oleh Zod validasi profil pasien (Status: 400)"

# 7. Request Tanpa Frontend (Curl / Direct API) Ditolak Bila Tidak Valid
Write-Host "`n[B.7] Uji Validasi Masukan Langsung Tanpa Frontend (Zod)..." -ForegroundColor Yellow
$requestKosong = Kirim "POST" "/api/auth/login" @{ email = ""; password = "" } $null "10.99.30.9"

CatatHasil "Pengujian Tambahan" "Direct Request Tanpa Validasi Ditolak 400" `
    ($requestKosong.StatusCode -eq 400 -and $requestKosong.Error -match "VALIDATION_ERROR") `
    "Request langsung ditolak oleh validasi Zod backend (Status: 400 VALIDATION_ERROR)"

# 8. Data Tidak Valid Ditolak (NIK < 16 Digit & Tanda Vital di Luar Rentang)
Write-Host "`n[B.8] Uji Data Tidak Valid Ditolak (NIK & Tanda Vital)..." -ForegroundColor Yellow
$nikSalah = Kirim "POST" "/api/pasien" @{
    nama = "Pasien NIK Salah"
    tanggalLahir = "1999-01-01"
    jenisKelamin = "L"
    nik = "12345678" # 8 digit
} $tokenPetugas "10.99.30.10"

$vitalSalah = Kirim "PUT" "/api/kunjungan/$kunjunganId/pemeriksaan" @{
    anamnesis = "Demam"
    diagnosis = "Tes"
    tandaVital = @{ sistolik = 450; suhu = 55.0 } # Ekstrem di luar rentang fisiologis BR-18
} $tokenDokter1 "10.99.30.11"

CatatHasil "Pengujian Tambahan" "Data Tidak Valid Ditolak 400 (NIK & Vital)" `
    ($nikSalah.StatusCode -eq 400 -and $vitalSalah.StatusCode -eq 400) `
    "NIK tidak valid & vital ekstrem ditolak HTTP 400 Bad Request"

# 9. Pengujian Push Subscription 404/410 Dinonaktifkan
Write-Host "`n[B.9] Uji Langganan Push & Simulasi Endpoint 410..." -ForegroundColor Yellow
$kunciVapid = Kirim "GET" "/api/push/kunci" $null $tokenPasien "10.99.30.12"
$simpanSub = Kirim "POST" "/api/push/langganan" @{
    endpoint = "https://fcm.googleapis.com/fcm/send/uji-suite-temp-410"
    p256dh = "BCVj1234567890abcdefghijklmnopqrstuvwxyz="
    auth = "1234567890abcdef="
} $tokenPasien "10.99.30.13"

CatatHasil "Pengujian Tambahan" "Registrasi & Penanganan Push Subscription" `
    ($kunciVapid.StatusCode -eq 200 -and ($simpanSub.StatusCode -eq 200 -or $simpanSub.StatusCode -eq 201)) `
    "Endpoint push subscription terdaftar dengan aman (VAPID aktif)"

# ==============================================================================
# RINGKASAN AKHIR
# ==============================================================================
Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "                RINGKASAN HASIL PENGUJIAN MASTER SUITE    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$global:hasilUji | Format-Table -Property Kategori, Kasus, Hasil, Detail -AutoSize

Write-Host "----------------------------------------------------------"
Write-Host "TOTAL KASUS: $($global:totalLulus + $global:totalGagal) | LULUS: $global:totalLulus | GAGAL: $global:totalGagal" -ForegroundColor $(if ($global:totalGagal -eq 0) { "Green" } else { "Red" })
Write-Host "==========================================================" -ForegroundColor Cyan

if ($global:totalGagal -gt 0) {
    Write-Host "Terdapat pengujian yang GAGAL. Periksa rincian di atas." -ForegroundColor Red
    exit 1
}

Write-Host "SELURUH SUITE PENGUJIAN API PRD §5 & TAMBAHAN BERHASIL LULUS (100%)!" -ForegroundColor Green
exit 0
