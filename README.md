# AllegraOS

Sistema de gestão web para a **Allegra**, assessoria e cerimonial de luxo de BH (casamentos, 15 anos e eventos corporativos). Substitui o controle manual em caixinhas do Nubank + planilhas: tudo gira em torno de **eventos** (contrato, recebimentos, custos) e, ao redor deles, caixa do negócio, dashboard de gestão e CRM de leads.

## Stack

- React 19 + Vite + TypeScript
- React Router v7 · TanStack Query
- Tailwind CSS v4 + shadcn/ui (radix-ui) · Recharts
- react-hook-form + zod · date-fns (pt-BR) · sonner (toasts)
- Vitest + Testing Library

## Rodar local

```bash
npm i
npm run dev
```

## Testes e verificação

```bash
npm run typecheck   # tsc -b --noEmit
npm test            # vitest run
npm run build       # tsc -b && vite build
npm run preview     # serve o build de dist/
```

## Deploy

Vercel, estático (SPA rewrite em `vercel.json`) — deploy automático a cada push em `main`. Fase mock não exige nenhuma env var.

## Usuárias demo

Não há autenticação real ainda (chega na F2, via Supabase). Na tela de login, "Entrar como" alterna entre as duas usuárias seedadas:

- **Ana Amaral** — papel admin, vê tudo (dashboard, financeiro, eventos, CRM, equipe, configurações).
- **Bia Costa** — papel comercial, só CRM e eventos (sem financeiro).

O botão **"Restaurar dados de demonstração"** (rodapé do login) reseta o store em memória para o seed original — útil depois de explorar/quebrar alguma coisa numa sessão de validação.

## Estrutura de pastas

```
src/domain/       tipos de domínio + cálculos puros (saldos, lucro, a receber)
src/data/         hooks TanStack Query + store mock em memória (única porta de dados)
src/pages/        telas, uma pasta por área (dashboard, eventos, financeiro, crm, configuracoes)
src/components/   UI compartilhada (shadcn/ui) + layout do app shell (sidebar/nav)
src/lib/          utilitários (formatação pt-BR, hooks pequenos como usePageTitle)
docs/             specs, plano de tarefas e roteiro de validação com a cliente
```

## Fase atual

**F1 — mock.** Toda a interface é navegável, mas os dados vivem num store mock (`src/data/store.ts`, seed em `src/data/seed.ts`) persistido só no `localStorage` do navegador — não há banco de dados real nem backend. Isso também significa que os dados persistem entre reloads *daquele navegador*; "Restaurar dados de demonstração" descarta esse estado e gera um seed novo relativo à data de hoje. Banco de dados real (Supabase: migrations, RLS, views, RPC, auth, convite por email) chega na F2, depois do gate de validação com a cliente.
