# F2 — Requisitos de endurecimento (insumo para o plano da F2)

**Origem:** revisão de qualidade pós-F1 (2026-08-09). Este documento complementa o spec principal (`2026-08-07-allegra-os-design.md`) e **entra como requisito vinculante no plano da F2**, junto com as decisões colhidas na sessão de validação (ver seção "Decisões de semântica" do roteiro).

Princípio inalterado: nada aqui adiciona um campo sequer para a usuária preencher — é tudo inferência e garantia interna. A UI permanece como está.

## 1. Regras no Postgres, não só na UI

A F1 valida regras na interface; a F2 as torna invioláveis no banco (a diferença entre protótipo e produção). Migrations devem garantir:

- [ ] `CHECK`: valores e descontos não negativos em `event_services`, `proposals`, `proposal_services`, `events.discount_cents`
- [ ] `CHECK`: `transactions.amount_cents > 0`
- [ ] Categoria compatível com o tipo do lançamento (`transactions.kind` = `transaction_categories.kind` — trigger ou FK composta)
- [ ] Variante pertence ao serviço selecionado (`service_variants.service_id` = `event_services.service_id` / `proposal_services.service_id` — trigger ou FK composta)
- [ ] Proposta pertence ao contato correto (validado no RPC de conversão E por constraint)
- [ ] **Um evento por lead convertido** (unique parcial em `events.contact_id where contact_id is not null`)
- [ ] Posições válidas nas etapas do funil (unique em `pipeline_stages.position` entre ativas, gerido pelo RPC de reordenação)
- [ ] `created_by` **sempre** de `auth.uid()` (default/trigger — nunca aceito do client; elimina o `FALLBACK_PROFILE_ID` da F1)
- [ ] RLS em toda tabela via `has_perm()`: **impossível contornar permissões chamando o Supabase direto** — a UI é conveniência, a RLS é a fronteira

## 2. Operações multi-tabela = atômicas (RPC/função transacional)

Nunca sequências independentes no navegador:

- [ ] `create_proposal_with_items(...)` — proposta + itens numa transação (sem proposta pela metade se um item falhar)
- [ ] `convert_lead(...)` — já planejado no spec; valida proposta aceita/do contato/lead sem evento e copia itens+desconto atomicamente
- [ ] `reorder_stages(ordered_ids)` — reposicionamento inteiro numa transação
- [ ] `invite_user(...)` — convite + criação de perfil (Edge Function, service key)

## 3. Exclusão de lançamento com rastro (auditoria por inferência)

O botão de excluir da UI não muda. Internamente, exclusão vira **anulação/soft-delete**:

- [ ] Registrar quem excluiu e quando (`deleted_by`, `deleted_at` — ou tabela de auditoria)
- [ ] Preservar a versão anterior (linha permanece, filtrada das views)
- [ ] Views e cálculos ignoram anulados; nada "some sem deixar rastro" num sistema financeiro

## 4. Decisões pendentes da sessão de validação (bloqueiam partes do plano)

- [ ] **Semântica de "Contribuição por serviço"** (fechamento × data do evento × recebido) → define a view SQL do donut. Se for por fechamento, `event_services.created_at` já existe — zero campo novo.
- [ ] **Visibilidade de preços contratados para o papel Comercial** → vira regra de RLS em `event_services` (e coluna de desconto em `events`)

## 5. Backlog de endurecimento técnico (não pede reescrita)

Da revisão de qualidade — localizados, sem comprometer a arquitetura:

- [ ] Lint (ESLint) + CI (GitHub Actions: typecheck, test, build em PR)
- [ ] Error Boundary global (hoje um throw em render derruba a árvore)
- [ ] Playwright E2E (já previsto como F3 no plano original — antecipar smoke do fluxo crítico: login → evento → lançamento → conversão)
- [ ] Lazy loading por rota em vez de `chunkSizeWarningLimit` elevado
- [ ] Fontes: importar apenas subsets latinos usados pelo português
- [ ] Split dos arquivos >400 linhas quando tocados (`lead-panel`, `lead-proposals`, `financeiro/index`)
- [ ] `queueMicrotask` no `TransactionFormDialog` (race do Radix Select): revisitar a cada upgrade do Radix
- [ ] Workarounds Recharts v3 (labels com `isAnimationActive false`, hooks de escala): re-testar gráficos em qualquer upgrade
- [ ] Decisão de deps: TS 7 / Vite 8 / Vitest 4 são majors recém-nascidos — se o tooling da F2 (codegen Supabase) engasgar, voltar a TS 5.9 é barato; não fazer downgrade preventivo
- [ ] Efeitos com deps suprimidas manualmente (2 casos documentados) — revisar quando os arquivos forem tocados
- [ ] Mobile <375px: valores dos stat cards truncam e a legenda do gráfico de linha colide com o eixo (~333px) — piso oficial é 375, mas custo de corrigir é baixo (type fluida / legenda abaixo)

## Já corrigido nesta revisão (não entra no plano)

- ✅ Filtro temporal do dashboard: "Este ano" agora fecha em 31/12 do ano corrente (evento de 2027 não conta mais) e "Últimos 12 meses" fecha em hoje (sem datas futuras) — `periodToRange` com testes pinando as bordas.
