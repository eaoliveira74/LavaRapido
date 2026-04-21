# 🔑 Como Criar API Token para Cloudflare Workers

## 📋 Permissões Necessárias

Baseado na configuração do projeto (`wrangler.toml`), você precisa de um token com estas permissões:

### **Workers**
- ✅ **Account: Cloudflare Workers:Edit** - Para publicar/deployar Workers
- ✅ **Account: Cloudflare Workers:Read** - Para ler configurações

### **D1 Database**
- ✅ **Account: Cloudflare D1:Edit** - Para modificar banco de dados
- ✅ **Account: Cloudflare D1:Read** - Para consultar dados

### **R2 Storage**
- ✅ **Account: Cloudflare R2:Edit** - Para upload/download de arquivos
- ✅ **Account: Cloudflare R2:Read** - Para acessar arquivos

### **Outros**
- ✅ **Account: Account Settings:Read** - Para configurações da conta
- ✅ **Account: User Details:Read** - Para informações do usuário

---

## 🚀 Passo a Passo para Criar o Token

### 1. Acesse o Dashboard Cloudflare
- Vá para: https://dash.cloudflare.com/
- Faça login na sua conta

### 2. Vá para API Tokens
- No menu lateral esquerdo, clique em **"My Profile"**
- Na aba **"API Tokens"**, clique em **"Create Token"**

### 3. Escolha o Template
- Selecione **"Create Custom Token"** (não use templates pré-definidos)

### 4. Configure o Token
- **Token name**: `LavaRapido-GitHub-Actions`
- **Permissions**:
  ```
  Account: Cloudflare Workers:Edit
  Account: Cloudflare Workers:Read
  Account: Cloudflare D1:Edit
  Account: Cloudflare D1:Read
  Account: Cloudflare R2:Edit
  Account: Cloudflare R2:Read
  Account: Account Settings:Read
  Account: User Details:Read
  ```

### 5. Configure Account Resources
- **Account Resources**:
  - Selecione sua conta Cloudflare
  - **Include specific resources?**: Sim
  - **Specific resources**:
    - Workers: All Workers
    - D1: All D1 databases
    - R2: All R2 buckets

### 6. Crie o Token
- Clique em **"Continue to summary"**
- Revise as permissões
- Clique em **"Create Token"**

### 7. Copie o Token
- **IMPORTANTE**: Copie o token imediatamente (não poderá vê-lo novamente)
- Guarde em local seguro

---

## 🔐 Adicionar Token no GitHub

### 1. Vá para o Repositório
- Acesse: https://github.com/eaoliveira74/LavaRapido
- Vá para **Settings** → **Secrets and variables** → **Actions**

### 2. Adicione o Secret
- Clique em **"New repository secret"**
- **Name**: `CLOUDFLARE_API_TOKEN`
- **Secret**: Cole o token copiado do Cloudflare
- Clique em **"Add secret"**

---

## ✅ Verificar se Funciona

Após adicionar o secret, faça um push qualquer na branch `main` (ex: edite o README.md):

```bash
# Faça uma pequena mudança
echo "Teste deploy" >> README.md
git add README.md
git commit -m "test: trigger deploy workflow"
git push origin main
```

### Verificar o Workflow
- Vá para **Actions** no GitHub
- Veja se o workflow "Deploy Cloudflare Worker" executou
- Se passou: ✅ Deploy automático funcionando!
- Se falhou: Verifique logs para erros

---

## 🆘 Troubleshooting

### Erro: "Invalid API token"
- Verifique se copiou o token completo
- Certifique-se que não há espaços extras
- Recrie o token se necessário

### Erro: "Insufficient permissions"
- Verifique se todas as permissões estão selecionadas
- Certifique-se que "All Workers", "All D1 databases", "All R2 buckets" estão selecionados

### Erro: "Account not found"
- Verifique se selecionou a conta correta no token
- Certifique-se que o email do token corresponde à conta GitHub

---

## 🔄 Renovação do Token

Tokens expiram automaticamente após 1 ano. Quando expirar:

1. Vá para **My Profile** → **API Tokens**
2. Delete o token antigo
3. Crie um novo seguindo os passos acima
4. Atualize o secret no GitHub

---

## 📞 Suporte

- [Documentação Cloudflare API Tokens](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [Wrangler Authentication](https://developers.cloudflare.com/workers/wrangler/install-and-update/#authenticate-with-cloudflare)
- [GitHub Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

---

**Última atualização**: 2026-04-21
**Token válido por**: 1 ano (renovar anualmente)
