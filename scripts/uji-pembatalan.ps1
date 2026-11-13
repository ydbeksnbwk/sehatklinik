# scripts/uji-pembatalan.ps1 - versi 3: batal kunjungan f5750233
$ErrorActionPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Base = "http://localhost:3000"

$server = Start-Process -FilePath "node" -ArgumentList "./node_modules/next/dist/bin/next","dev" -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$siap = $false
foreach ($i in 1..45) { Start-Sleep -Seconds 2; if ((Test-NetConnection -ComputerName localhost -Port 3000 -WarningAction SilentlyContinue).TcpTestSucceeded) { $siap = $true; break } }
if (-not $siap) { Write-Output "SERVER GAGAL HIDUP"; if (-not $server.HasExited) { Stop-Process -Id $server.Id -Force }; exit 1 }
Write-Output "SERVER READY (pid $($server.Id))"

function Login([string]$Email, [string]$Password) {
    $body = @{ email = $Email; password = $Password } | ConvertTo-Json
    $wr = Invoke-WebRequest -Uri "$Base/api/auth/login" -Method Post -Body $body -ContentType "application/json" -SessionVariable sess -UseBasicParsing
    $c = $sess.Cookies.GetCookies($Base)["sb-access-token"]
    if ($null -ne $c) { return $c.Value }
    if ($wr.Headers["Set-Cookie"] -match "sb-access-token=([^;]+)") { return $matches[1] }
    return $null
}

function Kirim([string]$Method, [string]$Path, $Body, [string]$Token) {
    $headers = @{ }
    if ($Token) { $headers["Authorization"] = "Bearer $Token"; $headers["Cookie"] = "sb-access-token=$Token" }
    $params = @{ Uri = "$Base$Path"; Method = $Method; Headers = $headers }
    if ($null -ne $Body) { $params["Body"] = ($Body | ConvertTo-Json -Depth 5); $params["ContentType"] = "application/json" }
    try {
        $resp = Invoke-RestMethod @params
        return @{ Status = 200; Body = ($resp | ConvertTo-Json -Depth 6) }
    } catch {
        $status = 0; $text = $_.Exception.Message
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $text = $reader.ReadToEnd()
        }
        return @{ Status = $status; Body = $text }
    }
}
$token = Login $env:UJI_EMAIL $env:UJI_PASSWORD
if (-not $token) { Write-Output "LOGIN GAGAL"; if (-not $server.HasExited) { Stop-Process -Id $server.Id -Force }; exit 1 }
Write-Output "[1] LOGIN PASIEN OK"

$id = "f5750233-2689-4dca-a64d-a1a9e3e307f0"

$sebelum = Kirim "GET" "/api/kunjungan" $null $token
if ($sebelum.Status -eq 200) {
    $rows = ($sebelum.Body | ConvertFrom-Json).data | Where-Object { $_.kunjunganId -eq $id }
    Write-Output "[2] SEBELUM: $(($rows | ConvertTo-Json -Compress -Depth 5))"
}

$batal = Kirim "POST" "/api/kunjungan/$id/transition" @{ aksi = "batal"; alasan = "Reproduksi butir 1 pembatalan" } $token
Write-Output "[3] POST transition batal -> $($batal.Status)"
Write-Output $batal.Body

$sesudah = Kirim "GET" "/api/kunjungan" $null $token
if ($sesudah.Status -eq 200) {
    $rows = ($sesudah.Body | ConvertFrom-Json).data | Where-Object { $_.kunjunganId -eq $id }
    Write-Output "[4] SESUDAH: $(($rows | ConvertTo-Json -Compress -Depth 5))"
}

$his = Kirim "GET" "/api/riwayat" $null $token
Write-Output "[5] GET /api/riwayat -> $($his.Status)"
Write-Output $his.Body

if (-not $server.HasExited) { Stop-Process -Id $server.Id -Force }
Write-Output "SERVER DIHENTIKAN"
