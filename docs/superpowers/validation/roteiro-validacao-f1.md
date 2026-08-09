# Roteiro de validação F1 — sessão com a cliente

**Objetivo:** validar, com a dona da Allegra, que a interface mock (F1) representa bem o fluxo real do dia a dia — antes de investir na fase de banco de dados real (F2). Este é o gate de saída da F1.

**Como usar:** siga a ordem abaixo numa chamada/tela compartilhada com a cliente, de preferência no **deploy da Vercel** (não só local — é isso que prova que o F1 está de fato pronto para o gate). Marque cada passo conforme executado e anote qualquer reação, dúvida ou pedido de mudança da cliente na linha de "Feedback" — mesmo comentários pequenos ("achei estranho...", "eu esperava que...") valem registrar. Ao final, "Restaurar dados de demonstração" para deixar o ambiente limpo pra próxima pessoa.

**URL do deploy:** _____________________________________________

**Data da sessão:** ____ / ____ / ______ · **Com quem:** ___________________________

---

## 1. Login como Ana (admin)

- [ ] Abrir a tela de login e entrar como **Gabi Lauria** (botão "Entrar como").
- Observar: a cliente reconhece o nome/papel? A frase de abertura ("Onde cada detalhe fala de amor") soa como a marca da Allegra?

Feedback: _______________________________________________________________________

## 2. Dashboard — ler os números

- [ ] Ler em voz alta os 4 cards do topo (caixa atual, a receber, faturamento do mês, lucro do mês) e perguntar se os números "fazem sentido" pro que ela esperaria ver ali.
- [ ] Mostrar o gráfico Faturamento × Lucro (12 meses) e o período de análise (donut de serviços + saídas por categoria).
- [ ] Rolar até "Próximos eventos".
- Observar: os rótulos e a ordem das informações batem com o que ela usa hoje na planilha/Nubank?

Feedback: _______________________________________________________________________

## 3. Abrir o evento mais próximo

- [ ] A partir de "Próximos eventos" no dashboard (ou pela lista em Eventos), abrir o evento com a data mais próxima.
- [ ] Mostrar o cabeçalho (nome, tipo, data, "em N dias") e os cards financeiros do evento.

Feedback: _______________________________________________________________________

## 4. Registrar uma parcela recebida

- [ ] Na seção "Lançamentos" do evento, "Novo lançamento" → Entrada → um valor qualquer (ex.: uma parcela do contrato) → Registrar.
- Observar: o fluxo de "registrar um pagamento sem plano fixo de parcelas" combina com o jeito que ela recebe hoje ("pagam até o dia 30, sem dia fixo")?

Feedback: _______________________________________________________________________

## 5. Registrar um gasto

- [ ] Ainda no mesmo evento, "Novo lançamento" → Saída → escolher uma categoria (ex.: Freelancer) → um valor → Registrar.

Feedback: _______________________________________________________________________

## 6. Conferir os cards

- [ ] Voltar ao topo da página do evento e confirmar que Recebido/A receber/Custo/Lucro já refletem os dois lançamentos acima, sem precisar recarregar a página.
- Observar: ela confia no número de "a receber" mostrado, ou faria essa conta diferente?

Feedback: _______________________________________________________________________

## 7. Criar um lead

- [ ] Ir para **CRM** → "Novo lead" → preencher nome (pode ser fictício, ex. "Lead Teste — [data]") e interesse (tipo de evento) → salvar.
- [ ] Localizar o card do lead na coluna "Novo contato" do kanban.

Feedback: _______________________________________________________________________

## 8. Proposta com Orquestra/Trio

- [ ] Abrir o lead criado → aba "Propostas" → "Nova proposta" → adicionar o serviço **Orquestra**, variação **Trio** → confirmar o valor prefilled (ajustar se quiser) → enviar a proposta.
- Observar: o valor do contrato calculado bate com o que ela mesma somaria de cabeça?

Feedback: _______________________________________________________________________

## 9. Marcar a proposta como aceita

- [ ] Na lista de propostas do lead, marcar a proposta enviada no passo 8 como **"Marcar aceita"**.

Feedback: _______________________________________________________________________

## 10. Converter o lead em evento

- [ ] Com a proposta aceita, usar "Converter em evento" → confirmar nome/tipo/data do evento → converter.
- [ ] Confirmar que o lead some do kanban e aparece na Lista com badge GANHO, e que um evento novo aparece em Eventos com os serviços da proposta já copiados.

Feedback: _______________________________________________________________________

## 11. Configurações — criar uma variação nova

- [ ] Ir para **Configurações** → aba "Serviços" → expandir um serviço existente (ou o próprio Orquestra) → "Adicionar variação" → nome + preço → salvar.
- Observar: ela entende que isso já fica disponível pra próxima proposta/evento sem precisar de ajuda técnica?

Feedback: _______________________________________________________________________

## 12. Papel Comercial (Bia) — só CRM

- [ ] Sair (menu da barra lateral) e entrar como **Bia Costa**.
- [ ] Confirmar que o menu mostra só **Eventos** e **CRM** — sem Dashboard, Financeiro, Equipe nem Configurações.
- [ ] Abrir um evento como Bia e confirmar que os cards financeiros/lançamentos **não aparecem** (ela só vê nome, data, serviços contratados).
- Observar: esse recorte de permissão bate com o que a freelancer comercial deveria ver, na visão da cliente?

Feedback: _______________________________________________________________________

## 13. Restaurar dados de demonstração

- [ ] Sair de novo, voltar ao login, e clicar em **"Restaurar dados de demonstração"** (rodapé da tela) — confirma que o toast de sucesso aparece e que os dados de teste criados nos passos acima desaparecem na próxima entrada.

Feedback: _______________________________________________________________________

---

## Notas gerais da sessão

_(impressão geral, prioridades que surgiram, qualquer coisa que não coube nas linhas acima)_

<br><br><br><br><br><br>

## Critério de saída da F1

- [ ] Todos os 13 passos executados **no deploy da Vercel**, sem erro.
- [ ] "Restaurar dados de demonstração" confirmado funcionando.
- [ ] Feedback da cliente registrado acima e triado (o que é ajuste F1 vs. o que é F2/backlog).
