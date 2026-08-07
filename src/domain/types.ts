/**
 * Domain types for AllegraOS, mirroring the app's schema in camelCase.
 * All ids are strings. Money is always integer cents (never float). Dates
 * are "YYYY-MM-DD" strings, times are "HH:mm" strings — never a `Date`
 * object crosses this boundary. Everything here is a plain data shape;
 * derived values (status, contract, balances, profit, receivable) live in
 * `calc.ts`, never stored.
 */

export interface Role {
  id: string;
  name: string;
  manageFinance: boolean;
  manageEvents: boolean;
  manageCrm: boolean;
  manageTeam: boolean;
  manageSettings: boolean;
}

export interface Profile {
  userId: string;
  name: string;
  roleId: string;
  active: boolean;
}

export interface EventType {
  id: string;
  name: string;
  active: boolean;
}

export interface Service {
  id: string;
  name: string;
  /** null means the price varies by variant — see ServiceVariant. */
  defaultPriceCents: number | null;
  active: boolean;
}

export interface ServiceVariant {
  id: string;
  serviceId: string;
  name: string;
  defaultPriceCents: number;
  active: boolean;
}

export interface TransactionCategory {
  id: string;
  name: string;
  kind: "in" | "out";
  active: boolean;
}

export interface PipelineStage {
  id: string;
  name: string;
  position: number;
  active: boolean;
}

/**
 * Named `Evento` (not `Event`) to avoid colliding with the DOM `Event`
 * type.
 */
export interface Evento {
  id: string;
  name: string;
  eventTypeId: string;
  eventDate: string;
  eventTime: string | null;
  contactId: string | null;
  discountCents: number;
  canceled: boolean;
  notes: string | null;
  createdAt: string;
}

export interface EventService {
  id: string;
  eventId: string;
  serviceId: string;
  variantId: string | null;
  priceCents: number;
  createdAt: string;
}

export interface Transaction {
  id: string;
  kind: "in" | "out";
  amountCents: number;
  date: string;
  categoryId: string;
  eventId: string | null;
  description: string | null;
  createdBy: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  phone: string | null;
  roleLabel: string;
  payNotes: string | null;
  active: boolean;
}

export interface Contact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  eventTypeId: string | null;
  stageId: string;
  archived: boolean;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

export interface Proposal {
  id: string;
  contactId: string;
  sentDate: string;
  status: "sent" | "accepted" | "rejected";
  discountCents: number;
  notes: string | null;
  createdAt: string;
}

export interface ProposalService {
  id: string;
  proposalId: string;
  serviceId: string;
  variantId: string | null;
  priceCents: number;
}

export interface Activity {
  id: string;
  contactId: string;
  content: string;
  dueDate: string | null;
  done: boolean;
  createdBy: string;
  createdAt: string;
}
