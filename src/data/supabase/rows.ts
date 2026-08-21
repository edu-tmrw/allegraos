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
import type { Tables, TablesInsert, TablesUpdate } from "./database.types";

export function toRole(row: Tables<"roles">): Role {
  return {
    id: row.id,
    name: row.name,
    manageFinance: row.manage_finance,
    manageEvents: row.manage_events,
    manageCrm: row.manage_crm,
    manageTeam: row.manage_team,
    manageSettings: row.manage_settings,
  };
}

export function toRoleInsert(input: Omit<Role, "id">): TablesInsert<"roles"> {
  return {
    name: input.name,
    manage_finance: input.manageFinance,
    manage_events: input.manageEvents,
    manage_crm: input.manageCrm,
    manage_team: input.manageTeam,
    manage_settings: input.manageSettings,
  };
}

export function toRoleUpdate(patch: Partial<Role>): TablesUpdate<"roles"> {
  const payload: TablesUpdate<"roles"> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.manageFinance !== undefined) payload.manage_finance = patch.manageFinance;
  if (patch.manageEvents !== undefined) payload.manage_events = patch.manageEvents;
  if (patch.manageCrm !== undefined) payload.manage_crm = patch.manageCrm;
  if (patch.manageTeam !== undefined) payload.manage_team = patch.manageTeam;
  if (patch.manageSettings !== undefined) payload.manage_settings = patch.manageSettings;
  return payload;
}

export function toProfile(row: Tables<"profiles">): Profile {
  return { userId: row.user_id, name: row.name, roleId: row.role_id, active: row.active };
}

export function toProfileInsert(input: Profile): TablesInsert<"profiles"> {
  return { user_id: input.userId, name: input.name, role_id: input.roleId, active: input.active };
}

export function toProfileUpdate(patch: Partial<Profile>): TablesUpdate<"profiles"> {
  const payload: TablesUpdate<"profiles"> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.roleId !== undefined) payload.role_id = patch.roleId;
  if (patch.active !== undefined) payload.active = patch.active;
  return payload;
}

export function toEventType(row: Tables<"event_types">): EventType {
  return { id: row.id, name: row.name, active: row.active };
}

export function toEventTypeInsert(input: Omit<EventType, "id">): TablesInsert<"event_types"> {
  return { name: input.name, active: input.active };
}

export function toEventTypeUpdate(patch: Partial<EventType>): TablesUpdate<"event_types"> {
  const payload: TablesUpdate<"event_types"> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.active !== undefined) payload.active = patch.active;
  return payload;
}

export function toService(row: Tables<"services">): Service {
  return { id: row.id, name: row.name, defaultPriceCents: row.default_price_cents, active: row.active };
}

export function toServiceInsert(input: Omit<Service, "id">): TablesInsert<"services"> {
  return { name: input.name, default_price_cents: input.defaultPriceCents, active: input.active };
}

export function toServiceUpdate(patch: Partial<Service>): TablesUpdate<"services"> {
  const payload: TablesUpdate<"services"> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.defaultPriceCents !== undefined) payload.default_price_cents = patch.defaultPriceCents;
  if (patch.active !== undefined) payload.active = patch.active;
  return payload;
}

export function toServiceVariant(row: Tables<"service_variants">): ServiceVariant {
  return {
    id: row.id,
    serviceId: row.service_id,
    name: row.name,
    defaultPriceCents: row.default_price_cents,
    active: row.active,
  };
}

export function toServiceVariantInsert(input: Omit<ServiceVariant, "id">): TablesInsert<"service_variants"> {
  return {
    service_id: input.serviceId,
    name: input.name,
    default_price_cents: input.defaultPriceCents,
    active: input.active,
  };
}

export function toServiceVariantUpdate(patch: Partial<ServiceVariant>): TablesUpdate<"service_variants"> {
  const payload: TablesUpdate<"service_variants"> = {};
  if (patch.serviceId !== undefined) payload.service_id = patch.serviceId;
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.defaultPriceCents !== undefined) payload.default_price_cents = patch.defaultPriceCents;
  if (patch.active !== undefined) payload.active = patch.active;
  return payload;
}

export function toTransactionCategory(row: Tables<"transaction_categories">): TransactionCategory {
  return { id: row.id, name: row.name, kind: row.kind, active: row.active };
}

export function toTransactionCategoryInsert(
  input: Omit<TransactionCategory, "id">,
): TablesInsert<"transaction_categories"> {
  return { name: input.name, kind: input.kind, active: input.active };
}

export function toTransactionCategoryUpdate(
  patch: Partial<TransactionCategory>,
): TablesUpdate<"transaction_categories"> {
  const payload: TablesUpdate<"transaction_categories"> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.kind !== undefined) payload.kind = patch.kind;
  if (patch.active !== undefined) payload.active = patch.active;
  return payload;
}

export function toPipelineStage(row: Tables<"pipeline_stages">): PipelineStage {
  return { id: row.id, name: row.name, position: row.position, active: row.active };
}

export function toPipelineStageInsert(input: Omit<PipelineStage, "id">): TablesInsert<"pipeline_stages"> {
  return { name: input.name, position: input.position, active: input.active };
}

export function toPipelineStageUpdate(patch: Partial<PipelineStage>): TablesUpdate<"pipeline_stages"> {
  const payload: TablesUpdate<"pipeline_stages"> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.position !== undefined) payload.position = patch.position;
  if (patch.active !== undefined) payload.active = patch.active;
  return payload;
}

function toMinutePrecision(value: string | null): string | null {
  return value === null ? null : value.slice(0, 5);
}

export function toEvento(row: Tables<"events">): Evento {
  return {
    id: row.id,
    name: row.name,
    eventTypeId: row.event_type_id,
    eventDate: row.event_date,
    eventTime: toMinutePrecision(row.event_time),
    contactId: row.contact_id,
    discountCents: row.discount_cents,
    canceled: row.canceled,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function toEventoInsert(input: Omit<Evento, "id" | "createdAt">): TablesInsert<"events"> {
  return {
    name: input.name,
    event_type_id: input.eventTypeId,
    event_date: input.eventDate,
    event_time: input.eventTime,
    contact_id: input.contactId,
    discount_cents: input.discountCents,
    canceled: input.canceled,
    notes: input.notes,
  };
}

export function toEventoUpdate(patch: Partial<Evento>): TablesUpdate<"events"> {
  const payload: TablesUpdate<"events"> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.eventTypeId !== undefined) payload.event_type_id = patch.eventTypeId;
  if (patch.eventDate !== undefined) payload.event_date = patch.eventDate;
  if (patch.eventTime !== undefined) payload.event_time = patch.eventTime;
  if (patch.contactId !== undefined) payload.contact_id = patch.contactId;
  if (patch.discountCents !== undefined) payload.discount_cents = patch.discountCents;
  if (patch.canceled !== undefined) payload.canceled = patch.canceled;
  if (patch.notes !== undefined) payload.notes = patch.notes;
  return payload;
}

export function toEventService(row: Tables<"event_services">): EventService {
  return {
    id: row.id,
    eventId: row.event_id,
    serviceId: row.service_id,
    variantId: row.variant_id,
    priceCents: row.price_cents,
    createdAt: row.created_at,
  };
}

export function toEventServiceInsert(
  input: Omit<EventService, "id" | "createdAt">,
): TablesInsert<"event_services"> {
  return {
    event_id: input.eventId,
    service_id: input.serviceId,
    variant_id: input.variantId,
    price_cents: input.priceCents,
  };
}

export function toEventServiceUpdate(patch: Partial<EventService>): TablesUpdate<"event_services"> {
  const payload: TablesUpdate<"event_services"> = {};
  if (patch.eventId !== undefined) payload.event_id = patch.eventId;
  if (patch.serviceId !== undefined) payload.service_id = patch.serviceId;
  if (patch.variantId !== undefined) payload.variant_id = patch.variantId;
  if (patch.priceCents !== undefined) payload.price_cents = patch.priceCents;
  return payload;
}

export function toTransaction(row: Tables<"transactions">): Transaction {
  return {
    id: row.id,
    kind: row.kind,
    amountCents: row.amount_cents,
    date: row.date,
    categoryId: row.category_id,
    eventId: row.event_id,
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function toTransactionInsert(
  input: Omit<Transaction, "id" | "createdBy" | "createdAt">,
): TablesInsert<"transactions"> {
  return {
    kind: input.kind,
    amount_cents: input.amountCents,
    date: input.date,
    category_id: input.categoryId,
    event_id: input.eventId,
    description: input.description,
  };
}

export function toTransactionUpdate(patch: Partial<Transaction>): TablesUpdate<"transactions"> {
  const payload: TablesUpdate<"transactions"> = {};
  if (patch.kind !== undefined) payload.kind = patch.kind;
  if (patch.amountCents !== undefined) payload.amount_cents = patch.amountCents;
  if (patch.date !== undefined) payload.date = patch.date;
  if (patch.categoryId !== undefined) payload.category_id = patch.categoryId;
  if (patch.eventId !== undefined) payload.event_id = patch.eventId;
  if (patch.description !== undefined) payload.description = patch.description;
  return payload;
}

export function toTeamMember(row: Tables<"team_members">): TeamMember {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    roleLabel: row.role_label,
    payNotes: row.pay_notes,
    active: row.active,
  };
}

export function toTeamMemberInsert(input: Omit<TeamMember, "id">): TablesInsert<"team_members"> {
  return {
    name: input.name,
    phone: input.phone,
    role_label: input.roleLabel,
    pay_notes: input.payNotes,
    active: input.active,
  };
}

export function toTeamMemberUpdate(patch: Partial<TeamMember>): TablesUpdate<"team_members"> {
  const payload: TablesUpdate<"team_members"> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.phone !== undefined) payload.phone = patch.phone;
  if (patch.roleLabel !== undefined) payload.role_label = patch.roleLabel;
  if (patch.payNotes !== undefined) payload.pay_notes = patch.payNotes;
  if (patch.active !== undefined) payload.active = patch.active;
  return payload;
}

export function toContact(row: Tables<"contacts">): Contact {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    eventTypeId: row.event_type_id,
    stageId: row.stage_id,
    archived: row.archived,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function toContactInsert(
  input: Omit<Contact, "id" | "createdBy" | "createdAt">,
): TablesInsert<"contacts"> {
  return {
    name: input.name,
    phone: input.phone,
    email: input.email,
    event_type_id: input.eventTypeId,
    stage_id: input.stageId,
    archived: input.archived,
    notes: input.notes,
  };
}

export function toContactUpdate(patch: Partial<Contact>): TablesUpdate<"contacts"> {
  const payload: TablesUpdate<"contacts"> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.phone !== undefined) payload.phone = patch.phone;
  if (patch.email !== undefined) payload.email = patch.email;
  if (patch.eventTypeId !== undefined) payload.event_type_id = patch.eventTypeId;
  if (patch.stageId !== undefined) payload.stage_id = patch.stageId;
  if (patch.archived !== undefined) payload.archived = patch.archived;
  if (patch.notes !== undefined) payload.notes = patch.notes;
  return payload;
}

export function toProposal(row: Tables<"proposals">): Proposal {
  return {
    id: row.id,
    contactId: row.contact_id,
    sentDate: row.sent_date,
    status: row.status,
    discountCents: row.discount_cents,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function toProposalInsert(
  input: Omit<Proposal, "id" | "createdAt">,
): TablesInsert<"proposals"> {
  return {
    contact_id: input.contactId,
    sent_date: input.sentDate,
    status: input.status,
    discount_cents: input.discountCents,
    notes: input.notes,
  };
}

export function toProposalUpdate(patch: Partial<Proposal>): TablesUpdate<"proposals"> {
  const payload: TablesUpdate<"proposals"> = {};
  if (patch.contactId !== undefined) payload.contact_id = patch.contactId;
  if (patch.sentDate !== undefined) payload.sent_date = patch.sentDate;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.discountCents !== undefined) payload.discount_cents = patch.discountCents;
  if (patch.notes !== undefined) payload.notes = patch.notes;
  return payload;
}

export function toProposalService(row: Tables<"proposal_services">): ProposalService {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    serviceId: row.service_id,
    variantId: row.variant_id,
    priceCents: row.price_cents,
  };
}

export function toProposalServiceInsert(
  input: Omit<ProposalService, "id">,
): TablesInsert<"proposal_services"> {
  return {
    proposal_id: input.proposalId,
    service_id: input.serviceId,
    variant_id: input.variantId,
    price_cents: input.priceCents,
  };
}

export function toProposalServiceUpdate(
  patch: Partial<ProposalService>,
): TablesUpdate<"proposal_services"> {
  const payload: TablesUpdate<"proposal_services"> = {};
  if (patch.proposalId !== undefined) payload.proposal_id = patch.proposalId;
  if (patch.serviceId !== undefined) payload.service_id = patch.serviceId;
  if (patch.variantId !== undefined) payload.variant_id = patch.variantId;
  if (patch.priceCents !== undefined) payload.price_cents = patch.priceCents;
  return payload;
}

export function toActivity(row: Tables<"activities">): Activity {
  return {
    id: row.id,
    contactId: row.contact_id,
    content: row.content,
    dueDate: row.due_date,
    done: row.done,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function toActivityInsert(
  input: Omit<Activity, "id" | "createdBy" | "createdAt">,
): TablesInsert<"activities"> {
  return {
    contact_id: input.contactId,
    content: input.content,
    due_date: input.dueDate,
    done: input.done,
  };
}

export function toActivityUpdate(patch: Partial<Activity>): TablesUpdate<"activities"> {
  const payload: TablesUpdate<"activities"> = {};
  if (patch.contactId !== undefined) payload.contact_id = patch.contactId;
  if (patch.content !== undefined) payload.content = patch.content;
  if (patch.dueDate !== undefined) payload.due_date = patch.dueDate;
  if (patch.done !== undefined) payload.done = patch.done;
  return payload;
}
