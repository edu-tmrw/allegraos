import { expect, test } from "vitest";
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
import {
  toActivity,
  toActivityInsert,
  toActivityUpdate,
  toContact,
  toContactInsert,
  toContactUpdate,
  toEvento,
  toEventoInsert,
  toEventoUpdate,
  toEventService,
  toEventServiceInsert,
  toEventServiceUpdate,
  toEventType,
  toEventTypeInsert,
  toEventTypeUpdate,
  toPipelineStage,
  toPipelineStageInsert,
  toPipelineStageUpdate,
  toProfile,
  toProfileInsert,
  toProfileUpdate,
  toProposal,
  toProposalInsert,
  toProposalService,
  toProposalServiceInsert,
  toProposalServiceUpdate,
  toProposalUpdate,
  toRole,
  toRoleInsert,
  toRoleUpdate,
  toService,
  toServiceInsert,
  toServiceUpdate,
  toServiceVariant,
  toServiceVariantInsert,
  toServiceVariantUpdate,
  toTeamMember,
  toTeamMemberInsert,
  toTeamMemberUpdate,
  toTransaction,
  toTransactionCategory,
  toTransactionCategoryInsert,
  toTransactionCategoryUpdate,
  toTransactionInsert,
  toTransactionUpdate,
} from "./rows";

test("maps a database event into the UI domain without changing dates, times, cents or nulls", () => {
  expect(
    toEvento({
      id: "event-1",
      name: "Casamento",
      event_type_id: "type-1",
      event_date: "2026-10-10",
      event_time: null,
      contact_id: null,
      discount_cents: 2_500,
      canceled: false,
      notes: null,
      created_at: "2026-08-21T13:45:12.345678+00:00",
    }),
  ).toEqual({
    id: "event-1",
    name: "Casamento",
    eventTypeId: "type-1",
    eventDate: "2026-10-10",
    eventTime: null,
    contactId: null,
    discountCents: 2_500,
    canceled: false,
    notes: null,
    createdAt: "2026-08-21T13:45:12.345678+00:00",
  });
});

test("normalizes a PostgreSQL event time to the domain minute precision", () => {
  expect(
    toEvento({
      id: "event-time",
      name: "Evento noturno",
      event_type_id: "type-1",
      event_date: "2026-10-10",
      event_time: "19:30:00",
      contact_id: null,
      discount_cents: 0,
      canceled: false,
      notes: null,
      created_at: "2026-08-21T13:45:12.345678+00:00",
    }),
  ).toMatchObject({ eventTime: "19:30" });
});

test("builds exact event insert and sparse update payloads", () => {
  const event: Omit<Evento, "id" | "createdAt"> = {
    name: "Evento",
    eventTypeId: "type-1",
    eventDate: "2026-11-01",
    eventTime: "19:30",
    contactId: null,
    discountCents: 0,
    canceled: false,
    notes: null,
  };

  expect(toEventoInsert(event)).toEqual({
    name: "Evento",
    event_type_id: "type-1",
    event_date: "2026-11-01",
    event_time: "19:30",
    contact_id: null,
    discount_cents: 0,
    canceled: false,
    notes: null,
  });
  expect(toEventoUpdate({ eventTime: null, notes: null })).toEqual({ event_time: null, notes: null });
});

test("maps and builds event-service payloads while preserving a null variant", () => {
  const item: Omit<EventService, "id" | "createdAt"> = {
    eventId: "event-1",
    serviceId: "service-1",
    variantId: null,
    priceCents: 120_000,
  };

  expect(
    toEventService({ id: "item-1", event_id: "event-1", service_id: "service-1", variant_id: null, price_cents: 120_000, created_at: "ts" }),
  ).toEqual({ id: "item-1", ...item, createdAt: "ts" });
  expect(toEventServiceInsert(item)).toEqual({ event_id: "event-1", service_id: "service-1", variant_id: null, price_cents: 120_000 });
  expect(toEventServiceUpdate({ variantId: null, priceCents: 125_000 })).toEqual({ variant_id: null, price_cents: 125_000 });
});

test("maps a live transaction and excludes audit columns from write payloads", () => {
  const transaction: Transaction = {
    id: "tx-1",
    kind: "out",
    amountCents: 9_900,
    date: "2026-08-21",
    categoryId: "cat-1",
    eventId: null,
    description: null,
    createdBy: "user-1",
    createdAt: "2026-08-21T10:00:00+00:00",
  };

  expect(
    toTransaction({
      id: transaction.id,
      kind: transaction.kind,
      amount_cents: transaction.amountCents,
      date: transaction.date,
      category_id: transaction.categoryId,
      event_id: transaction.eventId,
      description: transaction.description,
      created_by: transaction.createdBy,
      created_at: transaction.createdAt,
      deleted_at: null,
      deleted_by: null,
    }),
  ).toEqual(transaction);
  expect(toTransactionInsert({ kind: "out", amountCents: 9_900, date: "2026-08-21", categoryId: "cat-1", eventId: null, description: null })).toEqual({
    kind: "out",
    amount_cents: 9_900,
    date: "2026-08-21",
    category_id: "cat-1",
    event_id: null,
    description: null,
  });
  expect(toTransactionUpdate({ eventId: null, description: null })).toEqual({ event_id: null, description: null });
});

test("maps and builds contact payloads without sending server-owned created_by", () => {
  const contact: Contact = {
    id: "contact-1",
    name: "Ana",
    phone: null,
    email: null,
    eventTypeId: null,
    stageId: "stage-1",
    archived: false,
    notes: null,
    createdBy: "user-1",
    createdAt: "ts",
  };

  expect(toContact({ id: "contact-1", name: "Ana", phone: null, email: null, event_type_id: null, stage_id: "stage-1", archived: false, notes: null, created_by: "user-1", created_at: "ts" })).toEqual(contact);
  expect(toContactInsert({ name: "Ana", phone: null, email: null, eventTypeId: null, stageId: "stage-1", archived: false, notes: null })).toEqual({ name: "Ana", phone: null, email: null, event_type_id: null, stage_id: "stage-1", archived: false, notes: null });
  expect(toContactUpdate({ eventTypeId: null, notes: null })).toEqual({ event_type_id: null, notes: null });
});

test("maps and builds proposal payloads while preserving notes null", () => {
  const proposal: Proposal = { id: "proposal-1", contactId: "contact-1", sentDate: "2026-08-21", status: "sent", discountCents: 500, notes: null, createdAt: "ts" };

  expect(toProposal({ id: "proposal-1", contact_id: "contact-1", sent_date: "2026-08-21", status: "sent", discount_cents: 500, notes: null, created_at: "ts" })).toEqual(proposal);
  expect(toProposalInsert({ contactId: "contact-1", sentDate: "2026-08-21", status: "sent", discountCents: 500, notes: null })).toEqual({ contact_id: "contact-1", sent_date: "2026-08-21", status: "sent", discount_cents: 500, notes: null });
  expect(toProposalUpdate({ status: "accepted", notes: null })).toEqual({ status: "accepted", notes: null });
});

test("maps and builds proposal-service payloads while preserving variant null", () => {
  const item: ProposalService = { id: "ps-1", proposalId: "proposal-1", serviceId: "service-1", variantId: null, priceCents: 20_000 };

  expect(toProposalService({ id: "ps-1", proposal_id: "proposal-1", service_id: "service-1", variant_id: null, price_cents: 20_000 })).toEqual(item);
  expect(toProposalServiceInsert({ proposalId: "proposal-1", serviceId: "service-1", variantId: null, priceCents: 20_000 })).toEqual({ proposal_id: "proposal-1", service_id: "service-1", variant_id: null, price_cents: 20_000 });
  expect(toProposalServiceUpdate({ variantId: null, priceCents: 25_000 })).toEqual({ variant_id: null, price_cents: 25_000 });
});

test("maps and builds activity payloads without sending server-owned created_by", () => {
  const activity: Activity = { id: "activity-1", contactId: "contact-1", content: "Retornar", dueDate: null, done: true, createdBy: "user-1", createdAt: "ts" };

  expect(toActivity({ id: "activity-1", contact_id: "contact-1", content: "Retornar", due_date: null, done: true, created_by: "user-1", created_at: "ts" })).toEqual(activity);
  expect(toActivityInsert({ contactId: "contact-1", content: "Retornar", dueDate: null, done: true })).toEqual({ contact_id: "contact-1", content: "Retornar", due_date: null, done: true });
  expect(toActivityUpdate({ dueDate: null, done: true })).toEqual({ due_date: null, done: true });
});

test("maps and builds profile payloads using user_id as the domain identity", () => {
  const profile: Profile = { userId: "user-1", name: "Ana", roleId: "role-1", active: true };

  expect(toProfile({ user_id: "user-1", name: "Ana", role_id: "role-1", active: true, created_at: "ts" })).toEqual(profile);
  expect(toProfileInsert(profile)).toEqual({ user_id: "user-1", name: "Ana", role_id: "role-1", active: true });
  expect(toProfileUpdate({ name: "Bia", active: false })).toEqual({ name: "Bia", active: false });
});

test("maps and builds role payloads", () => {
  const role: Role = { id: "role-1", name: "Admin", manageFinance: true, manageEvents: true, manageCrm: true, manageTeam: true, manageSettings: true };
  const { id: _id, ...roleInput } = role;

  expect(toRole({ id: "role-1", name: "Admin", manage_finance: true, manage_events: true, manage_crm: true, manage_team: true, manage_settings: true, created_at: "ts" })).toEqual(role);
  expect(toRoleInsert(roleInput)).toEqual({ name: "Admin", manage_finance: true, manage_events: true, manage_crm: true, manage_team: true, manage_settings: true });
  expect(toRoleUpdate({ manageFinance: false })).toEqual({ manage_finance: false });
});

test("maps and builds event-type payloads", () => {
  const value: EventType = { id: "type-1", name: "Casamento", active: true };
  expect(toEventType({ ...value, created_at: "ts" })).toEqual(value);
  expect(toEventTypeInsert({ name: value.name, active: value.active })).toEqual({ name: "Casamento", active: true });
  expect(toEventTypeUpdate({ active: false })).toEqual({ active: false });
});

test("maps and builds service payloads while preserving a variable-price null", () => {
  const value: Service = { id: "service-1", name: "Orquestra", defaultPriceCents: null, active: true };
  expect(toService({ id: value.id, name: value.name, default_price_cents: null, active: true, created_at: "ts" })).toEqual(value);
  expect(toServiceInsert({ name: value.name, defaultPriceCents: null, active: true })).toEqual({ name: "Orquestra", default_price_cents: null, active: true });
  expect(toServiceUpdate({ defaultPriceCents: null })).toEqual({ default_price_cents: null });
});

test("maps and builds service-variant payloads", () => {
  const value: ServiceVariant = { id: "variant-1", serviceId: "service-1", name: "Trio", defaultPriceCents: 300_000, active: true };
  expect(toServiceVariant({ id: value.id, service_id: value.serviceId, name: value.name, default_price_cents: value.defaultPriceCents, active: value.active, created_at: "ts" })).toEqual(value);
  expect(toServiceVariantInsert({ serviceId: value.serviceId, name: value.name, defaultPriceCents: value.defaultPriceCents, active: value.active })).toEqual({ service_id: "service-1", name: "Trio", default_price_cents: 300_000, active: true });
  expect(toServiceVariantUpdate({ serviceId: "service-2", active: false })).toEqual({ service_id: "service-2", active: false });
});

test("maps and builds transaction-category payloads", () => {
  const value: TransactionCategory = { id: "cat-1", name: "Receita", kind: "in", active: true };
  expect(toTransactionCategory({ ...value, created_at: "ts" })).toEqual(value);
  expect(toTransactionCategoryInsert({ name: value.name, kind: value.kind, active: value.active })).toEqual({ name: "Receita", kind: "in", active: true });
  expect(toTransactionCategoryUpdate({ kind: "out" })).toEqual({ kind: "out" });
});

test("maps and builds pipeline-stage payloads without changing position", () => {
  const value: PipelineStage = { id: "stage-1", name: "Novo", position: 1, active: true };
  expect(toPipelineStage({ ...value, created_at: "ts" })).toEqual(value);
  expect(toPipelineStageInsert({ name: value.name, position: value.position, active: value.active })).toEqual({ name: "Novo", position: 1, active: true });
  expect(toPipelineStageUpdate({ position: 2 })).toEqual({ position: 2 });
});

test("maps and builds team-member payloads while preserving nullable text", () => {
  const value: TeamMember = { id: "member-1", name: "Bia", phone: null, roleLabel: "Comercial", payNotes: null, active: true };
  expect(toTeamMember({ id: value.id, name: value.name, phone: null, role_label: value.roleLabel, pay_notes: null, active: true, created_at: "ts" })).toEqual(value);
  expect(toTeamMemberInsert({ name: value.name, phone: null, roleLabel: value.roleLabel, payNotes: null, active: true })).toEqual({ name: "Bia", phone: null, role_label: "Comercial", pay_notes: null, active: true });
  expect(toTeamMemberUpdate({ phone: null, payNotes: null })).toEqual({ phone: null, pay_notes: null });
});
