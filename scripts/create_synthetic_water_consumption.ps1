# Gera dados sinteticos de consumo de agua e envia para o Worker Cloudflare.
# Uso:
#   $env:API_URL = 'https://lava-rapido-proxy.<sua-conta>.workers.dev/api/water-consumption'
#   .\scripts\create_synthetic_water_consumption.ps1

param(
    [string]$ApiUrl = $env:API_URL,
    [ValidateSet('daily', 'backfill')]
    [string]$Mode = $(if ($env:MODE) { $env:MODE } else { 'daily' }),
    [int]$Days = $(if ($env:DAYS) { [int]$env:DAYS } else { 1 }),
    [int]$BaseLiters = $(if ($env:BASE_LITERS) { [int]$env:BASE_LITERS } else { 450 }),
    [int]$VariationLiters = $(if ($env:VARIATION_LITERS) { [int]$env:VARIATION_LITERS } else { 180 }),
    [switch]$DryRun
)

if ($Days -lt 1) {
    Write-Error 'Days deve ser maior que zero.'
    exit 1
}

$count = if ($Mode -eq 'daily') { 1 } else { $Days }
$items = @()

for ($i = $count - 1; $i -ge 0; $i--) {
    $date = (Get-Date).AddDays(-$i)
    $weekday = [int]$date.DayOfWeek
    $randomPart = Get-Random -Minimum 0 -Maximum ([Math]::Max($VariationLiters, 1))
    $cycle = (($i * 37 + $weekday * 23) % 95)
    $liters = $BaseLiters + $randomPart + $cycle

    if ($date.DayOfWeek -eq [DayOfWeek]::Sunday) {
        $liters = [Math]::Round($liters * 0.65)
    }

    $items += [ordered]@{
        date = $date.ToString('yyyy-MM-dd')
        liters = $liters
    }
}

$json = $items | ConvertTo-Json -Depth 3 -Compress

if ($DryRun) {
    Write-Output $json
    exit 0
}

if ([string]::IsNullOrWhiteSpace($ApiUrl) -or $ApiUrl -like '*SUA-CONTA*') {
    Write-Error 'Defina API_URL com a URL real do Worker Cloudflare.'
    exit 1
}

try {
    Write-Host "Enviando $($items.Count) leitura(s) para $ApiUrl"
    $response = Invoke-RestMethod -Uri $ApiUrl -Method Post -ContentType 'application/json' -Body $json -TimeoutSec 30
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Error "Falha ao enviar consumo de agua: $($_.Exception.Message)"
    exit 1
}
