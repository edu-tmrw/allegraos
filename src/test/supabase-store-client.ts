/**
 * Supabase test double backed by the legacy deterministic seed.
 *
 * Page tests exercise production hooks (PostgREST/RPC calls) while keeping
 * their fast, in-memory fixtures. This module is loaded only by Vitest.
 */
import {
  cashPositionCents,
  eventFinancials,
  monthlyFlow,
  serviceSalesRows,
} from "@/domain/calc";
import { convertLead, loadDB, saveDB } from "@/data/store";
import { todayISO } from "@/lib/format";

type Row = Record<string, unknown>;
type Filter = { column: string; operator: "eq" | "is" | "not-is" | "gte" | "lte" | "lt"; value: unknown };

const tableToStore = {
  profiles: "profiles",
  roles: "roles",
  event_types: "eventTypes",
  services: "services",
  service_variants: "serviceVariants",
  transaction_categories: "transactionCategories",
  pipeline_stages: "pipelineStages",
  events: "events",
  event_services: "eventServices",
  transactions: "transactions",
  team_members: "teamMembers",
  contacts: "contacts",
  proposals: "proposals",
  proposal_services: "proposalServices",
  activities: "activities",
} as const;

type TableName = keyof typeof tableToStore;

const domainToColumn: Record<string, string> = {
  userId: "user_id",
  roleId: "role_id",
  manageFinance: "manage_finance",
  manageEvents: "manage_events",
  manageCrm: "manage_crm",
  manageTeam: "manage_team",
  manageSettings: "manage_settings",
  eventTypeId: "event_type_id",
  defaultPriceCents: "default_price_cents",
  serviceId: "service_id",
  roleLabel: "role_label",
  payNotes: "pay_notes",
  eventDate: "event_date",
  eventTime: "event_time",
  eventId: "event_id",
  contactId: "contact_id",
  discountCents: "discount_cents",
  createdAt: "created_at",
  variantId: "variant_id",
  priceCents: "price_cents",
  amountCents: "amount_cents",
  categoryId: "category_id",
  createdBy: "created_by",
  stageId: "stage_id",
  sentDate: "sent_date",
  proposalId: "proposal_id",
  dueDate: "due_date",
};

const columnToDomain = Object.fromEntries(
  Object.entries(domainToColumn).map(([domain, column]) => [column, domain]),
);

function toRow(value: Row): Row {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [domainToColumn[key] ?? key, item]),
  );
}

function toDomain(value: Row): Row {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [columnToDomain[key] ?? key, item]),
  );
}

function rowsForTable(table: TableName, select: string): Row[] {
  const db = loadDB();
  const values = db[tableToStore[table]] as unknown as Row[];
  return values.map((value) => {
    const row = toRow(value);
    if (table === "transactions") {
      row.deleted_at = null;
      row.deleted_by = null;
    }
    if (table === "profiles" && select.includes("role:")) {
      const role = db.roles.find((candidate) => candidate.id === value.roleId);
      row.role = role ? toRow(role as unknown as Row) : null;
    }
    return row;
  });
}

function viewRows(table: string): Row[] {
  const db = loadDB();
  if (table === "v_cash_position") {
    return [{ cash_cents: cashPositionCents(db.transactions) }];
  }
  if (table === "v_event_financials") {
    return db.events.map((event) => {
      const amounts = eventFinancials(
        event,
        db.eventServices.filter((item) => item.eventId === event.id),
        db.transactions,
      );
      return {
        event_id: event.id,
        contract_cents: amounts.contractCents,
        received_cents: amounts.receivedCents,
        cost_cents: amounts.costCents,
        profit_cents: amounts.profitCents,
        receivable_cents: amounts.receivableCents,
      };
    });
  }
  if (table === "v_monthly_flow") {
    return monthlyFlow(db.transactions, 36, todayISO()).map((row) => ({
      month: `${row.month}-01`,
      revenue_cents: row.revenueCents,
      expenses_cents: row.expensesCents,
      profit_cents: row.profitCents,
    }));
  }
  if (table === "v_service_sales") {
    const nameById = new Map(db.services.map((service) => [service.id, service.name]));
    return serviceSalesRows(db.events, db.eventServices).map((row, index) => ({
      event_service_id: `sale-${index}`,
      event_id: null,
      service_id: row.serviceId,
      service_name: nameById.get(row.serviceId) ?? "",
      price_cents: row.priceCents,
      closed_at: row.soldAt,
    }));
  }
  if (table === "v_category_expenses") {
    const nameById = new Map(db.transactionCategories.map((category) => [category.id, category.name]));
    return db.transactions.filter((transaction) => transaction.kind === "out").map((transaction) => ({
      category_id: transaction.categoryId,
      category_name: nameById.get(transaction.categoryId) ?? "",
      date: transaction.date,
      total_cents: transaction.amountCents,
    }));
  }
  return [];
}

function matches(row: Row, filter: Filter): boolean {
  const current = row[filter.column];
  if (filter.operator === "eq") return current === filter.value;
  if (filter.operator === "is") return current === filter.value;
  if (filter.operator === "not-is") return current !== filter.value;
  if (typeof current !== "string" || typeof filter.value !== "string") return false;
  if (filter.operator === "gte") return current >= filter.value;
  if (filter.operator === "lt") return current < filter.value;
  return current <= filter.value;
}

function idColumn(table: TableName): string {
  return table === "profiles" ? "user_id" : "id";
}

function generatedRecord(table: TableName, payload: Row): Row {
  const domain = toDomain(payload);
  if (domain[idColumn(table) === "user_id" ? "userId" : "id"] === undefined) {
    domain[idColumn(table) === "user_id" ? "userId" : "id"] = crypto.randomUUID();
  }
  if (["events", "event_services", "transactions", "contacts", "proposals", "activities"].includes(table)) {
    domain.createdAt ??= new Date().toISOString();
  }
  if (["transactions", "contacts", "activities"].includes(table)) domain.createdBy ??= "profile-ana";
  if (table === "profiles") domain.active ??= true;
  if (table === "proposals") domain.status ??= "sent";
  return domain;
}

class StoreQuery implements PromiseLike<{ data: unknown; error: null }> {
  private operation: "select" | "insert" | "update" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private selection = "*";
  private filters: Filter[] = [];
  private orders: { column: string; ascending: boolean; nullsFirst: boolean }[] = [];
  private rowLimit: number | undefined;

  constructor(private readonly table: string) {}

  select(columns = "*") { this.selection = columns; return this; }
  insert(payload: Row | Row[]) { this.operation = "insert"; this.payload = payload; return this; }
  update(payload: Row) { this.operation = "update"; this.payload = payload; return this; }
  delete() { this.operation = "delete"; return this; }
  eq(column: string, value: unknown) { this.filters.push({ column, operator: "eq", value }); return this; }
  is(column: string, value: unknown) { this.filters.push({ column, operator: "is", value }); return this; }
  not(column: string, operator: string, value: unknown) {
    if (operator === "is") this.filters.push({ column, operator: "not-is", value });
    return this;
  }
  gte(column: string, value: string) { this.filters.push({ column, operator: "gte", value }); return this; }
  lte(column: string, value: string) { this.filters.push({ column, operator: "lte", value }); return this; }
  lt(column: string, value: string) { this.filters.push({ column, operator: "lt", value }); return this; }
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending ?? true, nullsFirst: options?.nullsFirst ?? false });
    return this;
  }
  limit(value: number) { this.rowLimit = value; return this; }

  async single() {
    const result = await this.execute();
    const rows = result.data as Row[];
    return { data: rows[0] ?? null, error: null };
  }

  async maybeSingle() {
    return await this.single();
  }

  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<{ data: unknown; error: null }> {
    if (!(this.table in tableToStore)) {
      return { data: this.filtered(viewRows(this.table)), error: null };
    }
    const table = this.table as TableName;
    if (this.operation === "select") {
      return { data: this.filtered(rowsForTable(table, this.selection)), error: null };
    }

    const db = loadDB();
    const key = tableToStore[table];
    const list = db[key] as unknown as Row[];
    if (this.operation === "insert") {
      const inserted = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((payload) => generatedRecord(table, payload ?? {}));
      list.push(...inserted);
      saveDB(db);
      return { data: inserted.map(toRow), error: null };
    }

    const matchingIndexes = list.flatMap((value, index) => {
      const row = toRow(value);
      return this.filters.every((filter) => matches(row, filter)) ? [index] : [];
    });
    if (this.operation === "delete") {
      for (const index of matchingIndexes.reverse()) list.splice(index, 1);
      saveDB(db);
      return { data: null, error: null };
    }

    const patch = toDomain((this.payload ?? {}) as Row);
    const updated = matchingIndexes.map((index) => {
      list[index] = { ...list[index], ...patch };
      return list[index];
    });
    saveDB(db);
    return { data: updated.map(toRow), error: null };
  }

  private filtered(input: Row[]): Row[] {
    let rows = input.filter((row) => this.filters.every((filter) => matches(row, filter)));
    if (this.orders.length) {
      rows = [...rows].sort((left, right) => {
        for (const order of this.orders) {
          const a = left[order.column];
          const b = right[order.column];
          if (a === b) continue;
          if (a === null) return order.nullsFirst ? -1 : 1;
          if (b === null) return order.nullsFirst ? 1 : -1;
          const comparison = String(a) < String(b) ? -1 : 1;
          return order.ascending ? comparison : -comparison;
        }
        return 0;
      });
    }
    return this.rowLimit === undefined ? rows : rows.slice(0, this.rowLimit);
  }
}

export function createSupabaseStoreClient() {
  const authListeners = new Set<(event: string, session: { user: { id: string } } | null) => void>();
  return {
    from(table: string) {
      return new StoreQuery(table);
    },
    async rpc(name: string, args: Row) {
      try {
        const db = loadDB();
        if (name === "void_transaction") {
          const id = String(args.p_transaction_id);
          const index = db.transactions.findIndex((transaction) => transaction.id === id);
          if (index < 0) throw new Error("Registro não encontrado.");
          db.transactions.splice(index, 1);
          saveDB(db);
          return { data: id, error: null };
        }
        if (name === "reorder_stages") {
          for (const [index, id] of (args.p_ordered_ids as string[]).entries()) {
            const stage = db.pipelineStages.find((candidate) => candidate.id === id);
            if (stage) stage.position = index + 1;
          }
          saveDB(db);
          return { data: null, error: null };
        }
        if (name === "set_pipeline_stage_active") {
          const stage = db.pipelineStages.find((candidate) => candidate.id === args.p_stage_id);
          if (!stage) throw new Error("Etapa não encontrada.");
          if (args.p_active === false && db.contacts.some((contact) => contact.stageId === stage.id && !contact.archived)) {
            throw new Error("Mova os leads desta etapa antes de inativá-la");
          }
          stage.active = Boolean(args.p_active);
          saveDB(db);
          return { data: toRow(stage as unknown as Row), error: null };
        }
        if (name === "create_proposal_with_items") {
          const proposal = generatedRecord("proposals", {
            contact_id: args.p_contact_id,
            sent_date: args.p_sent_date,
            discount_cents: args.p_discount_cents,
            notes: args.p_notes ?? null,
            status: "sent",
          });
          db.proposals.push(proposal as unknown as (typeof db.proposals)[number]);
          for (const item of args.p_items as Row[]) {
            const service = generatedRecord("proposal_services", { ...item, proposal_id: proposal.id });
            db.proposalServices.push(service as unknown as (typeof db.proposalServices)[number]);
          }
          saveDB(db);
          return { data: proposal.id, error: null };
        }
        if (name === "convert_lead") {
          const contact = db.contacts.find((candidate) => candidate.id === args.p_contact_id);
          const event = convertLead({
            contactId: String(args.p_contact_id),
            proposalId: String(args.p_proposal_id),
            eventName: String(args.p_event_name),
            eventTypeId: contact?.eventTypeId ?? "",
            eventDate: String(args.p_event_date),
            eventTime: typeof args.p_event_time === "string" ? args.p_event_time : null,
          });
          return { data: event.id, error: null };
        }
        return { data: null, error: null };
      } catch (error) {
        return { data: null, error: { code: "22023", message: error instanceof Error ? error.message : "Falha" } };
      }
    },
    auth: {
      onAuthStateChange(callback: (event: string, session: { user: { id: string } } | null) => void) {
        authListeners.add(callback);
        queueMicrotask(() => {
          const userId = localStorage.getItem("allegra-session");
          callback("INITIAL_SESSION", userId ? { user: { id: userId } } : null);
        });
        return { data: { subscription: { unsubscribe: () => authListeners.delete(callback) } } };
      },
      async signInWithPassword() { return { data: { session: null, user: null }, error: null }; },
      async resetPasswordForEmail() { return { data: {}, error: null }; },
      async signOut() {
        localStorage.removeItem("allegra-session");
        for (const listener of authListeners) listener("SIGNED_OUT", null);
        return { error: null };
      },
    },
    functions: {
      async invoke() { return { data: { userId: crypto.randomUUID() }, error: null }; },
    },
  };
}
