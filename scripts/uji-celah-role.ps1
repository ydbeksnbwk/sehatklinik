# scripts/uji-celah-role.ps1
# Pengujian Keamanan: Pencegahan Eskalasi Hak Akses (Privilege Escalation)
# Skenario: Penyerang mendaftar langsung ke Supabase Auth publik dengan user_metadata: {"role":"admin"}

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$sbUrl = ""
$anonKey = ""
$serviceKey = ""

foreach ($line in (Get-Content .env.local)) {
    if ($line -match "^NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)") {
        $sbUrl = $matches[1].Trim().Trim('"').Trim("'")
    }
    if ($line -match "^NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.*)") {
        $anonKey = $matches[1].Trim().Trim('"').Trim("'")
    }
    if ($line -match "^SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.*)") {
        $serviceKey = $matches[1].Trim().Trim('"').Trim("'")
    }
}

$emailHacker = "hacker_" + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + "@klinik.test"
$passwordHacker = "PasswordHacker123!"

Write-Host "1. Penyerang melakukan SIGNUP langsung ke Supabase Auth publik..." -ForegroundColor Cyan
Write-Host "   URL   : $sbUrl/auth/v1/signup"
Write-Host "   Email : $emailHacker"
Write-Host "   Payload user_metadata: { role: 'admin', nama: 'Penyerang Injeksi Role' }"

$bodySignup = @{
    email = $emailHacker
    password = $passwordHacker
    data = @{
        role = "admin"
        nama = "Penyerang Injeksi Role"
    }
} | ConvertTo-Json

$headersAnon = @{
    "apikey" = $anonKey
    "Content-Type" = "application/json"
}

$signupRes = Invoke-RestMethod -Uri "$sbUrl/auth/v1/signup" -Method Post -Headers $headersAnon -Body $bodySignup
$userId = $signupRes.id
if (-not $userId -and $signupRes.user) { $userId = $signupRes.user.id }
Write-Host "   -> Akun terdaftar di Supabase Auth (User ID: $userId)"

Write-Host "`n2. Penyerang melakukan LOGIN untuk mendapatkan session token..." -ForegroundColor Cyan
$bodyLogin = @{
    email = $emailHacker
    password = $passwordHacker
} | ConvertTo-Json

$loginRes = Invoke-RestMethod -Uri "$sbUrl/auth/v1/token?grant_type=password" -Method Post -Headers $headersAnon -Body $bodyLogin
$userToken = $loginRes.access_token

Write-Host "`n3. Penyerang memeriksa perannya di tabel public.profiles..." -ForegroundColor Cyan
$headersUser = @{
    "apikey" = $anonKey
    "Authorization" = "Bearer $userToken"
}
$profile = Invoke-RestMethod -Uri "$sbUrl/rest/v1/profiles?select=*" -Method Get -Headers $headersUser

$actualRole = $profile[0].role
Write-Host "   Nama di tabel profiles : $($profile[0].nama)"
Write-Host "   Role di tabel profiles : $actualRole"

if ($actualRole -eq "pasien") {
    Write-Host "`n[HASIL] SUKSES! Celah tertutup rapat." -ForegroundColor Green
    Write-Host "Peran akun adalah 'pasien', injeksi role: 'admin' berhasil dinetralkan!"
} else {
    Write-Host "`n[HASIL] BAHAYA! Akun memiliki peran '$actualRole'." -ForegroundColor Red
}

Write-Host "`n4. Membersihkan akun uji dari auth.users..." -ForegroundColor Cyan
if ($userId) {
    # Hapus via node helper / database URL agar tidak terbentur PostgREST header
    $delScript = @"
const { createClient } = require('@supabase/supabase-js');
const admin = createClient('$sbUrl', '$serviceKey', { auth: { persistSession: false } });
admin.auth.admin.deleteUser('$userId').then(() => console.log('   -> Akun uji berhasil dihapus dari database.'));
"@
    node -e "$delScript"
}
