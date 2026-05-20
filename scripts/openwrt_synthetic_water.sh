#!/bin/sh
# Mede o consumo de internet no OpenWrt e envia como consumo de agua.
# Regra: 1 megabit trafegado = 1 litro.
# Uso recomendado: executar a cada hora pelo cron.

set -eu

API_URL="${API_URL:-https://lava-rapido-proxy.e-a-oliveira74.workers.dev/api/water-consumption}"
IFACE="${IFACE:-phy0-sta0}"
STATE_DIR="${STATE_DIR:-/tmp/internet_water_meter}"
CURL_TIMEOUT="${CURL_TIMEOUT:-20}"
DRY_RUN="${DRY_RUN:-0}"

usage() {
  cat <<'EOF'
Uso:
  sh /root/openwrt_synthetic_water.sh

O script calcula o trafego desde a execucao anterior:
  litros = ((bytes_recebidos + bytes_enviados) * 8) / 1000000

Variaveis:
  API_URL       Endpoint da aplicacao.
  IFACE         Interface medida. Padrao: phy0-sta0.
                Exemplos alternativos: wwan2, pppoe-wan, eth0.2, wan, br-lan.
  STATE_DIR     Pasta temporaria para guardar a leitura anterior.
  DRY_RUN       1 para imprimir sem enviar.

Primeira execucao:
  Apenas salva o contador inicial. A partir da segunda execucao calcula o delta.

Exemplos:
  DRY_RUN=1 sh /root/openwrt_synthetic_water.sh
  IFACE=pppoe-wan sh /root/openwrt_synthetic_water.sh
EOF
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

case "$CURL_TIMEOUT" in
  ''|*[!0-9]*)
    echo "Erro: CURL_TIMEOUT deve ser um numero inteiro positivo." >&2
    exit 1
    ;;
esac

today="$(date +%Y-%m-%d)"
mkdir -p "$STATE_DIR"

detect_iface() {
  if [ "$IFACE" != "auto" ]; then
    echo "$IFACE"
    return
  fi

  if command -v ip >/dev/null 2>&1; then
    detected="$(ip route show default 2>/dev/null | awk 'NR==1 { for (i=1; i<=NF; i++) if ($i=="dev") { print $(i+1); exit } }')"
    if [ -n "${detected:-}" ]; then
      echo "$detected"
      return
    fi
  fi

  detected="$(route -n 2>/dev/null | awk '$1=="0.0.0.0" { print $8; exit }')"
  if [ -n "${detected:-}" ]; then
    echo "$detected"
    return
  fi

  echo "Erro: nao foi possivel detectar a interface WAN. Defina IFACE=nome_da_interface." >&2
  exit 1
}

read_total_bytes() {
  iface="$1"
  awk -v iface="$iface" '
    $1 == iface ":" {
      gsub(":", "", $1)
      if ($1 == iface) {
        printf "%.0f\n", $2 + $10
        found = 1
      }
    }
    END {
      if (!found) exit 2
    }
  ' /proc/net/dev
}

iface="$(detect_iface)"
current_bytes="$(read_total_bytes "$iface" || true)"

if [ -z "${current_bytes:-}" ]; then
  echo "Erro: interface '$iface' nao encontrada em /proc/net/dev." >&2
  echo "Interfaces disponiveis:" >&2
  awk -F: 'NR > 2 { gsub(/^[ \t]+/, "", $1); print "  " $1 }' /proc/net/dev >&2
  exit 1
fi

last_file="$STATE_DIR/last_${iface}.txt"
daily_file="$STATE_DIR/daily_${today}_${iface}.txt"

if [ ! -f "$last_file" ]; then
  printf '%s %s\n' "$today" "$current_bytes" > "$last_file"
  echo "Primeira execucao: contador inicial salvo para $iface ($current_bytes bytes). Rode novamente daqui a 1 hora."
  exit 0
fi

read last_date last_bytes < "$last_file"
printf '%s %s\n' "$today" "$current_bytes" > "$last_file"

case "$last_bytes" in
  ''|*[!0-9]*)
    echo "Erro: estado anterior invalido. Recrie a medicao na proxima execucao." >&2
    exit 1
    ;;
esac

if [ "$current_bytes" -lt "$last_bytes" ]; then
  delta_bytes=0
else
  delta_bytes=$((current_bytes - last_bytes))
fi

hour_liters="$(awk -v bytes="$delta_bytes" 'BEGIN { printf "%.3f", (bytes * 8) / 1000000 }')"

if [ "$last_date" != "$today" ] || [ ! -f "$daily_file" ]; then
  previous_daily="0"
else
  previous_daily="$(cat "$daily_file" 2>/dev/null || echo 0)"
fi

daily_liters="$(awk -v prev="$previous_daily" -v hour="$hour_liters" 'BEGIN { printf "%.3f", prev + hour }')"
printf '%s\n' "$daily_liters" > "$daily_file"

payload="{\"date\":\"$today\",\"liters\":$daily_liters}"

echo "Interface: $iface"
echo "Bytes da ultima hora: $delta_bytes"
echo "Litros da ultima hora: $hour_liters"
echo "Litros acumulados hoje: $daily_liters"

if [ "$DRY_RUN" = "1" ]; then
  echo "$payload"
  exit 0
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "Erro: curl nao encontrado." >&2
  exit 1
fi

response="$(
  curl -sS \
    --connect-timeout "$CURL_TIMEOUT" \
    --max-time "$CURL_TIMEOUT" \
    -H "Content-Type: application/json" \
    -X POST \
    --data "$payload" \
    "$API_URL"
)"

echo "$response"
