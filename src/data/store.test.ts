import { beforeEach, describe, expect, test, vi } from "vitest";
import { cashPositionCents, monthlyFlow } from "@/domain/calc";
import { todayISO } from "@/lib/format";
import { canInactivateStage, convertLead, crud, loadDB, resetDB, saveDB } from "@/data/store";
import type { MockDB } from "@/data/seed";
import type { Contact, Proposal } from "@/domain/types";

const DB_KEY = "allegra-db-v1";

beforeEach(() => {
  localStorage.clear();
});

/** A MockDB with every resource defaulting to empty — override just what a test needs. */
function makeDB(overrides: Partial<MockDB> = {}): MockDB {
  return {
    profiles: [],
    roles: [],
    eventTypes: [],
    services: [],
    serviceVariants: [],
    transactionCategories: [],
    pipelineStages: [],
    events: [],
    eventServices: [],
    transactions: [],
    teamMembers: [],
    contacts: [],
    proposals: [],
    proposalServices: [],
    activities: [],
    ...overrides,
  };
}

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "contact-x",
    name: "Lead X",
    phone: null,
    email: null,
    eventTypeId: null,
    stageId: "stage-1",
    archived: false,
    notes: null,
    createdBy: "profile-ana",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: "proposal-x",
    contactId: "contact-x",
    sentDate: "2026-01-01",
    status: "accepted",
    discountCents: 20_000,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("loadDB", () => {
  test("seeds and persists when localStorage is empty", () => {
    const db = loadDB();

    expect(db.roles.length).toBeGreaterThan(0);
    expect(db.events.length).toBeGreaterThan(0);
    const stored = localStorage.getItem(DB_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).roles).toEqual(db.roles);
  });

  test("caches the same object reference across calls (in-memory singleton)", () => {
    const first = loadDB();
    const second = loadDB();
    expect(second).toBe(first);
  });

  test("reads existing data from storage instead of reseeding", async () => {
    vi.resetModules();
    const fresh = await import("@/data/store");
    const db = fresh.loadDB();
    db.roles.push({
      id: "role-test",
      name: "Teste",
      manageFinance: false,
      manageEvents: false,
      manageCrm: false,
      manageTeam: false,
      manageSettings: false,
    });
    fresh.saveDB(db);

    vi.resetModules();
    const reloaded = await import("@/data/store");
    const db2 = reloaded.loadDB();

    expect(db2.roles.some((r) => r.id === "role-test")).toBe(true);
  });

  test("corrupt JSON in storage triggers a clean reseed instead of throwing", async () => {
    localStorage.setItem(DB_KEY, "{not valid json");

    vi.resetModules();
    const fresh = await import("@/data/store");
    const db = fresh.loadDB();

    expect(db.roles.length).toBeGreaterThan(0);
    const stored = localStorage.getItem(DB_KEY);
    expect(() => JSON.parse(stored!)).not.toThrow();
  });
});

describe("saveDB / persistence roundtrip", () => {
  test("a mutation survives a simulated reload (fresh module import reading from storage)", async () => {
    vi.resetModules();
    const first = await import("@/data/store");
    const db = first.loadDB();
    const before = db.contacts.length;
    db.contacts.push({
      id: "contact-roundtrip-test",
      name: "Roundtrip Tester",
      phone: null,
      email: null,
      eventTypeId: null,
      stageId: db.pipelineStages[0].id,
      archived: false,
      notes: null,
      createdBy: db.profiles[0].userId,
      createdAt: new Date().toISOString(),
    });
    first.saveDB(db);

    vi.resetModules();
    const second = await import("@/data/store");
    const reloaded = second.loadDB();

    expect(reloaded.contacts.length).toBe(before + 1);
    expect(reloaded.contacts.some((c) => c.id === "contact-roundtrip-test")).toBe(true);
  });
});

describe("crud", () => {
  beforeEach(() => {
    resetDB();
  });

  test("list() returns deep copies — mutating the returned array/items leaves the store and localStorage untouched", () => {
    const created = crud("eventTypes").create({ name: "Chá de panela", active: true });

    const first = crud("eventTypes").list();
    expect(first.length).toBeGreaterThan(0);
    const target = first.find((t) => t.id === created.id)!;
    target.name = "MUTATED";
    first.push({ id: "injected", name: "Injected", active: true });

    const second = crud("eventTypes").list();
    expect(second.find((t) => t.id === created.id)?.name).toBe("Chá de panela");
    expect(second.some((t) => t.id === "injected")).toBe(false);

    const stored = JSON.parse(localStorage.getItem(DB_KEY)!);
    expect(stored.eventTypes.find((t: { id: string }) => t.id === created.id).name).toBe("Chá de panela");
    expect(stored.eventTypes.some((t: { id: string }) => t.id === "injected")).toBe(false);
  });

  test("create() fills id but not createdAt for an entity without a createdAt field", () => {
    const created = crud("eventTypes").create({ name: "Chá de bebê", active: true });

    expect(created.id).toBeTruthy();
    expect(created.name).toBe("Chá de bebê");
    expect("createdAt" in created).toBe(false);
    const stored = JSON.parse(localStorage.getItem(DB_KEY)!);
    expect(stored.eventTypes.some((t: { id: string }) => t.id === created.id)).toBe(true);
  });

  test("create() fills both id and createdAt for an entity with a createdAt field", () => {
    const created = crud("activities").create({
      contactId: "contact-any",
      content: "Nota de teste",
      dueDate: null,
      done: false,
      createdBy: "profile-ana",
    });

    expect(created.id).toBeTruthy();
    expect(created.createdAt).toBeTruthy();
    const stored = JSON.parse(localStorage.getItem(DB_KEY)!);
    expect(stored.activities.some((a: { id: string }) => a.id === created.id)).toBe(true);
  });

  test("create() on profiles requires the caller to supply userId (no auto id — it mirrors auth.users)", () => {
    const created = crud("profiles").create({
      userId: "profile-test",
      name: "Teste",
      roleId: "role-admin",
      active: true,
    });

    expect(created.userId).toBe("profile-test");
    const stored = JSON.parse(localStorage.getItem(DB_KEY)!);
    expect(stored.profiles.some((p: { userId: string }) => p.userId === "profile-test")).toBe(true);
  });

  test("get() finds a row by id and returns null when missing", () => {
    const created = crud("eventTypes").create({ name: "Formatura", active: true });

    expect(crud("eventTypes").get(created.id)).toEqual(created);
    expect(crud("eventTypes").get("does-not-exist")).toBeNull();
  });

  test("get() on profiles looks up by userId", () => {
    expect(crud("profiles").get("profile-ana")?.name).toBe("Gabi Lauria");
  });

  test("get() returns a deep copy — mutating the returned object leaves the store and localStorage untouched", () => {
    const created = crud("eventTypes").create({ name: "Chá de bebê 2", active: true });

    const fetched = crud("eventTypes").get(created.id)!;
    fetched.name = "MUTATED";

    expect(crud("eventTypes").get(created.id)?.name).toBe("Chá de bebê 2");
    const stored = JSON.parse(localStorage.getItem(DB_KEY)!);
    expect(stored.eventTypes.find((t: { id: string }) => t.id === created.id).name).toBe("Chá de bebê 2");
  });

  test("update() applies a partial patch, persists, and returns the updated row", () => {
    const created = crud("eventTypes").create({ name: "Batizado", active: true });

    const updated = crud("eventTypes").update(created.id, { active: false });

    expect(updated).toEqual({ ...created, active: false });
    const stored = JSON.parse(localStorage.getItem(DB_KEY)!);
    expect(stored.eventTypes.find((t: { id: string }) => t.id === created.id).active).toBe(false);
  });

  test("update() returns a deep copy — mutating the returned row leaves the store and localStorage untouched", () => {
    const created = crud("eventTypes").create({ name: "Batizado 2", active: true });

    const updated = crud("eventTypes").update(created.id, { active: false });
    updated.name = "MUTATED";

    expect(crud("eventTypes").get(created.id)?.name).toBe("Batizado 2");
    const stored = JSON.parse(localStorage.getItem(DB_KEY)!);
    const storedRow = stored.eventTypes.find((t: { id: string }) => t.id === created.id);
    expect(storedRow.name).toBe("Batizado 2");
    expect(storedRow.active).toBe(false);
  });

  test("update() of a missing id throws an Error with a pt-BR message", () => {
    expect(() => crud("eventTypes").update("does-not-exist", { active: false })).toThrow(Error);
    try {
      crud("eventTypes").update("does-not-exist", { active: false });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).toMatch(/não encontrado/i);
    }
  });

  test("remove() deletes the row and persists", () => {
    const created = crud("eventTypes").create({ name: "Descartável", active: true });

    crud("eventTypes").remove(created.id);

    expect(crud("eventTypes").get(created.id)).toBeNull();
    const stored = JSON.parse(localStorage.getItem(DB_KEY)!);
    expect(stored.eventTypes.some((t: { id: string }) => t.id === created.id)).toBe(false);
  });

  test("remove() of a missing id throws an Error with a pt-BR message", () => {
    expect(() => crud("eventTypes").remove("does-not-exist")).toThrow(/não encontrado/i);
  });
});

describe("resetDB", () => {
  test("discards stored data and re-seeds, persisting and replacing the singleton", () => {
    const db = loadDB();
    db.roles.push({
      id: "role-throwaway",
      name: "Throwaway",
      manageFinance: false,
      manageEvents: false,
      manageCrm: false,
      manageTeam: false,
      manageSettings: false,
    });
    saveDB(db);
    expect(loadDB().roles.some((r) => r.id === "role-throwaway")).toBe(true);

    const fresh = resetDB();

    expect(fresh.roles.some((r) => r.id === "role-throwaway")).toBe(false);
    expect(loadDB()).toBe(fresh);
    const stored = JSON.parse(localStorage.getItem(DB_KEY)!);
    expect(stored.roles.some((r: { id: string }) => r.id === "role-throwaway")).toBe(false);
  });
});

describe("convertLead", () => {
  function seedAcceptedProposal(proposalOverrides: Partial<Proposal> = {}) {
    saveDB(
      makeDB({
        contacts: [makeContact()],
        proposals: [makeProposal(proposalOverrides)],
        proposalServices: [
          { id: "ps-1", proposalId: "proposal-x", serviceId: "svc-1", variantId: null, priceCents: 100_000 },
          { id: "ps-2", proposalId: "proposal-x", serviceId: "svc-2", variantId: "variant-1", priceCents: 50_000 },
        ],
      }),
    );
  }

  test("happy path: creates the event from the proposal's discount and copies each item", () => {
    seedAcceptedProposal();

    const result = convertLead({
      contactId: "contact-x",
      proposalId: "proposal-x",
      eventName: "Casamento Teste",
      eventTypeId: "type-casamento",
      eventDate: "2026-12-01",
      eventTime: "18:00",
    });

    expect(result).toMatchObject({
      name: "Casamento Teste",
      eventTypeId: "type-casamento",
      eventDate: "2026-12-01",
      eventTime: "18:00",
      contactId: "contact-x",
      discountCents: 20_000,
      canceled: false,
      notes: null,
    });
    expect(result.id).toBeTruthy();
    expect(result.createdAt).toBeTruthy();

    const db = loadDB();
    expect(db.events).toHaveLength(1);
    expect(db.events[0]).toEqual(result);

    const items = db.eventServices.filter((item) => item.eventId === result.id);
    expect(items.map(({ serviceId, variantId, priceCents }) => ({ serviceId, variantId, priceCents }))).toEqual([
      { serviceId: "svc-1", variantId: null, priceCents: 100_000 },
      { serviceId: "svc-2", variantId: "variant-1", priceCents: 50_000 },
    ]);
  });

  test("rejects when the proposal belongs to a different contact", () => {
    seedAcceptedProposal();

    expect(() =>
      convertLead({
        contactId: "contact-other",
        proposalId: "proposal-x",
        eventName: "X",
        eventTypeId: "type-x",
        eventDate: "2026-12-01",
        eventTime: null,
      }),
    ).toThrow(/não encontrada/i);
  });

  test("rejects when the proposal isn't accepted", () => {
    seedAcceptedProposal({ status: "sent" });

    expect(() =>
      convertLead({
        contactId: "contact-x",
        proposalId: "proposal-x",
        eventName: "X",
        eventTypeId: "type-x",
        eventDate: "2026-12-01",
        eventTime: null,
      }),
    ).toThrow(/aceita/i);
  });

  test("rejects when the contact has already been converted (already has an event)", () => {
    seedAcceptedProposal();
    const db = loadDB();
    db.events.push({
      id: "event-existing",
      name: "Já convertido antes",
      eventTypeId: "type-x",
      eventDate: "2026-01-01",
      eventTime: null,
      contactId: "contact-x",
      discountCents: 0,
      canceled: false,
      notes: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    saveDB(db);

    expect(() =>
      convertLead({
        contactId: "contact-x",
        proposalId: "proposal-x",
        eventName: "X",
        eventTypeId: "type-x",
        eventDate: "2026-12-01",
        eventTime: null,
      }),
    ).toThrow(/já foi convertido/i);
  });

  test("returns a deep copy — mutating the returned event leaves the store and localStorage untouched", () => {
    seedAcceptedProposal();

    const result = convertLead({
      contactId: "contact-x",
      proposalId: "proposal-x",
      eventName: "Casamento Teste",
      eventTypeId: "type-casamento",
      eventDate: "2026-12-01",
      eventTime: "18:00",
    });

    // Mutate the returned object
    result.name = "hacked";

    // Verify via fresh read from crud
    const fetched = crud("events").get(result.id)!;
    expect(fetched.name).toBe("Casamento Teste");

    // Verify via raw localStorage
    const stored = JSON.parse(localStorage.getItem(DB_KEY)!);
    const storedEvent = stored.events.find((e: { id: string }) => e.id === result.id);
    expect(storedEvent.name).toBe("Casamento Teste");
  });
});

describe("canInactivateStage", () => {
  test("false when a non-archived contact sits on the stage", () => {
    saveDB(
      makeDB({
        contacts: [makeContact({ id: "c1", stageId: "stage-a", archived: false })],
      }),
    );

    expect(canInactivateStage("stage-a")).toBe(false);
  });

  test("true when the stage has no contacts at all", () => {
    saveDB(makeDB({ contacts: [] }));

    expect(canInactivateStage("stage-a")).toBe(true);
  });

  test("true when every contact on the stage is archived", () => {
    saveDB(
      makeDB({
        contacts: [
          makeContact({ id: "c1", stageId: "stage-a", archived: true }),
          makeContact({ id: "c2", stageId: "stage-a", archived: true }),
        ],
      }),
    );

    expect(canInactivateStage("stage-a")).toBe(true);
  });

  test("true when non-archived contacts exist but on a different stage", () => {
    saveDB(
      makeDB({
        contacts: [makeContact({ id: "c1", stageId: "stage-b", archived: false })],
      }),
    );

    expect(canInactivateStage("stage-a")).toBe(true);
  });
});

describe("seed referential integrity", () => {
  // Fresh resetDB() per test (not a shared collection-time snapshot): the
  // last test in this block calls convertLead, which mutates the live
  // singleton — every test must see its own isolated copy of the seed.
  let db: MockDB;
  let roleIds: Set<string>;
  let eventTypeIds: Set<string>;
  let serviceIds: Set<string>;
  let variantIds: Set<string>;
  let variantServiceId: Map<string, string>;
  let categoryIds: Set<string>;
  let stageIds: Set<string>;
  let eventIds: Set<string>;
  let contactIds: Set<string>;
  let proposalIds: Set<string>;
  let profileIds: Set<string>;

  beforeEach(() => {
    db = resetDB();
    roleIds = new Set(db.roles.map((r) => r.id));
    eventTypeIds = new Set(db.eventTypes.map((t) => t.id));
    serviceIds = new Set(db.services.map((s) => s.id));
    variantIds = new Set(db.serviceVariants.map((v) => v.id));
    variantServiceId = new Map(db.serviceVariants.map((v) => [v.id, v.serviceId]));
    categoryIds = new Set(db.transactionCategories.map((c) => c.id));
    stageIds = new Set(db.pipelineStages.map((s) => s.id));
    eventIds = new Set(db.events.map((e) => e.id));
    contactIds = new Set(db.contacts.map((c) => c.id));
    proposalIds = new Set(db.proposals.map((p) => p.id));
    profileIds = new Set(db.profiles.map((p) => p.userId));
  });

  test("every profile.roleId resolves to an existing role", () => {
    for (const profile of db.profiles) {
      expect(roleIds.has(profile.roleId)).toBe(true);
    }
  });

  test("every eventTypeId (events, contacts) resolves when set", () => {
    for (const event of db.events) {
      expect(eventTypeIds.has(event.eventTypeId)).toBe(true);
    }
    for (const contact of db.contacts) {
      if (contact.eventTypeId !== null) expect(eventTypeIds.has(contact.eventTypeId)).toBe(true);
    }
  });

  test("every serviceId (eventServices, proposalServices) resolves", () => {
    for (const item of db.eventServices) {
      expect(serviceIds.has(item.serviceId)).toBe(true);
    }
    for (const item of db.proposalServices) {
      expect(serviceIds.has(item.serviceId)).toBe(true);
    }
  });

  test("every variantId, when set, resolves and belongs to its item's serviceId", () => {
    for (const item of db.eventServices) {
      if (item.variantId === null) continue;
      expect(variantIds.has(item.variantId)).toBe(true);
      expect(variantServiceId.get(item.variantId)).toBe(item.serviceId);
    }
    for (const item of db.proposalServices) {
      if (item.variantId === null) continue;
      expect(variantIds.has(item.variantId)).toBe(true);
      expect(variantServiceId.get(item.variantId)).toBe(item.serviceId);
    }
  });

  test("every transaction.categoryId resolves to an existing category", () => {
    for (const tx of db.transactions) {
      expect(categoryIds.has(tx.categoryId)).toBe(true);
    }
  });

  test("every contact.stageId resolves to an existing pipeline stage", () => {
    for (const contact of db.contacts) {
      expect(stageIds.has(contact.stageId)).toBe(true);
    }
  });

  test("every eventId (eventServices, transactions), when set, resolves", () => {
    for (const item of db.eventServices) {
      expect(eventIds.has(item.eventId)).toBe(true);
    }
    for (const tx of db.transactions) {
      if (tx.eventId !== null) expect(eventIds.has(tx.eventId)).toBe(true);
    }
  });

  test("every contactId (events, proposals, activities), when set, resolves", () => {
    for (const event of db.events) {
      if (event.contactId !== null) expect(contactIds.has(event.contactId)).toBe(true);
    }
    for (const proposal of db.proposals) {
      expect(contactIds.has(proposal.contactId)).toBe(true);
    }
    for (const activity of db.activities) {
      expect(contactIds.has(activity.contactId)).toBe(true);
    }
  });

  test("every proposalService.proposalId resolves to an existing proposal", () => {
    for (const item of db.proposalServices) {
      expect(proposalIds.has(item.proposalId)).toBe(true);
    }
  });

  test("every createdBy (transactions, contacts, activities) resolves to an existing profile", () => {
    for (const tx of db.transactions) {
      expect(profileIds.has(tx.createdBy)).toBe(true);
    }
    for (const contact of db.contacts) {
      expect(profileIds.has(contact.createdBy)).toBe(true);
    }
    for (const activity of db.activities) {
      expect(profileIds.has(activity.createdBy)).toBe(true);
    }
  });

  test("counts match the brief: 6 events, 7 contacts (1 archived), 3 proposals (one of each status)", () => {
    expect(db.events).toHaveLength(6);
    expect(db.contacts).toHaveLength(7);
    expect(db.contacts.filter((c) => c.archived)).toHaveLength(1);
    expect(db.proposals).toHaveLength(3);
    expect(db.proposals.filter((p) => p.status === "sent")).toHaveLength(1);
    expect(db.proposals.filter((p) => p.status === "accepted")).toHaveLength(1);
    expect(db.proposals.filter((p) => p.status === "rejected")).toHaveLength(1);
  });

  test("exactly one lead has an accepted proposal and no event yet — ready to convert", () => {
    const acceptedProposal = db.proposals.find((p) => p.status === "accepted")!;
    const leadHasNoEvent = !db.events.some((e) => e.contactId === acceptedProposal.contactId);
    expect(leadHasNoEvent).toBe(true);

    // and convertLead actually accepts it, end to end
    const result = convertLead({
      contactId: acceptedProposal.contactId,
      proposalId: acceptedProposal.id,
      eventName: "Conversão de teste",
      eventTypeId: "type-casamento",
      eventDate: "2027-01-01",
      eventTime: null,
    });
    expect(result.contactId).toBe(acceptedProposal.contactId);
  });

  test("activities include a due-today follow-up and an overdue follow-up", () => {
    const today = todayISO();
    const pending = db.activities.filter((a) => !a.done && a.dueDate !== null);
    expect(pending.some((a) => a.dueDate === today)).toBe(true);
    expect(pending.some((a) => a.dueDate! < today)).toBe(true);
  });
});

describe("dashboard liveness (money reality-check)", () => {
  test("cash position is positive and at least 8 of the last 12 months show revenue", () => {
    const db = resetDB();
    const today = todayISO();

    const cash = cashPositionCents(db.transactions);
    expect(cash).toBeGreaterThan(0);

    const months = monthlyFlow(db.transactions, 12, today);
    expect(months).toHaveLength(12);
    const monthsWithRevenue = months.filter((m) => m.revenueCents > 0);
    expect(monthsWithRevenue.length).toBeGreaterThanOrEqual(8);
  });
});
