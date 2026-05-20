Cloudflare Worker backend para Lava Rápido (sem Railway)

O que este Worker faz
- Implementa toda a API do backend: autenticação admin (JWT), agendamentos (criar/listar/confirmar/apagar), upload de comprovantes (R2) e proxy de clima.
- Persiste dados no Cloudflare D1 (SQLite gerenciado) e arquivos em Cloudflare R2.
- Endpoints compatíveis com o frontend existente:
  - POST /api/appointments (multipart)
  - GET /api/appointments (admin, JWT)
  - GET /api/appointments/public
  - GET /api/appointments/:id/comprovante (admin)
  - POST /api/appointments/:id/confirm (admin)
  - DELETE /api/appointments/:id (admin)
  - GET /api/visual-weather?lat=..&lon=..&start=..&end=..
  - POST /api/water-consumption
  - GET /api/water-consumption?start=YYYY-MM-DD&end=YYYY-MM-DD
  - GET /uploads/<key>
  - GET /health

Pré-requisitos
- Conta Cloudflare. Instale Wrangler: `npm i -g wrangler`. Faça login: `wrangler login`.

1) Criar D1 e R2
- D1: crie um banco (ex.: lava_rapido_db). Copie o `database_id`.
- R2: crie um bucket (ex.: lava-rapido-uploads).
- Edite `cloudflare/wrangler.toml` e substitua `database_name`, `database_id` e `bucket_name`.

2) Aplicar migração D1
```powershell
cd .\cloudflare
wrangler d1 migrations apply lava_rapido_db --local=false
```

3) Definir secrets
```powershell
wrangler secret put ADMIN_PASSWORD   # senha admin (texto simples)
wrangler secret put JWT_SECRET       # string aleatória longa
# opcional
wrangler secret put VISUALCROSSING_API_KEY
```

4) Publicar
```powershell
wrangler deploy
```
Você terá uma URL: https://lava-rapido-proxy.<sua-conta>.workers.dev

5) Apontar o frontend (GitHub Pages)
- No GitHub: Settings → Secrets and variables → Actions → New repository secret
  - BACKEND_URL = https://lava-rapido-proxy.<sua-conta>.workers.dev
- O workflow do Pages já injeta `VITE_BACKEND_URL` no build.

CORS
- O Worker retorna `Access-Control-Allow-Origin: *`. Em produção, restrinja para o domínio do seu Pages.

Limites
- Uploads até 1 MB por arquivo (ajustável). Custos/limites do R2 e chamadas externas se aplicam.

OpenWrt: envio de consumo baseado no trafego de internet
- O script `scripts/openwrt_synthetic_water.sh` mede o trafego da interface WAN e envia para `POST /api/water-consumption`.
- Conversao usada: 1 megabit trafegado = 1 litro.
- A interface padrao configurada no script e `phy0-sta0`.
- Ele foi escrito para OpenWrt/BusyBox `ash` e depende apenas de `curl`.
- A primeira execucao apenas salva o contador inicial. A partir da segunda execucao, ele calcula o consumo desde a leitura anterior.
- Para testar a partir deste ambiente Windows/PowerShell, use `scripts/create_synthetic_water_consumption.ps1`.

Instalacao no roteador:
```powershell
scp .\scripts\openwrt_synthetic_water.sh root@192.168.1.1:/root/openwrt_synthetic_water.sh
ssh root@192.168.1.1 "chmod +x /root/openwrt_synthetic_water.sh"
```

Teste manual:
```sh
DRY_RUN=1 /root/openwrt_synthetic_water.sh
/root/openwrt_synthetic_water.sh
```

Teste pelo PowerShell local:
```powershell
$env:API_URL = "https://lava-rapido-proxy.<sua-conta>.workers.dev/api/water-consumption"
.\scripts\create_synthetic_water_consumption.ps1 -DryRun
.\scripts\create_synthetic_water_consumption.ps1
```

Forcar outra interface, se precisar:
```sh
IFACE=pppoe-wan /root/openwrt_synthetic_water.sh
```

Agendar uma leitura por hora no cron do OpenWrt:
```sh
echo '0 * * * * /root/openwrt_synthetic_water.sh >> /tmp/water.log 2>&1' >> /etc/crontabs/root
/etc/init.d/cron restart
```

Consulta:
```sh
curl "https://lava-rapido-proxy.<sua-conta>.workers.dev/api/water-consumption?start=2026-05-01&end=2026-05-31"
```
