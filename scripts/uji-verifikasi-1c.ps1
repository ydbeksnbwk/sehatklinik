# scripts/uji-verifikasi-1c.ps1
# Kasus tambahan verifikasi backend Tahap 1C (otorisasi, kepemilikan, validasi).
# Prasyarat: server sudah berjalan di http://localhost:3000 (npm run start).
# Skrip ini TIDAK menyalakan server dan TIDAK mencetak token/cookie.

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Base = "http://localhost:3000"
$lulus = 0
$gagal = 0

function Login([string]$Email, [string]$Password) {
    $body = @{ email = $Email; password = $Password } | ConvertTo-Json
    try {
        $wr = Invoke-WebRequest -Uri "$Base/api/auth/login" -Method Post -Body $body -ContentType "application/json" -SessionVariable sess -UseBasicParsing
        $c = $sess.Cookies.GetCookies($Base)["sb-access-token"]
        if ($null -ne $c) { return $c.Value }
        if ($wr.Headers["Set-Cookie"] -match "sb-access-token=([^;]+)") { return $matches[1] }
    } catch { return $null }
    return $null
}

function Kirim([string]$Method, [string]$Path, $Body, [string]$Token) {
    $headers = @{}
    if ($Token) {
        $headers["Authorization"] = "Bearer $Token"
        $headers["Cookie"] = "sb-access-token=$Token"
    }
    $params = @{ Uri = "$Base$Path"; Method = $Method; Headers = $headers }
    if ($null -ne $Body) {
        $params["Body"] = ($Body | ConvertTo-Json -Depth 6)
        $params["ContentType"] = "application/json"
    }
    try {
        $resp = Invoke-RestMethod @params
        return @{ Status = 200; Data = $resp }
    } catch {
        $status = 0; $text = $_.Exception.Message
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $text = $reader.ReadToEnd()
        }
        return @{ Status = $status; Error = $text }
    }
}

function Cek([string]$Nama, [bool]$Ok, [string]$Detail) {
    if ($Ok) {
        $script:lulus++
        Write-Host "    [LULUS] $Nama ($Detail)" -ForegroundColor Green
    } else {
        $script:gagal++
        Write-Host "    [GAGAL] $Nama ($Detail)" -ForegroundColor Red
    }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   VERIFIKASI OTORISASI TAMBAHAN - TAHAP 1C               " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$tPasien  = Login "ani.wulandari@gmail.com" "Password123!"
$tPetugas = Login "rina.petugas@gmail.com" "Password123!"
$tAdmin   = Login "admin.klinik@gmail.com" "Password123!"
$tDokter  = Login "dokter.reyhan@gmail.com" "Password123!"

Write-Host "`n[0] Login akun uji" -ForegroundColor Yellow
Cek "Login pasien" ($null -ne $tPasien) "token ada"
Cek "Login petugas" ($null -ne $tPetugas) "token ada"
Cek "Login admin" ($null -ne $tAdmin) "token ada"
Cek "Login dokter" ($null -ne $tDokter) "token ada"

Write-Host "`n[1] GET /api/pasien tanpa login -> 401" -ForegroundColor Yellow
$r = Kirim "GET" "/api/pasien" $null ""
Cek "Tanpa sesi" ($r.Status -eq 401) "HTTP $($r.Status)"

Write-Host "`n[2] GET /api/pasien oleh pasien -> 403" -ForegroundColor Yellow
$r = Kirim "GET" "/api/pasien" $null $tPasien
Cek "Peran pasien" ($r.Status -eq 403) "HTTP $($r.Status)"

Write-Host "`n[3] PATCH /api/profil field hanya-baca -> 400 dan data tidak berubah" -ForegroundColor Yellow
$awal = Kirim "GET" "/api/profil" $null $tPasien
$nikAwal = $awal.Data.data.pasien.nik
$rNik = Kirim "PATCH" "/api/profil" @{ nik = "3200000000000000" } $tPasien
Cek "nik ditolak" ($rNik.Status -eq 400) "HTTP $($rNik.Status)"
$rRole = Kirim "PATCH" "/api/profil" @{ role = "admin" } $tPasien
Cek "role ditolak" ($rRole.Status -eq 400) "HTTP $($rRole.Status)"
$akhir = Kirim "GET" "/api/profil" $null $tPasien
$nikAkhir = $akhir.Data.data.pasien.nik
Cek "NIK tidak berubah" ($nikAwal -eq $nikAkhir) "sebelum=$nikAwal sesudah=$nikAkhir"

Write-Host "`n[4] Transisi kunjungan milik pasien lain -> 403/404" -ForegroundColor Yellow
$profilPasien = Kirim "GET" "/api/profil" $null $tPasien
$pasienIdSaya = $profilPasien.Data.data.pasien.id
$daftar = Kirim "GET" "/api/kunjungan" $null $tPetugas
$milikLain = @($daftar.Data.data | Where-Object { $_.pasienId -ne $pasienIdSaya })
$target = $milikLain | Where-Object { $_.statusKunjungan -eq "terdaftar" } | Select-Object -First 1
if (-not $target) { $target = $milikLain | Select-Object -First 1 }
if ($target) {
    $r = Kirim "POST" "/api/kunjungan/$($target.kunjunganId)/transition" @{
        aksi = "batal"; alasan = "Uji akses kunjungan orang lain"
    } $tPasien
    Cek "Pasien membatalkan kunjungan orang lain" ($r.Status -eq 403 -or $r.Status -eq 404) "HTTP $($r.Status)"
} else {
    Cek "Pasien membatalkan kunjungan orang lain" $false "tidak ada kunjungan pasien lain"
}

Write-Host "`n[5] PATCH notifikasi milik akun lain -> 404" -ForegroundColor Yellow
$notifPetugas = Kirim "GET" "/api/notifikasi" $null $tPetugas
$notifLain = @($notifPetugas.Data.data) | Select-Object -First 1
if ($notifLain) {
    $r = Kirim "PATCH" "/api/notifikasi/$($notifLain.id)" $null $tPasien
    Cek "Notifikasi akun lain" ($r.Status -eq 404) "HTTP $($r.Status)"
} else {
    $r = Kirim "PATCH" "/api/notifikasi/00000000-0000-0000-0000-000000000000" $null $tPasien
    Cek "Notifikasi akun lain" ($r.Status -eq 404) "HTTP $($r.Status) (tanpa data petugas)"
}

Write-Host "`n[6] Admin check-in -> 403" -ForegroundColor Yellow
if ($target) {
    $r = Kirim "POST" "/api/kunjungan/$($target.kunjunganId)/transition" @{ aksi = "checkin" } $tAdmin
    Cek "Admin check-in kunjungan nyata" ($r.Status -eq 403) "HTTP $($r.Status)"
} else {
    $r = Kirim "POST" "/api/kunjungan/00000000-0000-0000-0000-000000000000/transition" @{ aksi = "checkin" } $tAdmin
    Cek "Admin check-in" ($r.Status -eq 403) "HTTP $($r.Status)"
}

Write-Host "`n[7] Validasi & kepemilikan dokter" -ForegroundColor Yellow
$r = Kirim "PUT" "/api/kunjungan/00000000-0000-0000-0000-000000000000/pemeriksaan" @{
    anamnesis = "Demam"; diagnosis = "Hipertermia"; tandaVital = @{ suhu = 60; sistolik = 400 }
} $tDokter
Cek "Tanda vital di luar rentang" ($r.Status -eq 400) "HTTP $($r.Status)"

$kunjunganAnnisa = @($daftar.Data.data | Where-Object { $_.namaDokter -like "*Annisa*" }) | Select-Object -First 1
if ($kunjunganAnnisa) {
    $r = Kirim "PUT" "/api/kunjungan/$($kunjunganAnnisa.kunjunganId)/pemeriksaan" @{
        anamnesis = "Pemeriksaan dokter lain"; diagnosis = "Tidak sah"
        tandaVital = @{ suhu = 36.5; sistolik = 120; diastolik = 80 }
    } $tDokter
    Cek "Dokter bukan pemilik" ($r.Status -eq 403) "HTTP $($r.Status)"
} else {
    Cek "Dokter bukan pemilik" $false "tidak ada kunjungan dokter lain"
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "   HASIL: LULUS=$lulus GAGAL=$gagal" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
if ($gagal -gt 0) { exit 1 }
