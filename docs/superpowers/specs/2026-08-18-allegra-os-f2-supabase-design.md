# AllegraOS — F2: Supabase como banco de dados real

**Data:** 2026-08-18  
**Status:** aprovado para especificação; aguardando revisão do plano de execução

## Objetivo

Substituir a persistência local e a autenticação simulada do AllegraOS por Supabase Auth e Postgres, mantendo as telas como consumidoras exclusivas dos hooks em `src/data/`.

O resultado é um sistema single-tenant com dados persistentes, controle de acesso aplicado no banco, operações financeiras auditáveis e cálculos derivados confiáveis.

## Decisões confirmadas

- A contribuição por serviço no dashboard é uma métrica de **venda por data de fechamento do item**. A origem será `event_services.created_at`; pagamentos não alteram essa métrica.
- A usuária com papel Comercial pode consultar, nos eventos, os serviços contratados, seus valores e o desconto geral. Não pode consultar lançamentos, recebimentos, custos, lucro, caixa, dashboard ou views financeiras.

## Arquitetura

```text
React SPA
  └─ hooks em src/data/ ────── supabase-js ────── Supabase
                                                   ├─ Auth (email/senha, recuperação)
                                                   ├─ Postgres (schema versionado)
                                                   ├─ RLS (fronteira de autorização)
                                                   ├─ views security_invoker (derivados)
                                                   ├─ RPCs transacionais
                                                   └─ Edge Function invite_user
```

Não haverá API intermediária. O cliente usa somente a chave pública do Supabase; nenhuma service-role key entra no frontend. A Edge Function é a única operação que pode usar credenciais administrativas e valida o chamador antes de convidar uma usuária.

## Modelo e integridade do banco

Todas as tabelas terão `id uuid` (ou `profiles.user_id` como chave primária), `created_at timestamptz default now()` quando aplicável e chaves estrangeiras explícitas. As migrations serão a única fonte de verdade do schema.

Tabelas de catálogo: `event_types`, `services`, `service_variants`, `transaction_categories` e `pipeline_stages`. Elas preservam histórico com `active`; um registro utilizado não pode ser removido fisicamente.

Tabelas centrais: `events`, `event_services`, `transactions`, `team_members`. Tabelas de CRM: `contacts`, `proposals`, `proposal_services`, `activities`. Tabelas de acesso: `roles`, `profiles`.

As migrations impõem, no banco:

- valores e descontos não negativos em serviços, propostas e eventos;
- `transactions.amount_cents > 0`;
- categoria compatível com `transactions.kind`;
- variante compatível com o serviço de cada item;
- uma única conversão por lead, com índice único parcial em `events.contact_id` quando não nulo;
- posições únicas entre as etapas ativas;
- atribuição de `created_by` pelo usuário autenticado, nunca por valor recebido do cliente;
- exclusão de lançamento como anulação auditável, com `deleted_at` e `deleted_by`, preservando a linha original.

Índices acompanham todas as chaves de consulta e de relacionamento usadas pela aplicação: relações de evento, contato, proposta, categoria, data de lançamento, data do evento e filtros das views. Índices parciais cobrem registros ativos e não anulados quando forem os filtros predominantes.

## Autorização

`has_perm(permission)` será uma função `security definer`, com `search_path` fixo, que resolve `auth.uid()` por `profiles → roles`. A função será usada pelas políticas RLS de todas as tabelas; uma tela escondida não é considerada proteção.

| Recurso | Leitura | Escrita |
|---|---|---|
| Eventos e itens contratados | autenticado | `manage_events` |
| Lançamentos e views financeiras | `manage_finance` | `manage_finance` |
| Catálogos | autenticado | `manage_settings` |
| CRM | `manage_crm` | `manage_crm` |
| Equipe | `manage_team` | `manage_team` |
| Perfis e papéis | próprio perfil ou `manage_settings` | `manage_settings` |

O Comercial, portanto, pode ler eventos e seus itens contratados, incluindo preço e desconto; o acesso financeiro continua negado diretamente pela RLS.

## Derivados e operações atômicas

As views `v_event_financials`, `v_cash_position`, `v_monthly_flow`, `v_service_sales` e `v_category_expenses` serão criadas com `security_invoker = true`; elas respeitam a RLS da usuária em vez de a contornar.

`v_service_sales` toma `event_services.created_at` como data de referência. O agrupamento visual por serviço continua no cliente, enquanto a view retorna cada item vendido com seu serviço, valor e instante de fechamento.

As seguintes mutações são funções SQL transacionais, sem sequências independentes no navegador:

- `create_proposal_with_items`: cria a proposta e todos os itens;
- `convert_lead`: valida proposta aceita e pertencente ao lead, cria evento, copia desconto e itens e devolve o id do evento;
- `reorder_stages`: valida a lista completa e atualiza posições de forma segura.

## Aplicação e autenticação

Será instalado `@supabase/supabase-js`, com cliente isolado em `src/data/supabase/`. Variáveis públicas serão `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`; um `.env.example` documentará apenas esses nomes, sem segredos.

`AuthProvider` trocará o armazenamento local por observação de sessão do Supabase. O login usará email/senha e terá recuperação de senha pelo fluxo nativo. A sessão carregará o perfil e o papel do banco para manter os guards e a navegação existentes. Estados de carregamento, sessão expirada e erros do PostgREST/Auth receberão mensagens em português adequadas à interface.

Cada hook existente ganhará uma implementação Supabase equivalente, com mapeamento explícito entre `snake_case` do banco e os tipos camelCase de `src/domain/types.ts`. As páginas e componentes continuam importando apenas hooks, nunca `supabase-js`.

`invite_user` será uma Edge Function. Ela autentica o solicitante, exige `manage_settings`, envia convite por email via Admin API e cria/associa o perfil ao papel solicitado de forma transacional e idempotente.

## Dados iniciais e transição

Uma migration de seed cria os papéis Admin e Comercial, além de catálogos iniciais necessários para um ambiente vazio utilizável. Não serão importados os dados do `localStorage`: por serem demonstrativos e específicos de cada navegador, a transição começa com banco real vazio e onboarding/backfill assistido dos contratos ativos na F3.

O botão de restauração de dados de demonstração e os atalhos de “entrar como” deixam de existir quando a autenticação real estiver ativa.

## Verificação

- Testes de integração do Supabase local comparam views ao oráculo de `src/domain/calc.ts` para cenários de desconto, evento cancelado, edição retroativa e lançamentos centrais.
- Testes de RPC cobrem proposta incompleta, proposta de outro contato, proposta não aceita, lead já convertido e conversão válida.
- Smoke tests de RLS usam sessões Admin e Comercial para confirmar que o Comercial consulta CRM, catálogos e valores contratados, mas não dados financeiros nem operações administrativas.
- Testes de hooks validam mapeamento, invalidação do TanStack Query e mensagens de falha relevantes.
- Testes de autenticação cobrem login, logout, perfil inativo, recuperação de senha e redirecionamento por permissão.

## Fora de escopo

Não fazem parte da F2: multi-tenant, importação automática de planilhas ou dados locais, custos recorrentes, notificações/WhatsApp, anexos de propostas, previsão financeira, vínculo financeiro à equipe e E2E completo de navegador. O backfill assistido e os E2E ficam para a F3.
