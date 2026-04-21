#!/bin/bash
# Script de Deploy da API no Cloudflare Workers
# Antes de executar:
# 1. Faça login na Cloudflare: npx wrangler login
# 2. Configure suas credenciais do Cloudflare nos secrets
# 3. Execute este script

echo "🚀 Iniciando deploy do Cloudflare Worker..."
echo ""

cd cloudflare

# Verificar se wrangler está instalado
if ! command -v wrangler &> /dev/null && ! npx wrangler --version &> /dev/null; then
    echo "❌ Wrangler não encontrado. Instale com: npm install -g wrangler"
    exit 1
fi

echo "📦 Publicando worker no Cloudflare..."
npx wrangler publish

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ DEPLOY REALIZADO COM SUCESSO!"
    echo ""
    echo "📝 Próximas etapas:"
    echo "  1. Acesse sua conta Cloudflare"
    echo "  2. Vá para Workers & Pages"
    echo "  3. Localize o worker 'lava-rapido-proxy'"
    echo "  4. Teste a rota: GET /api/appointments/future"
    echo ""
    echo "🧪 Exemplos de teste:"
    echo "  curl https://seu-worker-url.workers.dev/api/appointments/future"
    echo "  curl https://seu-worker-url.workers.dev/health"
else
    echo ""
    echo "❌ ERRO no deploy. Verifique:"
    echo "  - Espaço em disco disponível (minuto 2GB)"
    echo "  - Autenticação no Cloudflare (npx wrangler login)"
    echo "  - Arquivo wrangler.toml configurado corretamente"
    exit 1
fi
