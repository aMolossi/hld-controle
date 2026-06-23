# gen-license.ps1 — Gerador de chaves de licença HubControl
#
# Uso:
#   .\scripts\gen-license.ps1 -Cliente "HLD Marmitaria" -Expiry "2027-01-01" -Tier pro
#   .\scripts\gen-license.ps1 -Cliente "João Pizzaria" -Expiry "2026-12-31" -Tier starter
#
# IMPORTANTE: manter o $Secret sincronizado com LICENSE_SECRET em src-tauri/src/lib.rs

param(
    [Parameter(Mandatory)][string]$Cliente,
    [Parameter(Mandatory)][string]$Expiry,
    [ValidateSet("starter", "pro")][string]$Tier = "pro"
)

# Deve bater exatamente com LICENSE_SECRET em lib.rs
$Secret = "hubcontrol-license-key-2024-hld"

function ConvertTo-Base64Url([byte[]]$bytes) {
    [System.Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

# Montar payload JSON (compacto, sem espaços)
$payloadJson = '{"c":"' + $Cliente + '","e":"' + $Expiry + '","t":"' + $Tier + '"}'
$payloadBytes = [System.Text.Encoding]::UTF8.GetBytes($payloadJson)
$payloadB64   = ConvertTo-Base64Url $payloadBytes

# Calcular HMAC-SHA256 sobre o payload em base64url
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($Secret)
$sigBytes  = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($payloadB64))
$sigB64    = ConvertTo-Base64Url $sigBytes

$key = "HUBCTRL-$payloadB64.$sigB64"

Write-Host ""
Write-Host "Chave gerada para: $Cliente ($Tier) - valida ate $Expiry"
Write-Host ""
Write-Host $key
Write-Host ""
