# Checklist de produção — F2 Supabase

**Projeto:** `xvivhukirpekjdcuxoss`  
**Última execução local:** 2026-08-21  
**Migration local/remota mais recente:** `20260821104458_guard_pipeline_stage_activation.sql`

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

- [x] O histórico remoto de migrations é idêntico ao histórico local.
- [x] Todas as migrations até `20260821104458` foram aplicadas ao projeto remoto.
- [x] Os tipos gerados do projeto remoto são idênticos a `src/data/supabase/database.types.ts`.
- [x] `invite-user` foi publicada sem `--no-verify-jwt`.
- [x] A listagem remota confirma JWT habilitado para `invite-user`.
- [x] Os advisors foram revisados: os seis avisos de `SECURITY DEFINER` correspondem aos RPCs intencionalmente expostos, que revalidam permissões; índices ainda não usados são esperados em um projeto sem dados operacionais.
- [x] O repositório e o bundle não contêm `service_role`; a função usa somente o secret administrado pelo runtime Supabase.

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

- **Migration remota mais recente:** `20260821104458_guard_pipeline_stage_activation`
- **Versão/deploy da Edge Function:** `invite-user` v1, `ACTIVE`, `verify_jwt = true`
- **Deploy do frontend validado:** pendente
- **Admin smoke:** pendente
- **Comercial smoke:** pendente
- **Findings dos advisors:** seis avisos intencionais para RPCs `SECURITY DEFINER` autenticados; findings de performance limitados a índices ainda sem uso.
- **Observações:** migrations e Edge Function publicadas pelo MCP Supabase em 2026-08-21. Smoke sem JWT retornou HTTP 401. O projeto Vercel não está vinculado a este workspace/conector, e o bootstrap/smoke com pessoas reais aguarda as identidades de Admin e Comercial.
