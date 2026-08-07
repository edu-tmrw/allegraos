/**
 * Realistic seed data for the AllegraOS mock store. Every date is computed
 * RELATIVE to `todayISO` (never hardcoded) so the seed stays coherent no
 * matter when it's generated — this is what `store.ts` calls the first time
 * `localStorage` is empty or corrupt, and what `resetDB()` calls to restore
 * the demo data.
 *
 * Ids are stable, readable strings — fine for seed data (only runtime
 * creates via `crud().create()` use `crypto.randomUUID()`).
 *
 * Money is always integer cents. Dates are "YYYY-MM-DD"; the narrative
 * spans roughly the last 9 months through a few months into the future:
 * 2 concluded events (paid off, with costs), 3 active events partially
 * paid (one ~15 days out with a scheduled time), 1 canceled event that
 * keeps its historical transactions, ~10 months of fixed costs so the
 * dashboard charts have something to show, 7 CRM leads across every
 * pipeline stage (one with an accepted proposal ready to convert, one
 * archived), and activities with a due-today and an overdue follow-up.
 */
import { addDays, addMonths, format, parseISO, setDate } from "date-fns";
import type {
  Activity,
  Contact,
  Evento,
  EventService,
  EventType,
  PipelineStage,
  Profile,
  Proposal,
  ProposalService,
  Role,
  Service,
  ServiceVariant,
  TeamMember,
  Transaction,
  TransactionCategory,
} from "@/domain/types";

/**
 * The whole mock database: one array per domain entity. This is the shape
 * persisted to `localStorage` and the shape every `crud()` call reads and
 * mutates — defined here (rather than in `domain/types.ts`) because it's a
 * store-level aggregate, not a domain entity itself.
 */
export interface MockDB {
  profiles: Profile[];
  roles: Role[];
  eventTypes: EventType[];
  services: Service[];
  serviceVariants: ServiceVariant[];
  transactionCategories: TransactionCategory[];
  pipelineStages: PipelineStage[];
  events: Evento[];
  eventServices: EventService[];
  transactions: Transaction[];
  teamMembers: TeamMember[];
  contacts: Contact[];
  proposals: Proposal[];
  proposalServices: ProposalService[];
  activities: Activity[];
}

export function buildSeed(todayISO: string): MockDB {
  const today = parseISO(todayISO);

  /** Date `offsetMonths` months from today, pinned to `day` (<=28, dodges month-length clipping). */
  const monthDateObj = (offsetMonths: number, day: number): Date =>
    setDate(addMonths(today, offsetMonths), day);
  const monthDate = (offsetMonths: number, day: number): string =>
    format(monthDateObj(offsetMonths, day), "yyyy-MM-dd");

  /** Date `offsetDays` days from today. */
  const dayDateObj = (offsetDays: number): Date => addDays(today, offsetDays);
  const dayDate = (offsetDays: number): string => format(dayDateObj(offsetDays), "yyyy-MM-dd");

  const roles: Role[] = [
    {
      id: "role-admin",
      name: "Admin",
      manageFinance: true,
      manageEvents: true,
      manageCrm: true,
      manageTeam: true,
      manageSettings: true,
    },
    {
      id: "role-comercial",
      name: "Comercial",
      manageFinance: false,
      manageEvents: false,
      manageCrm: true,
      manageTeam: false,
      manageSettings: false,
    },
  ];

  const profiles: Profile[] = [
    { userId: "profile-ana", name: "Ana Amaral", roleId: "role-admin", active: true },
    { userId: "profile-bia", name: "Bia Costa", roleId: "role-comercial", active: true },
  ];

  const eventTypes: EventType[] = [
    { id: "type-casamento", name: "Casamento", active: true },
    { id: "type-15-anos", name: "15 Anos", active: true },
    { id: "type-corporativo", name: "Corporativo", active: true },
  ];

  const services: Service[] = [
    { id: "svc-assessoria-premium", name: "Assessoria Premium", defaultPriceCents: 800_000, active: true },
    { id: "svc-assessoria-essencial", name: "Assessoria Essencial", defaultPriceCents: 450_000, active: true },
    { id: "svc-celebrante", name: "Celebrante e Mestre de Cerimônia", defaultPriceCents: 250_000, active: true },
    { id: "svc-storymaker", name: "Storymaker", defaultPriceCents: 180_000, active: true },
    { id: "svc-orquestra", name: "Orquestra", defaultPriceCents: null, active: true },
    { id: "svc-foto-polaroid", name: "Foto Polaroid", defaultPriceCents: 120_000, active: true },
    {
      id: "svc-carrinho-brigadeiro",
      name: "Carrinho Gourmet de Brigadeiro",
      defaultPriceCents: null,
      active: true,
    },
    { id: "svc-aluguel-som", name: "Aluguel de Som", defaultPriceCents: 150_000, active: true },
  ];

  const serviceVariants: ServiceVariant[] = [
    { id: "variant-orquestra-trio", serviceId: "svc-orquestra", name: "Trio", defaultPriceCents: 350_000, active: true },
    {
      id: "variant-orquestra-quarteto",
      serviceId: "svc-orquestra",
      name: "Quarteto",
      defaultPriceCents: 450_000,
      active: true,
    },
    {
      id: "variant-orquestra-sexteto",
      serviceId: "svc-orquestra",
      name: "Sexteto",
      defaultPriceCents: 650_000,
      active: true,
    },
    {
      id: "variant-carrinho-100",
      serviceId: "svc-carrinho-brigadeiro",
      name: "Até 100 convidados",
      defaultPriceCents: 90_000,
      active: true,
    },
    {
      id: "variant-carrinho-200",
      serviceId: "svc-carrinho-brigadeiro",
      name: "Até 200 convidados",
      defaultPriceCents: 140_000,
      active: true,
    },
  ];

  const transactionCategories: TransactionCategory[] = [
    { id: "cat-pagamento-contrato", name: "Pagamento de contrato", kind: "in", active: true },
    { id: "cat-outras-receitas", name: "Outras receitas", kind: "in", active: true },
    { id: "cat-gasolina", name: "Gasolina / Deslocamento", kind: "out", active: true },
    { id: "cat-freelancer", name: "Pagamento de freelancer", kind: "out", active: true },
    { id: "cat-sala", name: "Sala / Escritório", kind: "out", active: true },
    { id: "cat-equipamento", name: "Investimento em equipamento", kind: "out", active: true },
    { id: "cat-salario", name: "Salário fixo", kind: "out", active: true },
    { id: "cat-marketing", name: "Marketing / Instagram", kind: "out", active: true },
    { id: "cat-outras-saidas", name: "Outras saídas", kind: "out", active: true },
  ];

  const pipelineStages: PipelineStage[] = [
    { id: "stage-novo-contato", name: "Novo contato", position: 1, active: true },
    { id: "stage-em-conversa", name: "Em conversa", position: 2, active: true },
    { id: "stage-proposta-enviada", name: "Proposta enviada", position: 3, active: true },
    { id: "stage-negociacao", name: "Negociação", position: 4, active: true },
  ];

  const teamMembers: TeamMember[] = [
    {
      id: "team-bia",
      name: "Bia Costa",
      phone: "(31) 99811-0022",
      roleLabel: "Comercial",
      payNotes: "R$ 100 por venda",
      active: true,
    },
    {
      id: "team-carla",
      name: "Carla Mendes",
      phone: "(31) 98700-1234",
      roleLabel: "Social media",
      payNotes: "R$ 260/mês",
      active: true,
    },
    {
      id: "team-dudu",
      name: "Dudu Alves",
      phone: "(31) 99900-5566",
      roleLabel: "Freelancer cerimonial",
      payNotes: "R$ 150/diária",
      active: true,
    },
  ];

  // ---- Events (6): 2 concluded & paid off, 3 active partially paid (one
  // ~15 days out with a time), 1 canceled keeping its historical money. ----
  const events: Evento[] = [
    {
      id: "event-casamento-completo",
      name: "Casamento Beatriz & Thiago",
      eventTypeId: "type-casamento",
      eventDate: monthDate(-8, 15),
      eventTime: null,
      contactId: null,
      discountCents: 70_000,
      canceled: false,
      notes: null,
      createdAt: monthDateObj(-9, 20).toISOString(),
    },
    {
      id: "event-15anos-completo",
      name: "15 Anos de Helena Martins",
      eventTypeId: "type-15-anos",
      eventDate: monthDate(-3, 22),
      eventTime: null,
      contactId: null,
      discountCents: 20_000,
      canceled: false,
      notes: null,
      createdAt: monthDateObj(-4, 20).toISOString(),
    },
    {
      id: "event-casamento-proximo",
      name: "Casamento Patrícia & João",
      eventTypeId: "type-casamento",
      eventDate: dayDate(15),
      eventTime: "19:30",
      contactId: null,
      discountCents: 100_000,
      canceled: false,
      notes: "Cliente pediu atenção especial à decoração floral.",
      createdAt: monthDateObj(-2, 10).toISOString(),
    },
    {
      id: "event-corporativo-futuro",
      name: "Convenção Anual AllTech",
      eventTypeId: "type-corporativo",
      eventDate: monthDate(2, 10),
      eventTime: null,
      contactId: null,
      discountCents: 0,
      canceled: false,
      notes: null,
      createdAt: monthDateObj(-1, 5).toISOString(),
    },
    {
      id: "event-15anos-futuro",
      name: "15 Anos de Isabela Ferreira",
      eventTypeId: "type-15-anos",
      eventDate: monthDate(4, 5),
      eventTime: null,
      contactId: null,
      discountCents: 0,
      canceled: false,
      notes: null,
      createdAt: monthDateObj(-2, 15).toISOString(),
    },
    {
      id: "event-casamento-cancelado",
      name: "Casamento Camila & Pedro",
      eventTypeId: "type-casamento",
      eventDate: monthDate(1, 18),
      eventTime: null,
      contactId: null,
      discountCents: 0,
      canceled: true,
      notes: "Casal cancelou o casamento; taxa de cancelamento retida.",
      createdAt: monthDateObj(-6, 10).toISOString(),
    },
  ];

  const eventServices: EventService[] = [
    // Casamento Beatriz & Thiago — 1.520.000 - 70.000 desconto = 1.450.000
    es("es-cc-1", "event-casamento-completo", "svc-assessoria-premium", null, 800_000, events[0].createdAt),
    es("es-cc-2", "event-casamento-completo", "svc-orquestra", "variant-orquestra-quarteto", 450_000, events[0].createdAt),
    es("es-cc-3", "event-casamento-completo", "svc-foto-polaroid", null, 120_000, events[0].createdAt),
    es("es-cc-4", "event-casamento-completo", "svc-aluguel-som", null, 150_000, events[0].createdAt),

    // 15 Anos de Helena — 1.020.000 - 20.000 desconto = 1.000.000
    es("es-hm-1", "event-15anos-completo", "svc-assessoria-essencial", null, 450_000, events[1].createdAt),
    es("es-hm-2", "event-15anos-completo", "svc-celebrante", null, 250_000, events[1].createdAt),
    es("es-hm-3", "event-15anos-completo", "svc-carrinho-brigadeiro", "variant-carrinho-200", 140_000, events[1].createdAt),
    es("es-hm-4", "event-15anos-completo", "svc-storymaker", null, 180_000, events[1].createdAt),

    // Casamento Patrícia & João — 1.900.000 - 100.000 desconto = 1.800.000
    es("es-pj-1", "event-casamento-proximo", "svc-assessoria-premium", null, 800_000, events[2].createdAt),
    es("es-pj-2", "event-casamento-proximo", "svc-storymaker", null, 180_000, events[2].createdAt),
    es("es-pj-3", "event-casamento-proximo", "svc-orquestra", "variant-orquestra-sexteto", 650_000, events[2].createdAt),
    es("es-pj-4", "event-casamento-proximo", "svc-aluguel-som", null, 150_000, events[2].createdAt),
    es("es-pj-5", "event-casamento-proximo", "svc-foto-polaroid", null, 120_000, events[2].createdAt),

    // Convenção AllTech — 850.000, sem desconto
    es("es-at-1", "event-corporativo-futuro", "svc-assessoria-essencial", null, 450_000, events[3].createdAt),
    es("es-at-2", "event-corporativo-futuro", "svc-aluguel-som", null, 150_000, events[3].createdAt),
    es("es-at-3", "event-corporativo-futuro", "svc-celebrante", null, 250_000, events[3].createdAt),

    // 15 Anos de Isabela — 660.000, sem desconto
    es("es-if-1", "event-15anos-futuro", "svc-assessoria-essencial", null, 450_000, events[4].createdAt),
    es("es-if-2", "event-15anos-futuro", "svc-carrinho-brigadeiro", "variant-carrinho-100", 90_000, events[4].createdAt),
    es("es-if-3", "event-15anos-futuro", "svc-foto-polaroid", null, 120_000, events[4].createdAt),

    // Casamento Camila & Pedro (cancelado) — irrelevante ao saldo, mas mantém o item
    es("es-cp-1", "event-casamento-cancelado", "svc-assessoria-essencial", null, 450_000, events[5].createdAt),
  ];

  let txSeq = 0;
  function makeTx(
    at: Date,
    kind: "in" | "out",
    amountCents: number,
    categoryId: string,
    eventId: string | null,
    description: string,
  ): Transaction {
    txSeq += 1;
    return {
      id: `tx-${txSeq}`,
      kind,
      amountCents,
      date: format(at, "yyyy-MM-dd"),
      categoryId,
      eventId,
      description,
      createdBy: "profile-ana",
      createdAt: at.toISOString(),
    };
  }

  const transactions: Transaction[] = [
    // Casamento Beatriz & Thiago — pago em cheio (1.450.000) + custos
    makeTx(monthDateObj(-8, 20), "in", 600_000, "cat-pagamento-contrato", "event-casamento-completo", "1ª parcela"),
    makeTx(monthDateObj(-7, 12), "in", 500_000, "cat-pagamento-contrato", "event-casamento-completo", "2ª parcela"),
    makeTx(monthDateObj(-6, 5), "in", 350_000, "cat-pagamento-contrato", "event-casamento-completo", "Parcela final"),
    makeTx(monthDateObj(-8, 22), "out", 180_000, "cat-freelancer", "event-casamento-completo", "Cerimonial — Dudu Alves"),
    makeTx(monthDateObj(-8, 22), "out", 9_000, "cat-gasolina", "event-casamento-completo", "Deslocamento da equipe"),

    // 15 Anos de Helena — pago em cheio (1.000.000) + custos
    makeTx(monthDateObj(-3, 10), "in", 500_000, "cat-pagamento-contrato", "event-15anos-completo", "1ª parcela"),
    makeTx(monthDateObj(-2, 8), "in", 500_000, "cat-pagamento-contrato", "event-15anos-completo", "Parcela final"),
    makeTx(monthDateObj(-3, 24), "out", 120_000, "cat-freelancer", "event-15anos-completo", "Cerimonial — Dudu Alves"),
    makeTx(monthDateObj(-3, 24), "out", 7_000, "cat-gasolina", "event-15anos-completo", "Deslocamento da equipe"),

    // Casamento Patrícia & João — parcialmente pago (1.200.000 de 1.800.000)
    makeTx(monthDateObj(-1, 18), "in", 700_000, "cat-pagamento-contrato", "event-casamento-proximo", "Entrada"),
    makeTx(monthDateObj(0, 3), "in", 500_000, "cat-pagamento-contrato", "event-casamento-proximo", "2ª parcela"),
    makeTx(monthDateObj(-1, 20), "out", 6_000, "cat-gasolina", "event-casamento-proximo", "Visita técnica ao espaço"),
    makeTx(monthDateObj(0, 4), "out", 80_000, "cat-freelancer", "event-casamento-proximo", "Adiantamento cerimonial — Dudu Alves"),

    // Convenção AllTech — entrada (300.000 de 850.000)
    makeTx(monthDateObj(0, 6), "in", 300_000, "cat-pagamento-contrato", "event-corporativo-futuro", "Entrada"),

    // 15 Anos de Isabela — entrada (300.000 de 660.000)
    makeTx(monthDateObj(-1, 25), "in", 300_000, "cat-pagamento-contrato", "event-15anos-futuro", "Entrada"),

    // Casamento Camila & Pedro (cancelado) — histórico de dinheiro preservado
    makeTx(monthDateObj(-5, 15), "in", 200_000, "cat-pagamento-contrato", "event-casamento-cancelado", "Entrada"),
    makeTx(monthDateObj(-4, 2), "out", 130_000, "cat-outras-saidas", "event-casamento-cancelado", "Devolução parcial após cancelamento"),

    // Receitas avulsas (administração central)
    makeTx(monthDateObj(-9, 12), "in", 45_000, "cat-outras-receitas", null, "Locação de material para outro parceiro"),
    makeTx(monthDateObj(-6, 28), "in", 60_000, "cat-outras-receitas", null, "Comissão por indicação"),
    makeTx(monthDateObj(-4, 20), "in", 50_000, "cat-outras-receitas", null, "Comissão por indicação"),
    makeTx(monthDateObj(-2, 14), "in", 40_000, "cat-outras-receitas", null, "Venda de itens de decoração"),
  ];

  // Custos fixos mensais (Sala + Marketing/Instagram) nos últimos 10 meses,
  // incluindo o mês atual — para os gráficos do dashboard nascerem vivos.
  for (let i = 0; i <= 9; i++) {
    transactions.push(makeTx(monthDateObj(-i, 5), "out", 80_000, "cat-sala", null, "Aluguel da sala"));
    transactions.push(makeTx(monthDateObj(-i, 6), "out", 26_000, "cat-marketing", null, "Instagram Ads"));
  }

  // ---- CRM: 7 leads across every stage (1 accepted proposal ready to
  // convert, 1 archived), 3 proposals (sent/accepted/rejected), activities
  // with a due-today and an overdue follow-up. ----
  const contacts: Contact[] = [
    {
      id: "contact-fernanda",
      name: "Fernanda Lima",
      phone: "(31) 99811-2234",
      email: null,
      eventTypeId: null,
      stageId: "stage-novo-contato",
      archived: false,
      notes: "Chegou pelo Instagram, ainda não disse que tipo de evento é.",
      createdBy: "profile-bia",
      createdAt: dayDateObj(-3).toISOString(),
    },
    {
      id: "contact-rafael",
      name: "Rafael Souza",
      phone: "(31) 98722-4410",
      email: "rafael.souza@alltech.com.br",
      eventTypeId: "type-corporativo",
      stageId: "stage-em-conversa",
      archived: false,
      notes: null,
      createdBy: "profile-bia",
      createdAt: dayDateObj(-20).toISOString(),
    },
    {
      id: "contact-juliana",
      name: "Juliana Prado",
      phone: "(31) 99654-7788",
      email: "ju.prado@gmail.com",
      eventTypeId: "type-casamento",
      stageId: "stage-em-conversa",
      archived: false,
      notes: "Quer visitar o espaço em setembro.",
      createdBy: "profile-bia",
      createdAt: dayDateObj(-14).toISOString(),
    },
    {
      id: "contact-marcos",
      name: "Marcos Andrade",
      phone: "(31) 98877-1122",
      email: "marcos.andrade@gmail.com",
      eventTypeId: "type-15-anos",
      stageId: "stage-proposta-enviada",
      archived: false,
      notes: null,
      createdBy: "profile-bia",
      createdAt: dayDateObj(-25).toISOString(),
    },
    {
      id: "contact-patricia",
      name: "Patrícia Gomes",
      phone: "(31) 99123-5566",
      email: "patriciagomes@gmail.com",
      eventTypeId: "type-casamento",
      stageId: "stage-negociacao",
      archived: false,
      notes: "Proposta aceita — falta combinar data e horário do evento.",
      createdBy: "profile-bia",
      createdAt: dayDateObj(-30).toISOString(),
    },
    {
      id: "contact-lucas",
      name: "Lucas Tavares",
      phone: "(31) 98456-9900",
      email: null,
      eventTypeId: "type-corporativo",
      stageId: "stage-novo-contato",
      archived: true,
      notes: "Optou por outro fornecedor.",
      createdBy: "profile-bia",
      createdAt: dayDateObj(-60).toISOString(),
    },
    {
      id: "contact-beatriz",
      name: "Beatriz Nunes",
      phone: "(31) 99988-3345",
      email: "beatriz.nunes@hotmail.com",
      eventTypeId: "type-15-anos",
      stageId: "stage-em-conversa",
      archived: false,
      notes: null,
      createdBy: "profile-bia",
      createdAt: dayDateObj(-8).toISOString(),
    },
  ];

  const proposals: Proposal[] = [
    {
      id: "proposal-marcos",
      contactId: "contact-marcos",
      sentDate: dayDate(-6),
      status: "sent",
      discountCents: 0,
      notes: null,
      createdAt: dayDateObj(-6).toISOString(),
    },
    {
      id: "proposal-patricia",
      contactId: "contact-patricia",
      sentDate: dayDate(-10),
      status: "accepted",
      discountCents: 50_000,
      notes: "Cliente pediu desconto por indicação.",
      createdAt: dayDateObj(-10).toISOString(),
    },
    {
      id: "proposal-lucas",
      contactId: "contact-lucas",
      sentDate: dayDate(-55),
      status: "rejected",
      discountCents: 0,
      notes: "Optou por outro fornecedor.",
      createdAt: dayDateObj(-55).toISOString(),
    },
  ];

  const proposalServices: ProposalService[] = [
    { id: "ps-marcos-1", proposalId: "proposal-marcos", serviceId: "svc-assessoria-essencial", variantId: null, priceCents: 450_000 },
    { id: "ps-marcos-2", proposalId: "proposal-marcos", serviceId: "svc-celebrante", variantId: null, priceCents: 250_000 },

    // Pronta pra converter: 800.000 + 180.000 + 350.000 - 50.000 = 1.280.000
    { id: "ps-patricia-1", proposalId: "proposal-patricia", serviceId: "svc-assessoria-premium", variantId: null, priceCents: 800_000 },
    { id: "ps-patricia-2", proposalId: "proposal-patricia", serviceId: "svc-storymaker", variantId: null, priceCents: 180_000 },
    {
      id: "ps-patricia-3",
      proposalId: "proposal-patricia",
      serviceId: "svc-orquestra",
      variantId: "variant-orquestra-trio",
      priceCents: 350_000,
    },

    { id: "ps-lucas-1", proposalId: "proposal-lucas", serviceId: "svc-assessoria-essencial", variantId: null, priceCents: 450_000 },
  ];

  const activities: Activity[] = [
    {
      id: "act-fernanda-1",
      contactId: "contact-fernanda",
      content: "Contato recebido via Instagram, aguardando retorno sobre o tipo de evento.",
      dueDate: null,
      done: true,
      createdBy: "profile-bia",
      createdAt: dayDateObj(-3).toISOString(),
    },
    {
      id: "act-rafael-1",
      contactId: "contact-rafael",
      content: "Ligação inicial — cliente confirmou interesse em evento corporativo.",
      dueDate: null,
      done: true,
      createdBy: "profile-bia",
      createdAt: dayDateObj(-18).toISOString(),
    },
    {
      id: "act-juliana-1",
      contactId: "contact-juliana",
      content: "Retornar ligação sobre a visita ao espaço.",
      dueDate: dayDate(0), // segue de hoje
      done: false,
      createdBy: "profile-bia",
      createdAt: dayDateObj(-2).toISOString(),
    },
    {
      id: "act-marcos-1",
      contactId: "contact-marcos",
      content: "Confirmar recebimento da proposta enviada.",
      dueDate: dayDate(-3), // atrasado
      done: false,
      createdBy: "profile-bia",
      createdAt: dayDateObj(-6).toISOString(),
    },
    {
      id: "act-patricia-1",
      contactId: "contact-patricia",
      content: "Proposta aceita! Combinar data e horário para converter em evento.",
      dueDate: null,
      done: true,
      createdBy: "profile-bia",
      createdAt: dayDateObj(-9).toISOString(),
    },
    {
      id: "act-lucas-1",
      contactId: "contact-lucas",
      content: "Cliente optou por outro fornecedor — lead arquivado.",
      dueDate: null,
      done: true,
      createdBy: "profile-bia",
      createdAt: dayDateObj(-56).toISOString(),
    },
    {
      id: "act-beatriz-1",
      contactId: "contact-beatriz",
      content: "Enviar catálogo de serviços por e-mail.",
      dueDate: dayDate(5),
      done: false,
      createdBy: "profile-bia",
      createdAt: dayDateObj(-8).toISOString(),
    },
  ];

  return {
    profiles,
    roles,
    eventTypes,
    services,
    serviceVariants,
    transactionCategories,
    pipelineStages,
    events,
    eventServices,
    transactions,
    teamMembers,
    contacts,
    proposals,
    proposalServices,
    activities,
  };
}

function es(
  id: string,
  eventId: string,
  serviceId: string,
  variantId: string | null,
  priceCents: number,
  createdAt: string,
): EventService {
  return { id, eventId, serviceId, variantId, priceCents, createdAt };
}
