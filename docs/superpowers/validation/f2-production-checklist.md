# Checklist de produção — F2 Supabase

**Projeto:** `xvivhukirpekjdcuxoss`  
**Última execução local:** 2026-08-21  
**Migration local mais recente:** `20260821160000_guard_pipeline_stage_activation.sql`

Não inclua neste documento emails reais, UUIDs, tokens, senhas ou chaves.

## Gate local

- [x] `supabase db reset --local` aplicou todas as migrations sem drift local.
- [x] `supabase test db`: 4 arquivos, 202 asserções, todas aprovadas.
- [x] `npm test -- --run`: 32 arquivos, 242 testes, todos aprovados.
- [x] `npm run typecheck` aprovado.
- [x] `npm run build` aprovado.
- [x] Edge Function: 12 testes, fmt, lint e check aprovados.
- [x] `supabase/config.toml` declara `invite-user` com `verify_jwt = true`.

## Publicação do backend

- [ ] O histórico remoto de migrations é idêntico ao histórico local.
- [ ] Todas as migrations até `20260821160000` foram aplicadas ao projeto remoto.
- [ ] Os tipos gerados do projeto remoto não apresentam drift em relação a `src/data/supabase/database.types.ts`.
- [ ] `invite-user` foi publicada sem `--no-verify-jwt`.
- [ ] A listagem remota confirma JWT habilitado para `invite-user`.
- [ ] Os advisors de segurança e performance não apresentam finding novo causado pela F2.
- [ ] Os secrets administrativos existem apenas no Supabase; nenhuma `service_role` está na Vercel ou no bundle.

## Bootstrap e autenticação

- [ ] A primeira administradora foi criada no Auth e associada ao papel `Admin` por uma proprietária do banco.
- [ ] A administradora entra com email e senha e chega à rota autorizada.
- [ ] Recuperação de senha envia o email sem revelar se uma conta existe.
- [ ] Logout encerra a sessão e rotas privadas redirecionam para `/login`.
- [ ] Uma administradora envia convite e a nova usuária recebe o fluxo de acesso.
- [ ] Uma usuária inativa ou sem perfil é desconectada e não acessa dados.

## Smoke — Admin

- [ ] Cria e edita um evento.
- [ ] Adiciona um serviço ao evento e vê contrato/lucro recalculados.
- [ ] Cria um lançamento e o vê no evento e no Financeiro.
- [ ] Anula o lançamento; ele some das leituras normais e mantém auditoria no banco.
- [ ] Cria lead e proposta, aceita a proposta e converte o lead uma única vez.
- [ ] Reordena etapas e não consegue inativar uma etapa com contato ativo.
- [ ] Convida uma usuária e altera papel/estado de perfis permitidos.

## Smoke — Comercial

- [ ] Entra e acessa CRM e Eventos.
- [ ] Cria lead, atividade e proposta.
- [ ] Lê serviços e preços dos eventos permitidos.
- [ ] Converte um lead com proposta aceita.
- [ ] Não acessa a rota Financeiro.
- [ ] Recebe negação ao consultar diretamente transações e views financeiras.
- [ ] Recebe negação ao executar RPCs de configurações, finanças ou convites.

## Evidências remotas

Preencher após a execução, sem dados pessoais:

- **Migration remota mais recente:** pendente
- **Versão/deploy da Edge Function:** pendente
- **Deploy do frontend validado:** pendente
- **Admin smoke:** pendente
- **Comercial smoke:** pendente
- **Findings dos advisors:** pendente
- **Observações:** conector Supabase MCP indisponível na sessão local de implementação; publicação remota ainda não executada.
