# AllegraOS — Plano de Implementação F0+F1 (mock-first)

> **Para agentes executores:** usar `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans`, tarefa por tarefa, TDD onde indicado, commit ao fim de cada tarefa.

**Objetivo:** interface completa e navegável do AllegraOS sobre camada de dados mock (localStorage), deployada na Vercel, pronta para a validação de direção e usabilidade com a cliente (gate F1 do spec).

**Spec de referência:** `docs/superpowers/specs/2026-08-07-allegra-os-design.md` (aprovado). Este plano cobre **F0 (fundação) + F1 (telas sobre mock)**. O plano da F2 (Supabase real) será escrito após o gate de validação com a cliente, como o spec define.

**Arquitetura:** Vite + React SPA. Componentes só acessam dados via hooks de `src/data/hooks/` (TanStack Query) sobre um mock store síncrono persistido em localStorage. Cálculos financeiros são funções puras em `src/domain/calc.ts` (futuro oráculo das views SQL). Auth fake com RBAC real na UI.

**Stack:** React ≥19, Vite ≥7, TypeScript strict, React Router ≥7 (library mode), TanStack Query ≥5, Tailwind ≥4 (CSS-first) + shadcn/ui, Recharts ≥3, react-hook-form ≥7 + zod ≥4 (@hookform/resolvers ≥5), date-fns ≥4, @dnd-kit/core ≥6, sonner, lucide-react, @fontsource-variable/jost + @fontsource/cormorant-garamond. Testes: Vitest ≥3 + Testing Library + happy-dom.

## Restrições globais (valem para TODAS as tarefas)

- UI 100% pt-BR; código (identificadores/commits) em inglês; commits convencionais (`feat:`, `test:`, `chore:`...).
- Dinheiro **sempre em centavos inteiros** (`number`); formatação só via `formatBRL`. Nunca float.
- Datas como string `YYYY-MM-DD`; horário `HH:mm`; nunca `Date` serializado no store.
- **Derivar, nunca armazenar**: status de evento, contrato, saldos, lucro, a receber vêm de `src/domain/calc.ts`.
- Cadastros dinâmicos: **nunca delete físico** — flag `active` (inativo some dos selects, permanece no histórico).
- Valores monetários em toda a UI: entrada verde `+` (`text-positive`), saída vermelha `−` (`text-negative`).
- Componentes **nunca** importam `store.ts` diretamente — só hooks de `src/data/hooks/`.
- Mobile-first: toda tela utilizável a 375px (tabelas viram cards ou têm scroll próprio).
- Tema fixo (light only) com tokens da marca (Tarefa 1); títulos em Cormorant Garamond, corpo em Jost.
- Simplicidade máxima (critério do spec): não adicionar campos, entidades ou features fora deste plano.
- Cada tarefa termina com `npm run typecheck && npm test && npm run build` verdes + commit.

## Paleta de gráficos (VALIDADA pelo script da skill dataviz — não alterar sem revalidar)

- Categórica (ordem fixa, nunca ciclar): `--chart-1 #bd8626` (ouro) · `--chart-2 #3e8540` (verde) · `--chart-3 #4f7ec2` (azul) · `--chart-4 #c05c4e` (terracota) · `--chart-5 #8358ad` (violeta). "Outros" = `--chart-other #8a8178` (neutro, fora do tema, sempre com label direto).
- Resultado do validador (surface `#fcfaf6`): ALL PASS; WARN ouro↔verde ΔE 6.1 (banda 6–8) — **legal apenas com encoding secundário**, obrigatório nos gráficos: gaps de 2px cor da surface entre fatias/barras, legenda sempre presente (≥2 séries), labels diretos seletivos.
- Linha faturamento×lucro: faturamento = `--chart-1`, lucro = `--chart-2` (entidades fixas).
- Barras de categorias: tom único `--chart-1` (magnitude; identidade fica no eixo).
- Dinheiro (status, reservado, nunca em série): positivo `#3f7d54` (4.7:1 ✓AA), negativo `#c13438` (5.3:1 ✓AA). `--destructive #de3b3d` só em botões/badges com texto claro.
- Regras dataviz: eixo único (nunca dual-axis), grid recessivo tracejado `#e3ddd8`, linhas 2px, hover targets ≥8px, tooltip BRL em tudo, texto sempre em tokens de texto (nunca na cor da série), donut = top 5 serviços + "Outros".

## Estrutura de arquivos (decomposição travada)

```
allegraOS/
├── package.json, vite.config.ts, tsconfig{,.app,.node}.json, index.html
├── vercel.json, components.json, .gitignore
├── src/
│   ├── main.tsx                # providers: QueryClient, Auth, Router, Toaster
│   ├── router.tsx              # tabela de rotas + guards
│   ├── index.css               # Tailwind 4 + tokens Allegra + fonts
│   ├── lib/{utils.ts, format.ts, format.test.ts}
│   ├── domain/{types.ts, calc.ts, calc.test.ts}
│   ├── data/
│   │   ├── seed.ts             # buildSeed(todayISO)
│   │   ├── store.ts (+store.test.ts)  # MockDB, CRUD, convertLead, resetDB
│   │   ├── auth.tsx            # AuthProvider fake + usePerms + RequirePerm
│   │   └── hooks/{use-settings,use-events,use-transactions,use-crm,use-team,use-dashboard}.ts
│   ├── components/
│   │   ├── ui/                 # shadcn (gerado)
│   │   ├── layout/app-shell.tsx
│   │   ├── money.tsx, currency-input.tsx
│   │   ├── transaction-form-dialog.tsx   # compartilhado: evento + financeiro
│   │   └── service-items-editor.tsx      # compartilhado: evento + proposta
│   └── pages/
│       ├── login.tsx, dashboard.tsx, financeiro.tsx, equipe.tsx, not-found.tsx
│       ├── eventos/{index.tsx, detalhe.tsx, partes locais}
│       ├── crm/{index.tsx, lead-panel.tsx, partes locais}
│       └── configuracoes/{index.tsx, tabs locais}
```

## Contratos centrais (tipos e assinaturas — fonte de verdade entre tarefas)

`src/domain/types.ts` espelha o schema do spec §4 em camelCase (entidade do evento se chama **`Evento`** para não colidir com `Event` do DOM; demais em inglês):
`Role{id,name,manageFinance,manageEvents,manageCrm,manageTeam,manageSettings}` · `Profile{userId,name,roleId,active}` · `EventType{id,name,active}` · `Service{id,name,defaultPriceCents:number|null,active}` · `ServiceVariant{id,serviceId,name,defaultPriceCents,active}` · `TransactionCategory{id,name,kind:'in'|'out',active}` · `PipelineStage{id,name,position,active}` · `Evento{id,name,eventTypeId,eventDate,eventTime:string|null,contactId:string|null,discountCents,canceled,notes:string|null,createdAt}` · `EventService{id,eventId,serviceId,variantId:string|null,priceCents,createdAt}` · `Transaction{id,kind:'in'|'out',amountCents,date,categoryId,eventId:string|null,description:string|null,createdBy,createdAt}` · `TeamMember{id,name,phone:string|null,roleLabel,payNotes:string|null,active}` · `Contact{id,name,phone:string|null,email:string|null,eventTypeId:string|null,stageId,archived,notes:string|null,createdBy,createdAt}` · `Proposal{id,contactId,sentDate,status:'sent'|'accepted'|'rejected',discountCents,notes:string|null,createdAt}` · `ProposalService{id,proposalId,serviceId,variantId:string|null,priceCents}` · `Activity{id,contactId,content,dueDate:string|null,done,createdBy,createdAt}`

`src/domain/calc.ts` (puras, testadas primeiro):
```ts
eventStatus(ev: Evento, todayISO: string): 'ativo' | 'concluido' | 'cancelado'
contractCents(items: EventService[] | ProposalService[], discountCents: number): number   // clamp ≥ 0
eventFinancials(ev, items, txs): { contractCents; receivedCents; costCents; profitCents; receivableCents }
  // received = Σ in do evento · cost = Σ out do evento · profit = received − cost
  // receivable = canceled ? 0 : max(contract − received, 0)
cashPositionCents(txs: Transaction[]): number                       // Σ in − Σ out (tudo)
totalReceivableCents(events, itemsByEvent, txs): number
monthlyFlow(txs, monthsBack: number, todayISO): { month: 'YYYY-MM'; revenueCents; expensesCents; profitCents }[]  // meses vazios zerados
serviceSalesRows(events, items): { serviceId; priceCents; eventDate }[]      // exclui cancelados
groupSalesByService(rows, services, period?: {from?: string; to?: string}): { serviceId; name; totalCents }[]  // desc
categoryExpenses(txs, categories, period?): { categoryId; name; totalCents }[]  // só out, desc
upcomingEvents(events, todayISO, limit: number): Evento[]           // ≥ hoje, não cancelados, asc
```

`src/data/store.ts`:
```ts
loadDB(): MockDB           // localStorage 'allegra-db-v1' ?? buildSeed(todayISO())
resetDB(): MockDB          // re-seeda e persiste
crud<K extends keyof MockDB>(key: K): { list(); get(id); create(input); update(id, patch); remove(id) }
convertLead(i: { contactId; proposalId; eventName; eventTypeId; eventDate; eventTime: string|null }): Evento
  // valida: proposta é do lead e status 'accepted', lead sem evento → cria Evento (discount da proposta),
  // copia proposalServices → eventServices; throw Error(mensagem pt) se inválido
canInactivateStage(stageId: string): boolean   // false se há contato ativo não-arquivado na etapa
```

`src/lib/format.ts`: `formatBRL(cents): string` · `inputToCents(masked: string): number` · `formatDate(iso): string /* dd/mm/aaaa */` · `formatTime(t: string|null): string` · `formatMonthShort('YYYY-MM'): string /* jan/25 */` · `todayISO(): string`

Componentes compartilhados:
```tsx
<Money cents kind?: 'in'|'out'|null />                       // in: +verde · out: −vermelho · null: neutro
<CurrencyInput valueCents onChangeCents placeholder? />       // máscara de dígitos → centavos
<TransactionFormDialog open onOpenChange defaultEventId?: string|null lockEvent?: boolean transaction?: Transaction />
<ServiceItemsEditor items onAdd(item) onRemove(id) discountCents onDiscountChange readOnly? />
  // item = { serviceId; variantId: string|null; priceCents } · preço pré-preenche do padrão, editável
```

Auth/rotas: `useAuth() → { user: {profile, role} | null; loginAs(profileId); logout() }` · `usePerms(): Role` · `<RequirePerm perm>` · `defaultRouteFor(role)` = dashboard→(manageFinance) senão crm→(manageCrm) senão /eventos. Mapa de rotas: `/login` público · `/dashboard`+`/financeiro` manageFinance · `/eventos`,`/eventos/:id` autenticado (seções financeiras do detalhe só com manageFinance; ações de escrita com manageEvents) · `/crm` manageCrm · `/equipe` manageTeam · `/configuracoes` manageSettings.

---

## Tarefas

### F0 — Fundação

### Task 0: Materializar o plano no repo

copiar este plano para `docs/superpowers/plans/2026-08-07-allegra-os-f0-f1.md`; commit `docs: plano de implementação F0+F1`.

### Task 1: Scaffold Vite + tema Allegra

escrever à mão (sem `create-vite`, evita prompts em dir não-vazio): `package.json` (scripts `dev/build/preview/test/typecheck`), `vite.config.ts` (plugins react + tailwindcss, alias `@→/src`, config vitest happy-dom), tsconfigs strict com paths, `index.html` (`lang="pt-BR"`, título "AllegraOS"), `.gitignore`, `vercel.json` `{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}`, `src/index.css` completo: `@import "tailwindcss"` + imports @fontsource (Jost Variable; Cormorant Garamond 500/600/700) + `:root` com todos os tokens do spec §8 **mais** `--positive #3f7d54`, `--negative #c13438`, `--chart-1..5/-other` (paleta validada acima) + bloco `@theme inline` mapeando `--color-*`, `--font-sans/serif`, `--radius-*` + base: `body` bg/fg/font-sans, `h1-h3` font-serif. `src/main.tsx` renderizando um card de sanidade com as fontes. Instalar deps (lista da Stack). Verificar: dev server mostra tipografia/cores da marca; build ok. Commit.

### Task 2: shadcn + formatadores + Money/CurrencyInput (TDD nos formatadores)

escrever `components.json` à mão (style new-york, css `src/index.css`, cssVariables true, aliases `@/components`, `@/lib/utils`) e `npx shadcn@latest add button card dialog alert-dialog input select tabs table badge sheet switch textarea label separator dropdown-menu tooltip sonner skeleton`. `src/lib/format.ts` com testes primeiro (`format.test.ts`): formatBRL(150000)→"R$ 1.500,00", inputToCents("1.234,56")→123456, inputToCents("")→0, roundtrip, formatDate, formatMonthShort, formatTime(null)→"—". `Money` e `CurrencyInput` (máscara por dígitos: digitar "1500" → "15,00") com teste RTL básico de sinal/cor/máscara. Commit.

### Task 3: Domínio (TDD)

`types.ts` completo (contratos acima) e `calc.ts` função a função: teste falhando → implementação mínima → verde. Casos obrigatórios: status (hoje = data do evento → ativo; ontem → concluído; cancelado vence), contrato clamp em 0 (desconto > soma), receivable 0 quando cancelado e quando recebido > contrato, monthlyFlow preenchendo meses sem lançamento com zeros (12 meses contínuos), donut excluindo evento cancelado e filtrando período, categoryExpenses só `out`, upcoming ordenado asc respeitando limite. Commit.

### Task 4: Mock store + seeds (TDD nas operações)

`seed.ts` `buildSeed(todayISO)` com datas RELATIVAS a hoje: roles Admin/Comercial (spec §4), profiles Ana (admin) e Bia (comercial), 3 tipos de evento, 8 serviços do site (Orquestra com variações Trio R$3.500/Quarteto R$4.500/Sexteto R$6.500; Carrinho de Brigadeiro "até 100" R$900/"até 200" R$1.400; demais com preço padrão), categorias do spec §4, 4 etapas de funil, 3 pessoas de equipe, 6 eventos (2 concluídos quitados com custos, 3 ativos parcialmente pagos — 1 a ~15 dias com horário, 1 cancelado), ~10 meses de lançamentos (custos fixos mensais Sala R$800 + Instagram R$260, parcelas e custos dos eventos) para os gráficos nascerem vivos, 7 leads distribuídos nas etapas (1 com proposta aceita pronto pra converter, 1 arquivado), 3 propostas (sent/accepted/rejected) com itens, atividades com follow-up de hoje e um atrasado. `store.ts` (API acima). Testes: persistência roundtrip em happy-dom, convertLead feliz + rejeições (proposta de outro lead, não aceita, lead já ganho), canInactivateStage. Commit.

### Task 5: Auth fake + permissões

`auth.tsx` (sessão em localStorage `allegra-session`, `loginAs`, `logout`, `usePerms`, `RequirePerm` com redirect para `defaultRouteFor`), teste unitário de `defaultRouteFor` (admin→/dashboard, comercial→/crm). Commit.

### Task 6: Router + AppShell + Login

`main.tsx` (providers + Toaster sonner), `router.tsx` (mapa acima + not-found pt), `app-shell.tsx`: sidebar desktop (wordmark "Allegra" serif, nav filtrada por permissão com ícones lucide, bloco do usuário + sair) e mobile (top bar + bottom nav ≤5 itens), páginas placeholder para todas as rotas. `login.tsx`: cartão com identidade (serif + dourado), campos email/senha decorativos, botões "Entrar como Ana — Administradora" / "Entrar como Bia — Comercial", rodapé "Restaurar dados de demonstração" (resetDB + toast). Verificar nos dois papéis e a 375px. Commit.

### Task 7: Deploy F0

`gh repo create allegraOS --private --source=. --push` (requer `gh` autenticado; confirmar owner com o usuário) e deploy Vercel (import do repo no dashboard OU `npx vercel` — passo assistido pelo usuário: login interativo). Gate F0: **shell navegável no ar**. Commit de eventuais ajustes.

### F1 — Telas sobre mock

### Task 8: Hooks de dados

todos os hooks de `src/data/hooks/` (exports listados nos Contratos; query keys por recurso, mutações invalidam as keys afetadas; `use-dashboard` compõe calc + store). Só typecheck (camada fina; store já testado). Commit.

### Task 9: Configurações: shell + Tipos/Categorias/Etapas

página com Tabs; editor de lista genérico local (nome + extras + switch ativo + criar/editar em dialog). Categorias com select in/out e badge colorida. Etapas com reordenar ↑/↓ (troca `position`) e inativação guardada por `canInactivateStage` → toast "Mova os leads desta etapa antes de inativá-la". Commit.

### Task 10: Configurações: Serviços & variações

tabela expansível: linha do serviço (nome, preço padrão ou "por variação", ativo) → sub-lista de variações (nome, preço, ativo) com CRUD. Formulários com CurrencyInput. Commit.

### Task 11: Configurações: Usuários & papéis (mock)

lista de perfis (nome, papel via select, ativo) + "Adicionar usuária" (dialog, com nota "convite real entra na fase de banco"); editor de papéis (linhas + switches das 5 permissões + novo papel). Guarda: não permitir remover a própria permissão de configurações/inativar a si mesma (toast). Commit.

### Task 12: Eventos: lista + criar

busca por nome, filtros (tipo, ano, status derivado — default **Ativos**), ordenação **crescente por data (+hora)**; colunas nome/tipo/data+hora/status badge/contrato/recebido/a receber; mobile = cards. "Novo evento": nome, tipo, data, horário (opcional) → navega ao detalhe. Estados vazios. Commit.

### Task 13: Evento: detalhe base

header (nome, badges de tipo e status, **data + horário em destaque serif**, "em N dias" se futuro), 5 stat cards via `useEventFinancials` (contrato/recebido/a receber/custo/lucro; excedente recebido > contrato mostrado como nota visual, spec §9), observações (textarea + salvar), editar (dialog), cancelar (AlertDialog) / reativar; banner quando cancelado. Seções de serviços/lançamentos como placeholders. Gating: cards e lançamentos só com manageFinance; escrita só com manageEvents. Commit.

### Task 14: Evento: serviços + desconto

`ServiceItemsEditor` (componente compartilhado): tabela de itens (serviço, variação, valor, "fechado em", remover), "Adicionar serviço" (select de ativos → select de variação obrigatório quando houver → CurrencyInput pré-preenchido do padrão, exigir > 0), desconto geral editável, linha-resumo "Σ itens − desconto = contrato". Plugar no detalhe. Commit.

### Task 15: Evento: lançamentos

`TransactionFormDialog` (compartilhado): toggle Entrada/Saída, CurrencyInput, data (default hoje), categoria filtrada por tipo (default "Pagamento de contrato" p/ entrada em evento), descrição; evento travado no contexto do detalhe; aviso quando evento cancelado. Lista date desc com `<Money kind>`, editar/excluir com confirmação. Commit.

### Task 16: Financeiro

livro-razão completo: filtros (mês default atual + "todos", tipo, categoria, escopo Todos/Administração central/Evento específico), tabela date desc, rodapé com totais do filtro (entradas, saídas, saldo), "Novo lançamento" (mesmo dialog, evento destravado), mobile cards. Commit.

### Task 17: Dashboard

cards (Caixa atual, A receber, Faturamento do mês, Lucro do mês); linha 12 meses faturamento×lucro (`--chart-1`/`--chart-2`, 2px, hover dots ≥8px, labels diretos no fim + legenda, grid tracejado recessivo, tooltip BRL, eixo único); donut por serviço (filtro Este ano/Últimos 12 meses/Tudo; top 5 + "Outros" `--chart-other`; stroke 2px `--background` entre fatias; total no centro; legenda + % nas fatias ≥8%); barras horizontais de saídas por categoria (tom único `--chart-1`, valores à direita, mesmo filtro de período do donut); lista Próximos eventos (5: nome, data+hora, "em N dias", a receber). Recharts + ResponsiveContainer; empilhar no mobile. Conferir contra `references/anti-patterns.md` da skill dataviz. Commit.

### Task 18: CRM: kanban

colunas = etapas ativas por `position`; cards (nome, badge do tipo de interesse, badge de follow-up vencido); drag entre colunas (@dnd-kit: DndContext + useDroppable/useDraggable) → `moveStage`; toggle Kanban/Lista (lista com select de etapa inline); banner de follow-ups hoje/atrasados no topo (contador + lista → abre lead); "Novo lead" (nome, telefone, email, tipo de interesse, etapa default = primeira); arquivados ocultos + toggle "Ver arquivados"; mobile: colunas com scroll horizontal + snap. Commit.

### Task 19: CRM: painel do lead

Sheet (direita no desktop, fullscreen mobile): dados editáveis, timeline desc (nota; follow-up com data; checkbox concluir), arquivar/desarquivar, badge **GANHO** + link para o evento quando existir evento com `contactId` do lead. Commit.

### Task 20: CRM: propostas + conversão

seção propostas no painel: lista (data, valor Σ itens − desconto, badge de status, marcar aceita/recusada quando enviada), "Nova proposta" (ServiceItemsEditor + desconto + data + notas). "Converter em evento": habilitado com proposta aceita e lead sem evento → dialog (proposta [se >1 aceita], nome prefill, tipo prefill do interesse — obrigatório, data, horário) → `convertLead` → toast + navegar ao evento. Commit.

### Task 21: Equipe

tabela CRUD (nome, telefone, função, pagamento em texto livre, ativo) com dialog e estado vazio. Commit.

### Task 22: Polimento F1 + gate de validação

auditoria de estados vazios/skeletons; erros globais → toast (handler no QueryClient); `document.title` por página; favicon simples; varredura mobile 375px tela a tela; README (rodar, deploy, usuários demo, restaurar demo); build + deploy; **roteiro de validação com a cliente**: login → dashboard → abrir evento próximo → registrar parcela e gasto → conferir totais → criar lead → proposta → converter → configurações (criar variação) → papel Comercial (só CRM). Commit. **Gate F1: sessão de validação com a cliente.**

## Verificação end-to-end

- Por tarefa: `npm run typecheck && npm test && npm run build` verdes antes do commit.
- T6/T9–T22: verificação visual no browser (dev server) — desktop e 375px; checar os dois papéis onde houver gating (Ana vê tudo; Bia só CRM/eventos sem financeiro).
- T17: comparar cada gráfico com os anti-patterns da skill dataviz (eixo único, sem rainbow, legenda presente, gaps).
- Fim de F1: roteiro completo da T22 executado sem erro no deploy da Vercel (não só local); dados de demonstração restauráveis.

## Fora deste plano

F2 (Supabase: migrations, RLS, views, RPC, auth real, Edge Function de convite, swap dos hooks) e F3 (pós-validação, Playwright E2E) — planos próprios após o gate F1. Nada de persistência real, import de dados, notificações ou multi-tenant agora.
