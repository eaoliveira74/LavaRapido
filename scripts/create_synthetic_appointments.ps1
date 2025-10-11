# Create a tiny 1x1 PNG from base64 and POST 10 synthetic appointments to local backend
$base = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='
$bytes = [System.Convert]::FromBase64String($base)
$tmp = Join-Path $env:TEMP 'tmp_comprovante.png'
[IO.File]::WriteAllBytes($tmp, $bytes)

$svc = @('lavagem-simples','lavagem-completa','enceramento','lavagem-motor')

for ($i = 0; $i -lt 10; $i++) {
    $d = (Get-Date).AddDays(-$i).ToString('yyyy-MM-dd')
    $name = "Teste $i"
    $phone = "(11) 99999-000$i"
    $service = $svc[$i % $svc.Length]

    $form = @{
        nomeCliente = $name
        telefoneCliente = $phone
        servicoId = $service
        data = $d
        horario = '11:00'
        observacoes = 'sintetico'
        comprovante = Get-Item $tmp
    }
    Write-Host "Posting appointment ($i): $d -> $service"
    try {
        $res = Invoke-RestMethod -Uri 'http://localhost:4000/api/appointments' -Method Post -Form $form -TimeoutSec 30
        Write-Host "Created: $($res.id)"
    } catch {
        Write-Host "Failed: $($_.Exception.Message)"
    }
}

Remove-Item $tmp -ErrorAction SilentlyContinue
Write-Host 'Done.'