# Roteiro de homologação com a cliente — AllegraOS

**Objetivo:** validar, junto com a cliente, se os fluxos essenciais do AllegraOS atendem à operação real antes da entrega em produção.

**Duração estimada:** 60–90 minutos

**Ambiente:** usar a URL de homologação/produção. `localhost` serve apenas para validação interna.

**Data:** ____/____/________

**Responsável pela condução:** ______________________________

**Cliente:** ______________________________

## Como registrar o resultado

Marque cada cenário com uma das opções:

- `[x]` Aprovado — comportamento correto e aceito pela cliente.
- `[ ]` Pendente — cenário não executado.
- `[!]` Reprovado — houve erro ou o comportamento não atende à operação.

Para cada reprovação, registre:

- o passo executado;
- o resultado obtido;
- o resultado esperado;
- uma captura de tela, se possível;
- a severidade: `Bloqueante`, `Alta`, `Média` ou `Baixa`.

Use nomes iniciados por `[HML]` nos registros criados durante a sessão. Não use dados pessoais, contratos ou valores reais de clientes.

## Pré-condições

- [ ] A aplicação está publicada em uma URL acessível pela cliente.
- [ ] A versão publicada corresponde à `main` aprovada.
- [ ] O ambiente está conectado ao projeto Supabase correto.
- [ ] Existe uma conta Admin ativa.
- [ ] Existe uma conta Comercial ativa, diferente da conta Admin.
- [ ] Há acesso a uma caixa de email para testar recuperação de senha e convite.
- [ ] A cliente sabe que os registros com prefixo `[HML]` serão removidos ou arquivados após a homologação.

## 1. Acesso e sessão — Admin

- [ ] Abrir a aplicação sem estar autenticada. Resultado esperado: a tela de login é exibida.
- [ ] Informar credenciais inválidas. Resultado esperado: o acesso é negado sem revelar detalhes técnicos.
- [ ] Entrar com a conta Admin. Resultado esperado: o sistema abre a área autorizada e exibe o nome e o papel corretos.
- [ ] Atualizar a página em uma rota interna. Resultado esperado: a sessão permanece ativa e a mesma página volta a abrir.
- [ ] Abrir uma rota inexistente. Resultado esperado: o sistema exibe a página de não encontrado, sem tela branca.

**Observações:**

_______________________________________________________________________________

## 2. Evento completo — Admin

- [ ] Criar um evento chamado `[HML] Evento cliente` com data, horário, tipo e contato.
- [ ] Confirmar que o evento aparece na listagem e que os dados exibidos estão corretos.
- [ ] Abrir o detalhe do evento e editar pelo menos um campo. Resultado esperado: a alteração persiste após atualizar a página.
- [ ] Adicionar um serviço e, quando aplicável, uma variação do serviço.
- [ ] Confirmar que o valor contratado é recalculado corretamente.
- [ ] Adicionar ou consultar informações de equipe relacionadas ao evento, conforme o fluxo apresentado.
- [ ] Alterar o status do evento e confirmar que os filtros da listagem refletem a mudança.

**Evento criado:** __________________________________________

**Observações:**

_______________________________________________________________________________

## 3. Financeiro — Admin

- [ ] Criar uma entrada `[HML] Sinal evento` associada ao evento de homologação.
- [ ] Confirmar que a entrada aparece no detalhe do evento e no livro-razão do Financeiro.
- [ ] Criar uma saída `[HML] Custo evento` associada ao mesmo evento.
- [ ] Confirmar que totais, saldo, recebido, custos, lucro e valor a receber são coerentes.
- [ ] Filtrar os lançamentos por mês, tipo, categoria e evento.
- [ ] Atualizar a página. Resultado esperado: os lançamentos e filtros aplicáveis continuam consistentes.
- [ ] Anular um dos lançamentos de homologação. Resultado esperado: ele deixa de compor as leituras normais e não pode ser apagado fisicamente pela interface.
- [ ] Confirmar que Dashboard e Financeiro refletem a anulação.

**Valores usados no teste:** __________________________________________

**Observações:**

_______________________________________________________________________________

## 4. CRM, proposta e conversão — Admin

- [ ] Criar o lead `[HML] Lead cliente` no CRM.
- [ ] Mover o lead entre etapas do funil e atualizar a página. Resultado esperado: a posição persiste.
- [ ] Criar uma atividade de acompanhamento com data de vencimento.
- [ ] Criar uma proposta com pelo menos um serviço e um desconto.
- [ ] Marcar a proposta como aceita.
- [ ] Converter o lead em evento. Resultado esperado: apenas um evento é criado, com serviços e desconto da proposta.
- [ ] Tentar converter novamente. Resultado esperado: o sistema impede a duplicação.
- [ ] Confirmar o vínculo entre o contato, a proposta e o evento criado.

**Observações:**

_______________________________________________________________________________

## 5. Configurações e regras de integridade — Admin

- [ ] Criar ou editar um tipo de evento de homologação.
- [ ] Criar ou editar um serviço e sua variação de preço.
- [ ] Criar ou editar uma categoria financeira.
- [ ] Reordenar as etapas do funil e confirmar a nova ordem no CRM.
- [ ] Tentar inativar uma etapa que possui um contato ativo. Resultado esperado: a operação é bloqueada com uma mensagem compreensível.
- [ ] Mover o contato para outra etapa e repetir a inativação. Resultado esperado: a etapa vazia pode ser inativada.
- [ ] Reativar a etapa e confirmar que ela volta a ficar disponível.

**Observações:**

_______________________________________________________________________________

## 6. Convite e gestão de usuárias — Admin

- [ ] Enviar um convite para um endereço de email controlado pela equipe de teste.
- [ ] Confirmar que o email de convite foi recebido e não expõe chaves ou informações internas.
- [ ] Concluir o primeiro acesso da nova usuária.
- [ ] Alterar o papel da usuária e confirmar que o menu e as rotas permitidas mudam de acordo com o papel.
- [ ] Inativar a usuária. Resultado esperado: a sessão é encerrada e novos acessos são negados.
- [ ] Reativar a usuária somente se ela precisar permanecer no ambiente após o teste.

**Email de teste utilizado:** não registrar neste documento

**Observações:**

_______________________________________________________________________________

## 7. Permissões — Comercial

- [ ] Sair da conta Admin e entrar com a conta Comercial.
- [ ] Confirmar que CRM e Eventos aparecem e podem ser acessados.
- [ ] Criar o lead `[HML] Lead comercial`, uma atividade e uma proposta.
- [ ] Consultar os serviços e preços necessários ao atendimento comercial.
- [ ] Aceitar a proposta e converter o lead em evento.
- [ ] Confirmar que Financeiro, Dashboard financeiro, Equipe e Configurações não aparecem quando o papel não possui essas permissões.
- [ ] Tentar abrir `/financeiro` diretamente pela URL. Resultado esperado: o acesso é negado ou redirecionado; nenhum dado financeiro é exibido.
- [ ] Confirmar que a conta Comercial não consegue convidar usuárias nem alterar papéis.

**Observações:**

_______________________________________________________________________________

## 8. Recuperação de senha e logout

- [ ] Solicitar recuperação para uma conta existente. Resultado esperado: a interface apresenta uma resposta segura e o email é recebido.
- [ ] Solicitar recuperação para um endereço inexistente. Resultado esperado: a resposta não confirma se a conta existe.
- [ ] Concluir uma troca de senha, se o ambiente permitir o teste sem afetar uma conta real.
- [ ] Fazer logout. Resultado esperado: rotas internas voltam a redirecionar para `/login`.
- [ ] Usar o botão Voltar do navegador após o logout. Resultado esperado: dados privados não voltam a ser exibidos.

**Observações:**

_______________________________________________________________________________

## 9. Usabilidade e dispositivos

- [ ] Executar os fluxos principais em desktop.
- [ ] Abrir a aplicação em uma largura de celular ou em um aparelho real.
- [ ] Confirmar que navegação, formulários, diálogos e tabelas permanecem utilizáveis no mobile.
- [ ] Confirmar que valores monetários, datas e horários são exibidos no formato esperado pela cliente.
- [ ] Confirmar que estados vazios, carregamentos e mensagens de erro são compreensíveis.
- [ ] Confirmar que atualizar a página não produz tela branca nem perda de sessão.

**Observações:**

_______________________________________________________________________________

## 10. Limpeza após a homologação

- [ ] Listar todos os registros criados com prefixo `[HML]`.
- [ ] Definir com a cliente quais registros serão removidos, anulados ou mantidos como demonstração.
- [ ] Não apagar fisicamente lançamentos financeiros; usar a anulação prevista pelo sistema.
- [ ] Remover ou inativar contas temporárias de teste que não permanecerão no ambiente.
- [ ] Confirmar que nenhum dado real foi alterado acidentalmente.

## Critérios de aceite

A entrega pode ser aprovada quando:

- [ ] não existe finding `Bloqueante` ou `Alta` em aberto;
- [ ] login, evento, financeiro e CRM foram aprovados pela cliente;
- [ ] as permissões Admin e Comercial foram validadas;
- [ ] recuperação de senha, convite, inativação e logout foram aprovados;
- [ ] o frontend publicado foi validado, não apenas o ambiente local;
- [ ] os dados de homologação receberam o destino combinado;
- [ ] a cliente declarou o aceite abaixo.

## Findings

| ID | Cenário | Resultado obtido | Resultado esperado | Severidade | Responsável | Status |
|---|---|---|---|---|---|---|
| HML-001 |  |  |  |  |  |  |
| HML-002 |  |  |  |  |  |  |
| HML-003 |  |  |  |  |  |  |

## Aceite da cliente

**Resultado da sessão:** `[ ] Aprovado` `[ ] Aprovado com ressalvas` `[ ] Reprovado`

**Ressalvas e combinados:**

_______________________________________________________________________________

_______________________________________________________________________________

**Nome:** __________________________________________

**Data:** ____/____/________

**Confirmação do aceite:** __________________________________________
