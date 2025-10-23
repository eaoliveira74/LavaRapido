$ErrorActionPreference = 'Stop'
$tmp = Join-Path $env:TEMP 'tmp_upload2.png'
# PNG 1x1
[IO.File]::WriteAllBytes($tmp,[System.Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='))
Write-Host "tmp=$tmp"
$curlArgs = @(
    '-v', '-i',
    '-F', "nomeCliente=RetestCurl",
    '-F', "telefoneCliente=9",
    '-F', "servicoId=lavagem-simples",
    '-F', "data=2025-10-11",
    '-F', "horario=12:00",
    '-F', "observacoes=retest",
    '-F', "comprovante=@$tmp",
    'http://localhost:4000/api/appointments'
)
# Executa curl.exe com array de argumentos para evitar problemas de aspas
Write-Host 'Running curl.exe...'
$proc = Start-Process -FilePath 'curl.exe' -ArgumentList $curlArgs -NoNewWindow -Wait -PassThru
Write-Host "curl exit code: $($proc.ExitCode)"
Write-Host '---- uploads directory ----'
Get-ChildItem .\server\uploads -File -ErrorAction SilentlyContinue | Select-Object Name,Length,LastWriteTime | Format-Table -AutoSize
Write-Host '---- appointments.json ----'
Get-Content -Path .\server\data\appointments.json -Raw | Write-Host
# limpeza
Remove-Item $tmp -ErrorAction SilentlyContinue
Write-Host 'done'