Título: Texto de descrição escuro no ambiente do cliente

Resumo:
Durante testes no ambiente local foi observado que textos de descrição (por exemplo labels, pequenas instruções e textos secundários) no `#client-view` estavam aparecendo com cor escura, gerando baixo contraste no tema escuro.

O que foi feito:
- Adicionadas regras CSS com alta especificidade em `index.css` para forçar cor branca em elementos dentro de `#client-view`.
- Como mitigação temporária, foi inserido e posteriormente removido um script temporário em `index.js` que forçava a cor branca via JS para diagnóstico.
- Implementado upload de comprovante no cliente e visualização no admin (commit separado).

Como reproduzir:
1. Rode o servidor: `npm install` e `npm run dev`.
2. Abra o app: `http://localhost:5173` (ou o endereço mostrado pelo Vite).
3. Clique em "Sou Cliente" e verifique as labels e textos secundários dentro dos cards.

Resultado observado:
- Antes: textos secundários dentro de `#client-view` apareciam escuros e com pouco contraste.
- Depois: regras CSS aplicadas tornam os textos brancos; se o navegador estiver cacheando CSS antigo pode ser necessário `Empty Cache and Hard Reload` (DevTools).

Recomendações / próximo passos:
- Verificar se alguma biblioteca externa (ex.: Bootstrap utilities) está aplicando regras de cor com maior especificidade; idealmente corrigir classes aplicadas em HTML (usar classes com contraste adequado) em vez de forçar via CSS global.
- Para produção, remover soluções de força (CSS com !important) e ajustar a arquitetura de temas (variáveis CSS ou classes `theme-dark` / `theme-light`).
- Se o problema reaparecer em navegadores específicos, coletar o seletor vencedor no DevTools (aba Styles) e anexar aqui.

Commits relacionados:
- feat(auth): add admin password modal with client-side SHA-256 validation
- feat(payments): client upload comprovante and admin view proof
- style(client): make .text-secondary white in client view for readability
- fix(client): increase selector specificity to ensure description text is white
- fix(client): force white text in #client-view with high-specificity rule
- fix(client): force white text inside client cards
- chore(temp): force white text in client view via JS for diagnosis (removed later)
- chore: remove temporary client text fix script (diagnostic)

Marcação:
- prioridade: média
- responsabilidade: frontend

Se quiser, posso também abrir uma Issue no GitHub diretamente (requer permissões OAuth) ou criar um PR separando a correção CSS em um branch e documentando o teste visual no README.
