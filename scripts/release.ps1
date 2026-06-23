<#
  Publica uma nova versao do HLD Controle no GitHub Releases (auto-update).

  Uso:
    npm run release -- -Version 0.3.0
    npm run release -- -Version 0.3.0 -Notes "Correcao no calculo de lucro"

  Pre-requisitos (ja configurados):
    - gh CLI autenticado (gh auth status)
    - Chave de assinatura em %USERPROFILE%\.tauri\hld_updater.key (+ .pass)
    - Rust no PATH (o script ja injeta ~/.cargo/bin)
#>
param(
  [Parameter(Mandatory = $true)][string]$Version,
  [string]$Notes = ""
)

$ErrorActionPreference = "Stop"
$repo = "aMolossi/hld-controle"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

if ([string]::IsNullOrWhiteSpace($Notes)) { $Notes = "Atualizacao $Version" }

function Set-Utf8NoBom($path, $text) { [System.IO.File]::WriteAllText($path, $text) }

Write-Host "==> Ajustando versao para $Version"
$verPattern = '"version":\s*"[^"]*"'
$confPath = Join-Path $root "src-tauri\tauri.conf.json"
$pkgPath = Join-Path $root "package.json"
Set-Utf8NoBom $confPath ((Get-Content $confPath -Raw) -replace $verPattern, ('"version": "' + $Version + '"'))
Set-Utf8NoBom $pkgPath ((Get-Content $pkgPath -Raw) -replace $verPattern, ('"version": "' + $Version + '"'))

Write-Host "==> Compilando instalador assinado (pode demorar)..."
$env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content "$env:USERPROFILE\.tauri\hld_updater.key" -Raw)
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = (Get-Content "$env:USERPROFILE\.tauri\hld_updater.pass" -Raw).Trim()
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
npm run tauri build
if ($LASTEXITCODE -ne 0) { throw "Build falhou (exit $LASTEXITCODE)" }

$nsisDir = Join-Path $root "src-tauri\target\release\bundle\nsis"
$base = "HLD Controle_${Version}_x64-setup.exe"
$setupPath = Join-Path $nsisDir $base
$sigPath = Join-Path $nsisDir "$base.sig"
if (-not (Test-Path $setupPath)) { throw "Instalador nao encontrado: $setupPath" }
if (-not (Test-Path $sigPath)) { throw "Assinatura nao encontrada: $sigPath" }

# Nome de asset sem espacos (evita problemas de URL no GitHub)
$assetName = "HLD-Controle_${Version}_x64-setup.exe"
$assetPath = Join-Path $nsisDir $assetName
$assetSig = Join-Path $nsisDir "$assetName.sig"
Copy-Item $setupPath $assetPath -Force
Copy-Item $sigPath $assetSig -Force

Write-Host "==> Gerando latest.json"
$signature = (Get-Content $assetSig -Raw).Trim()
$url = "https://github.com/$repo/releases/download/v$Version/$assetName"
$pubDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$latest = [ordered]@{
  version   = $Version
  notes     = $Notes
  pub_date  = $pubDate
  platforms = [ordered]@{
    "windows-x86_64" = [ordered]@{
      signature = $signature
      url       = $url
    }
  }
}
$latestPath = Join-Path $nsisDir "latest.json"
Set-Utf8NoBom $latestPath ($latest | ConvertTo-Json -Depth 8)

Write-Host "==> Publicando release v$Version no GitHub..."
gh release create "v$Version" $assetPath $assetSig $latestPath --repo $repo --title "v$Version" --notes $Notes
if ($LASTEXITCODE -ne 0) { throw "Falha ao publicar a release (exit $LASTEXITCODE)" }

# Commita e envia o bump de versao (e quaisquer correcoes pendentes)
if (git status --porcelain) {
  git add -A
  git commit -m "release v$Version"
  git push
}

Write-Host ""
Write-Host "==> OK! Release v$Version publicada."
Write-Host "    O app instalado na marmitaria vai detectar e atualizar sozinho ao abrir."
