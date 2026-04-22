# Cria um PNG 1x1 a partir de base64 e envia 6 agendamentos sintéticos para o backend local
$base = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='
$bytes = [System.Convert]::FromBase64String($base)
$tmp = Join-Path $env:TEMP 'tmp_comprovante.png'
[IO.File]::WriteAllBytes($tmp, $bytes)

$schedule = @(
    @{ nome = 'Cliente Sintético A'; telefone = '(11) 98765-4321'; servico = 'lavagem-simples'; data = '2026-04-21'; horario = '09:00' },
    @{ nome = 'Cliente Sintético B'; telefone = '(11) 98765-4322'; servico = 'lavagem-completa'; data = '2026-04-22'; horario = '10:30' },
    @{ nome = 'Cliente Sintético C'; telefone = '(11) 98765-4323'; servico = 'enceramento'; data = '2026-04-23'; horario = '14:00' },
    @{ nome = 'Cliente Sintético D'; telefone = '(11) 98765-4324'; servico = 'lavagem-motor'; data = '2026-04-24'; horario = '11:30' },
    @{ nome = 'Cliente Sintético E'; telefone = '(11) 98765-4325'; servico = 'lavagem-completa'; data = '2026-04-25'; horario = '09:30' },
    @{ nome = 'Cliente Sintético F'; telefone = '(11) 98765-4326'; servico = 'lavagem-simples'; data = '2026-04-25'; horario = '15:00' }
)

for ($i = 0; $i -lt $schedule.Count; $i++) {
    $item = $schedule[$i]
    $form = @{
        nomeCliente = $item.nome
        telefoneCliente = $item.telefone
        servicoId = $item.servico
        data = $item.data
        horario = $item.horario
        observacoes = 'Agendamento sintético'
        comprovante = Get-Item $tmp
    }
    Write-Host "Posting appointment ($i): $($item.data) -> $($item.servico)"
    try {
        $res = Invoke-RestMethod -Uri 'http://localhost:4000/api/appointments' -Method Post -Form $form -TimeoutSec 30
        Write-Host "Created: $($res.id)"
    } catch {
        Write-Host "Failed: $($_.Exception.Message)"
    }
}

Remove-Item $tmp -ErrorAction SilentlyContinue
Write-Host 'Done.'