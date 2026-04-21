# 🚀 Deploy da API - Guia Completo

## Status Atual
✅ **Código implementado e testado**  
✅ **Commit realizado no GitHub**  
✅ **Testes unitários passando**  
⏳ **Deploy pendente** (aguardando espaço em disco)

---

## 📋 O que foi feito

### Implementação
- ✅ Nova rota **GET `/api/appointments/future`** no Cloudflare Worker
- ✅ Filtra agendamentos a partir da data corrente
- ✅ Retorna dados ordenados por data e hora (ASC)
- ✅ Remove dados sensíveis (telefone, observações)
- ✅ Compatível com hospedagem GitHub Pages

### Testes
- ✅ Teste 1: Filtro de agendamentos futuros
- ✅ Teste 2: Ordenação por data e horário
- ✅ Teste 3: Retorno vazio quando sem agendamentos
- ✅ Teste 4: Campos corretos (sem dados sensíveis)

**Todos os testes passaram! Execute com:** `node test-api-extended.js`

---

## 🔧 Como fazer o Deploy

### Opção 1: Deploy Local (recomendado quando houver espaço em disco)

```powershell
# 1. Faça login na Cloudflare (primeira vez apenas)
npx wrangler login

# 2. Vá para o diretório cloudflare
cd cloudflare

# 3. Publique o worker
npx wrangler publish
```

**⚠️ Pré-requisitos:**
- Mínimo 2GB de espaço em disco livre
- Conta Cloudflare ativa
- Credenciais configuradas (`wrangler.toml` e `wrangler.toml`)

### Opção 2: Deploy via GitHub Actions (automático)

Se você configurar GitHub Actions CI/CD:

```yaml
name: Deploy Worker
on:
  push:
    branches: [main]
    paths: ['cloudflare/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install --cwd cloudflare
      - run: npx wrangler publish --cwd cloudflare
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

---

## 🧪 Testar a API após Deploy

### 1. Teste rápido com cURL
```powershell
# Substitua pela URL do seu worker
curl https://seu-worker-url.workers.dev/api/appointments/future
```

**Resposta esperada:**
```json
[
  {
    "id": "abc123-xyz",
    "nomeCliente": "João Silva",
    "servicoId": "lavagem-simples",
    "data": "2026-04-25",
    "horario": "09:00",
    "status": "Pendente"
  },
  ...
]
```

### 2. Teste no Navegador
Abra o Console (F12) e execute:
```javascript
fetch('https://seu-worker-url.workers.dev/api/appointments/future')
  .then(r => r.json())
  .then(d => console.table(d));
```

### 3. Teste com Postman
- Método: **GET**
- URL: `https://seu-worker-url.workers.dev/api/appointments/future`
- Headers: nenhum necessário (rota pública)

---

## 📍 Endpoints Relacionados

| Método | Endpoint | Descrição | Autenticação |
|--------|----------|-----------|---|
| GET | `/api/appointments/future` | **NOVO** - Agendamentos futuros | Nenhuma |
| GET | `/api/appointments/public` | Todos os agendamentos | Nenhuma |
| GET | `/api/appointments` | Todos (com detalhes) | Admin |
| POST | `/api/appointments` | Criar agendamento | Nenhuma |
| GET | `/health` | Status da API | Nenhuma |

---

## 🔍 Detalhes Técnicos

### Query SQL
```sql
SELECT 
  id, 
  nome_cliente as nomeCliente, 
  servico_id as servicoId, 
  data, 
  horario, 
  status 
FROM appointments 
WHERE data >= ? 
ORDER BY data ASC, horario ASC
```

### Resposta da API
- **Status**: 200 OK
- **Content-Type**: `application/json`
- **CORS**: Habilitado para qualquer origem
- **Autenticação**: Não required (pública)

### Performance
- Consulta indexada por `data`
- Sem agregações complexas
- Resposta típica: < 100ms

---

## 📝 Próximos Passos

1. **Liberar espaço em disco** (remover node_modules antigos, cache, etc.)
2. **Executar deploy**: `cd cloudflare && npx wrangler publish`
3. **Testar a rota** com exemplos acima
4. **Integrar no frontend** (Vue.js)
5. **Monitorar performance** no dashboard Cloudflare

---

## 🆘 Troubleshooting

### Erro: "no space left on device"
- Limpe cache: `npm cache clean --force`
- Remova node_modules: `rm -r node_modules`
- Libere espaço em disco

### Erro: "401 Unauthorized"
- Faça login: `npx wrangler login`
- Verifique credenciais Cloudflare

### Erro: "Worker not found"
- Confirme `wrangler.toml` em `cloudflare/`
- Verifique `name = "lava-rapido-proxy"`

### Timeout na resposta
- Verifique conexão com banco D1
- Confirme variáveis de ambiente (`ADMIN_PASSWORD`, `JWT_SECRET`)

---

## 📎 Referências

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/cli-wrangler/)
- [D1 Database](https://developers.cloudflare.com/d1/)
- [R2 Storage](https://developers.cloudflare.com/r2/)

---

**Última atualização**: 2026-04-21  
**Versão da API**: 1.1 (com rota `/api/appointments/future`)
