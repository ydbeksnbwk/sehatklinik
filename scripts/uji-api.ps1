# scripts/uji-api.ps1
# Skrip pembantu pengujian API Sistem Informasi Klinik Kesehatan

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
    if ($Body) {
        $params["Body"] = ($Body | ConvertTo-Json -Depth 5)
        $params["ContentType"] = "application/json"
    }
    try {
        return Invoke-RestMethod @params
    } catch {
        if ($_.Exception.Response) {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $text = $reader.ReadToEnd()
            return @{ StatusCode = [int]$_.Exception.Response.StatusCode; Error = $text }
        }
        throw $_
    }
}

Write-Output "Fungsi Login dan Kirim siap digunakan."
