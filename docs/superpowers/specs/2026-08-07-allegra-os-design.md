# AllegraOS — Design do Sistema de Gestão

**Data:** 2026-08-07 · **Status:** aprovado no brainstorming, aguardando revisão final do spec

## 1. Contexto e objetivo

Sistema de gestão web para a **Allegra** (allegrabr.com.br), assessoria e cerimonial de luxo de BH que atende casamentos, festas de 15 anos e eventos corporativos. Substitui o controle manual feito hoje em caixinhas do Nubank + planilhas Numbers.

Tudo gira em torno de **eventos**: cada evento tem contrato (composto por serviços vendidos), recebimentos parcelados sem data fixa, e custos atribuídos. Ao redor disso: caixa do negócio, custos fixos, dashboard de gestão, CRM de leads e cadastros dinâmicos.

**Critério de sucesso: máxima simplicidade.** Menos campos em formulário, menos entidades, menos coisa pra preencher. Tudo que puder ser derivado é derivado, nunca pedido à usuária. Não modelamos processos físicos do mundo real que não precisam estar no sistema (ex.: em qual caixinha do banco o dinheiro está fisicamente).

**Usuárias:** a dona (admin, vê tudo) e uma freelancer comercial (só CRM). RBAC simples em tabela para adicionar pessoas/papéis depois.

## 2. Decisões estruturais

| Decisão | Escolha | Racional |
|---|---|---|
| Framework | **React + Vite SPA** (não Next.js) | Sistema interno logado: SEO/SSR não valem nada; Supabase já é o backend completo; Vite é mais simples de manter e deploya estático na Vercel |
| Backend | **Supabase** — Auth, Postgres com RLS, RPC, views | RLS é a fronteira de segurança; client fala direto com o banco |
| Deploy | **Vercel** (estático + SPA rewrite) | Preview deploy por push; fase mock nem precisa de env vars |
| Tenancy | **Single-tenant** (só Allegra) | Replicar para outro cliente = outra instância Supabase |
| Estratégia de entrega | **Mock-first**: interface completa navegável com dados fake antes do banco | Cliente valida direção e usabilidade antes de investirmos em SQL |
| Parcelas | **Registro livre** de pagamentos (sem plano de parcelas) | "A receber" = contrato − recebido; fiel ao "pagam até o dia 30, sem dia fixo" |
| Histórico | **Backfill manual** pela cliente | Dezenas de eventos; serve de onboarding |
| Regime | **Caixa** (não competência) | Tudo conta na data em que o dinheiro entrou/saiu |
| Dinheiro | **Centavos inteiros** (`int`), nunca float | Formatação com `Intl` pt-BR |
| Datas | `date` puro (+ `time` para horário de evento) | Sem drama de fuso horário |

## 3. Arquitetura

```
React SPA (Vite + TS)
├─ src/domain/        tipos de domínio + cálculos puros (saldos, lucro, a receber)
├─ src/data/          hooks TanStack Query — ÚNICA porta de dados dos componentes
│   ├─ mock/          v0: store em memória + localStorage, seeds realistas, auth fake
│   └─ supabase/      v1: supabase-js + tipos gerados do schema (mesma interface)
├─ src/pages/         telas (React Router v7)
└─ src/components/    shadcn/ui + tema Allegra

Supabase (fase 2)
├─ migrations SQL versionadas (CLI, dev local via Docker)
├─ RLS em toda tabela (função has_perm)
├─ views para todos os agregados (security_invoker)
├─ RPC: convert_lead (única operação multi-tabela)
└─ Edge Function: invite_user (única peça server-side; exige service key)
```

**Bibliotecas:** React Router v7, TanStack Query, Tailwind + shadcn/ui, Recharts, react-hook-form + zod, date-fns (pt-BR), sonner (toasts), supabase-js.

**Regra de ouro da camada de dados:** componente nunca importa supabase nem mock diretamente — só hooks de `src/data/`. Trocar mock→Supabase não toca em nenhuma tela. Os cálculos derivados vivem em `src/domain/calc.ts` na fase mock e depois são portados para views SQL; as funções TS viram o oráculo dos testes de integração das views.

## 4. Modelo de dados

Convenções: nomes em inglês, valores de enum em inglês (tradução na UI), `id uuid` default `gen_random_uuid()`, `created_at timestamptz` default `now()`. Cadastros dinâmicos têm `active boolean` — **nunca delete físico** de registro em uso; inativar tira dos selects e preserva o histórico.

### Cadastros dinâmicos (tela Configurações — nada hardcoded)

| Tabela | Colunas |
|---|---|
| `event_types` | `name` unique — seed: Casamento, 15 Anos, Corporativo |
| `services` | `name`, `default_price_cents int null` (para serviços sem variação) |
| `service_variants` | `service_id fk`, `name`, `default_price_cents int not null` — ex.: formações da Orquestra, faixas de convidados do Carrinho de Brigadeiro |
| `transaction_categories` | `name`, `kind: 'in' \| 'out'` — seeds out: Gasolina/Deslocamento, Pagamento de freelancer, Sala/Escritório, Investimento em equipamento, Salário fixo, Marketing/Instagram; seed in: Pagamento de contrato |
| `pipeline_stages` | `name`, `position int` — etapas do funil são rótulos puros, sem semântica (ganhou = lead com evento vinculado; perdeu = arquivado) |

Seed de serviços (do site): Assessoria Premium, Assessoria Essencial, Celebrante e Mestre de Cerimônia, Storymaker, Orquestra, Foto Polaroid, Carrinho Gourmet de Brigadeiro, Aluguel de Som.

### Núcleo

**`events`** — `name`, `event_type_id fk`, `event_date date not null`, `event_time time null` (informação central, em destaque; pode ser definida depois do fechamento), `contact_id fk null` (lead de origem), `discount_cents int default 0`, `canceled boolean default false`, `notes text null`.

- **Sem coluna de status.** Status é derivado: `canceled` → Cancelado; `event_date < hoje` → Concluído; senão → Ativo.
- **Valor do contrato é derivado**: Σ `event_services.price_cents` − `discount_cents`. O casal fecha produtos em datas separadas, então o contrato cresce com os itens; negociação por item = sobrescrever o preço; desconto geral existe para conciliar o total.

**`event_services`** — `event_id fk`, `service_id fk`, `variant_id fk null`, `price_cents int not null` (pré-preenchido pelo padrão da variação ou do serviço; editável), `created_at` (registra quando cada item foi fechado).

**`transactions`** — o livro-razão único do sistema:

| Coluna | Regra |
|---|---|
| `kind` | `'in'` (entrada) ou `'out'` (saída) |
| `amount_cents int` | `> 0` |
| `date date` | data em que o dinheiro se moveu |
| `category_id fk` | categoria dinâmica; default inteligente na UI (ex.: entrada em evento → "Pagamento de contrato") |
| `event_id fk null` | **atribuição**: preenchido = lançamento do evento; vazio = administração central (custos fixos, receitas avulsas) |
| `description text null` | opcional |
| `created_by fk profiles` | auditoria mínima |

Sem origem do dinheiro, sem transferências, sem encerramento financeiro, sem previsto/realizado. A caixinha do Nubank é controle físico pessoal da cliente, fora do sistema. Gasto pré-evento (ex.: gasolina de visita técnica um ano antes) é simplesmente uma saída atribuída ao evento.

**`team_members`** — `name`, `phone null`, `role_label` (função), `pay_notes text null` (forma de pagamento em texto livre: "R$100/venda", "R$260/mês"), `active`. Cadastro leve, **sem vínculo com transactions na v1** — "quanto gasto com freelancer" a categoria responde; relatório por pessoa é uma coluna opcional futura.

### CRM

**`contacts`** — `name`, `phone null`, `email null`, `event_type_id fk null` (interesse), `stage_id fk`, `archived boolean default false` (descarte), `notes null`, `created_by`. Lead "ganho" = existe evento com `contact_id` dele (sem coluna própria). Lead ganho sai do kanban e permanece na Lista com badge GANHO.

**`proposals`** — `contact_id fk`, `sent_date date`, `status: 'sent' | 'accepted' | 'rejected'` default sent, `discount_cents int default 0`, `notes null`. Valor = Σ itens − desconto (derivado).

**`proposal_services`** — `proposal_id fk`, `service_id fk`, `variant_id fk null`, `price_cents`.

**`activities`** — timeline do lead: `contact_id fk`, `content text`, `due_date date null`, `done boolean` (nota = sem due_date, done true; follow-up = com due_date, done false até concluir), `created_by`.

### Acesso

**`roles`** — `name` + 5 permissões booleanas: `manage_finance`, `manage_events`, `manage_crm`, `manage_team`, `manage_settings`. Seeds: **Admin** (todas true), **Comercial** (só `manage_crm`). Novo papel = nova linha, editável na UI.

**`profiles`** — `user_id uuid pk → auth.users`, `name`, `role_id fk`, `active boolean`.

### Derivados (views SQL na fase 2; `src/domain/calc.ts` na fase mock)

| View | Conteúdo |
|---|---|
| `v_event_financials` | por evento: contrato (Σ itens − desconto), recebido (Σ in), custo (Σ out), lucro (recebido − custo), a receber (max(contrato − recebido, 0), zerado se cancelado) |
| `v_cash_position` | caixa do negócio = Σ todas entradas − Σ todas saídas (um número) |
| `v_monthly_flow` | por mês: faturamento (Σ in), saídas (Σ out), lucro (diferença) |
| `v_service_sales` | itens vendidos com serviço, valor e data do evento (donut agrupa por serviço no client, variações somam juntas; filtro de período) |
| `v_category_expenses` | saídas por categoria e mês |

Views com `security_invoker = true` (respeitam a RLS do usuário logado).

### RPC (única): `convert_lead`

`convert_lead(contact_id, proposal_id, event_name, event_date, event_time) → event_id`

Valida que a proposta pertence ao lead e está aceita; cria o evento (tipo herdado do lead, desconto herdado da proposta); copia `proposal_services` → `event_services`; vincula `contact_id`. Atômica por ser uma função SQL. Na fase mock, mesma operação no store.

## 5. Regras de negócio

1. **Atribuição é o único conceito financeiro**: lançamento pertence a um evento ou à administração central. Ponto.
2. Saldos, contrato, status, lucro, a receber: **sempre derivados, nunca armazenados** — impossível dessincronizar, nada extra pra preencher.
3. Evento cancelado sai do "a receber" e dos próximos eventos, mas mantém o histórico real de dinheiro (devolução ao casal = saída atribuída ao evento).
4. Lançamentos são editáveis e excluíveis (com confirmação) — derivados se corrigem sozinhos.
5. Etapa do funil só pode ser inativada sem leads ativos nela (mensagem orienta mover antes).
6. Categoria/serviço/variação/tipo em uso: só inativação, nunca exclusão.

## 6. Acesso e segurança

- Login email/senha (Supabase Auth); reset de senha pelo fluxo nativo.
- Criação de usuário: admin aciona a Edge Function `invite_user` (usa service key; valida `manage_settings` do chamador).
- **RLS em toda tabela** via função `has_perm(permission)` (security definer, lê `profiles → roles` do `auth.uid()`):

| Tabelas | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `transactions`, views financeiras | `manage_finance` | `manage_finance` |
| `events`, `event_services` | autenticado | `manage_events` |
| cadastros dinâmicos | autenticado (comercial monta proposta) | `manage_settings` |
| `contacts`, `proposals`, `proposal_services`, `activities` | `manage_crm` | `manage_crm` |
| `team_members` | `manage_team` | `manage_team` |
| `profiles`, `roles` | próprio perfil; tudo com `manage_settings` | `manage_settings` |

- Na fase mock: auth fake com troca de papel (Admin/Comercial) para validar a UX de permissões; segurança real chega com o banco.

## 7. Telas

Navegação: sidebar (desktop) / drawer + bottom bar (mobile). **Mobile-first** — a cliente opera do celular no dia do evento. Em toda a UI, valores monetários têm cor por tipo: **entrada verde com `+`, saída vermelha com `−`**.

| Tela | Conteúdo e ações |
|---|---|
| **Login** | email/senha, esqueci a senha |
| **Dashboard** (requer financeiro) | Cards: caixa atual, a receber, faturamento do mês, lucro do mês. Linha 12 meses (faturamento × lucro), donut contribuição por serviço (filtro de período), barras de saídas por categoria, lista de próximos eventos |
| **Eventos** | Lista **ordenada por data crescente**, busca + filtros (tipo, ano, status derivado). Criar evento = nome, tipo, data, horário (horário pode ficar pra depois) |
| **Evento (detalhe)** | Header: nome, tipo, **data e horário em destaque**, status derivado. Cards: contrato, recebido, a receber, custo, lucro. Seções: serviços contratados (adicionar item serviço→variação→preço; desconto geral) · lançamentos do evento (adição rápida in/out) · observações. Ações: cancelar (confirmação), editar |
| **Financeiro** (requer financeiro) | Livro-razão completo, filtros: mês, tipo, categoria, evento/administração central. Lançamento rápido. Custos fixos entram aqui (sem evento) |
| **CRM** (requer CRM) | Kanban por etapa com drag + modo lista; follow-ups de hoje/atrasados em destaque no topo. Painel do lead: dados, timeline (notas + follow-ups com check), propostas (criar com serviços/variações + desconto, marcar aceita/recusada), **Converter em evento** (pede nome/data/horário), arquivar |
| **Equipe** (requer equipe) | CRUD leve de pessoas |
| **Configurações** (requer configurações) | Tabs: Tipos de evento · Serviços & variações · Categorias de lançamento · Etapas do funil · Usuários & papéis |

## 8. Direção visual

O site institucional já é um tema shadcn/Tailwind — o sistema **herda os tokens 1:1** (vibe premium da marca):

```css
--background: #fcfaf6;  --foreground: #25211d;
--primary: #966d36;     --primary-foreground: #ffffff;   /* bronze profundo, AA 4.63:1 c/ branco (ajuste pós-F1; dourado claro segue em --accent/--ring/gráficos) */
--secondary: #f7f0eb;   --muted: #f3ede9;  --muted-foreground: #6a615b;
--accent: #ead8bd;      --accent-foreground: #3a281a;
--destructive: #de3b3d; --border: #e3ddd8; --input: #e9e3df; --ring: #b88952;
--radius: .75rem;
```

Tipografia: **Cormorant Garamond** (títulos, serifada), **Jost** (corpo, sans), Allura (script, uso decorativo pontual). **Números nunca em serif** (ajuste pós-F1): todo valor numérico — dinheiro, totais, contagens, blocos de data — usa Jost `tabular-nums` (o componente `Money` impõe `font-sans` por padrão); a serif fica para palavras. Única exceção deliberada: a linha de data por extenso no herói do detalhe do evento ("12 de setembro de 2026"), que é prosa. Cartões brancos sobre off-white quente, dourado como cor de ação. Verde/vermelho de valores monetários calibrados para harmonizar com a paleta quente.

## 9. Erros e edge cases

- Formulários com zod (valor > 0, datas válidas); erros do Postgres mapeados para mensagens amigáveis em pt-BR; toasts globais de erro via TanStack Query; estados de loading/vazio em toda lista.
- Lançamento em evento cancelado: permitido (devoluções acontecem), com aviso.
- Lead convertido mantém timeline; vínculo lead ↔ evento navegável nos dois sentidos.
- Serviço com variações não aceita venda sem escolher variação; serviço sem preço padrão exige digitar o valor.
- Contrato pode ficar menor que o recebido após edição (desconto tardio): "a receber" trava em zero e a página do evento mostra o excedente como observação visual, sem bloquear.

## 10. Estratégia de testes

O risco mora nos cálculos e na segurança, não no CRUD:

1. **Unit (Vitest)** — `src/domain/calc.ts` (contrato, recebido, custo, lucro, a receber, caixa, fluxo mensal) com casos do mundo real (evento cancelado, desconto, edição retroativa). Escritos já na fase mock.
2. **Integração SQL (fase banco)** — Supabase local seedado; asserts das views comparando com o oráculo TS (mesmos cenários, mesmos números) e da RPC `convert_lead`.
3. **RLS smoke** — clients com JWT de Admin e de Comercial: comercial não lê `transactions` nem views financeiras; escrita negada onde não tem permissão.
4. **E2E (Playwright, fase final)** — 3 fluxos: login → criar evento + lançamentos → conferir totais; lead → proposta → conversão; usuária comercial vê só CRM.

## 11. Fases de entrega

| Fase | Entrega | Gate |
|---|---|---|
| **F0 — Fundação UI** | Repo git, Vite + TS + Tailwind + shadcn com tema Allegra, React Router, shell de navegação responsivo, tipos de domínio, mock store (localStorage) com seeds realistas, login fake com troca de papel, deploy Vercel | app navegável no ar |
| **F1 — Interface completa (mock)** | Todas as telas da seção 7 funcionando sobre o mock: Configurações, Eventos + detalhe, Financeiro, Dashboard, CRM kanban, Equipe. Unit tests do domínio | **validação de direção e usabilidade com a cliente** |
| **F2 — Banco real** | Projeto Supabase, migrations do schema completo, RLS + testes, views + RPC + testes de integração, auth real, Edge Function de convite, swap da camada mock → supabase (telas intocadas) | dados persistindo com segurança |
| **F3 — Pós-validação e acabamento** | Ajustes do feedback da cliente, E2E Playwright, polimento mobile, onboarding/backfill assistido dos contratos ativos | cliente operando o sistema |

## 12. Fora de escopo (v1)

Plano de parcelas esperadas · controle previsto/realizado de custos · importador de planilhas · vínculo lançamento↔pessoa da equipe (relatório por pessoa) · anexos/PDF de proposta · notificações e integração WhatsApp · multi-tenant · recorrência automática de custos fixos (lançamento manual mensal).
