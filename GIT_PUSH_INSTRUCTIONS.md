Instruções para enviar as mudanças para o GitHub

Se você já tem um repositório remoto no GitHub, adicione o remote e dê push:

1. Adicione o remote (substitua <owner> e <repo> pelo seu):

   git remote add origin https://github.com/<owner>/<repo>.git

2. Envie a branch main:

   git push -u origin main

Se ainda não criou o repositório no GitHub:

- Crie um novo repositório no GitHub (sem README se preferir evitar conflitos).
- Depois siga os passos acima para adicionar o remote e dar push.

Observações:
- Eu configurei o nome de usuário e email localmente para permitir commits nesta máquina.
- Não executei push automático para não modificar repositórios remotos sem sua permissão.
