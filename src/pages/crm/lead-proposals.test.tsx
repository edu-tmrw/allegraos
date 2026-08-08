import { beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthProvider } from "@/data/auth";
import { crud, resetDB } from "@/data/store";
import { contractCents } from "@/domain/calc";
import { formatBRL, formatDate, todayISO } from "@/lib/format";
import { LeadPanel } from "@/pages/crm/lead-panel";

/** Collapses whitespace (incl. NBSP) so `formatBRL`'s output can be compared against rendered `textContent` — same helper as `service-items-editor.test.tsx`. */
function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function expectMoneyText(element: HTMLElement, cents: number): void {
  expect(normalizeSpace(element.textContent ?? "")).toContain(normalizeSpace(formatBRL(cents)));
}

/**
 * Renders the real `LeadPanel` (and therefore the real `LeadProposals`
 * section under test) behind the providers it needs, plus a real router
 * with a stub `/eventos/:id` route — the same technique `eventos.test.tsx`
 * uses to prove a post-mutation `navigate()` actually landed, without
 * needing the real event detail page.
 */
function renderLeadPanel(contactId: string, onOpenChange: (open: boolean) => void = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/crm"]}>
          <Routes>
            <Route path="/crm" element={<LeadPanel contactId={contactId} onOpenChange={onOpenChange} />} />
            <Route path="/eventos/:id" element={<div data-testid="evento-detalhe">Detalhe</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  resetDB(); // fresh seed relative to today — also clears store.ts's in-memory cache between tests
});

describe("LeadProposals — lista", () => {
  test("lists the lead's proposals sentDate desc, with the store-oracle total and status badge for each", async () => {
    // contact-patricia is seeded with exactly one proposal (proposal-patricia,
    // accepted). Add a second, more recently sent one via the store oracle —
    // this proves sentDate-desc ordering and a second badge variant
    // (Enviada) in the same render, without inventing a new seeded contact.
    const newer = crud("proposals").create({
      contactId: "contact-patricia",
      sentDate: todayISO(),
      status: "sent",
      discountCents: 0,
      notes: null,
    });
    crud("proposalServices").create({
      proposalId: newer.id,
      serviceId: "svc-foto-polaroid",
      variantId: null,
      priceCents: 120_000,
    });

    const seeded = crud("proposals").get("proposal-patricia")!;
    const seededItems = crud("proposalServices").list().filter((item) => item.proposalId === seeded.id);
    const seededTotal = contractCents(seededItems, seeded.discountCents);
    const newerTotal = contractCents([{ priceCents: 120_000 }], newer.discountCents);

    renderLeadPanel("contact-patricia");
    await screen.findByRole("heading", { name: "Patrícia Gomes" });

    // `useContactProposals` only starts fetching once this section itself
    // mounts (later than the panel's own pre-warmed `contact`/`eventTypes`
    // queries), so wait for the second (store-oracle) row to actually land
    // rather than assuming the heading alone proves everything settled.
    await screen.findByTestId(`proposal-${newer.id}`);

    const paragraphs = screen.getAllByText(/^Enviada em /);
    expect(paragraphs).toHaveLength(2);

    // Newer (sent today) sorts first; the seeded one (sent 10 days ago) second.
    const newerCard = screen.getByTestId(`proposal-${newer.id}`);
    const seededCard = screen.getByTestId(`proposal-${seeded.id}`);
    const cardsInOrder = paragraphs.map((el) => el.closest("[data-testid^='proposal-']"));
    expect(cardsInOrder[0]).toBe(newerCard);
    expect(cardsInOrder[1]).toBe(seededCard);

    expect(within(newerCard).getByText(`Enviada em ${formatDate(newer.sentDate)}`)).toBeInTheDocument();
    expect(within(newerCard).getByText("Enviada")).toBeInTheDocument();

    expect(within(seededCard).getByText(`Enviada em ${formatDate(seeded.sentDate)}`)).toBeInTheDocument();
    expect(within(seededCard).getByText("Aceita")).toBeInTheDocument();

    // Each row's total comes from its OWN `useProposalServices` call, one
    // more async tick behind the list itself (already awaited above) —
    // give both a chance to settle before checking the rendered amounts.
    await waitFor(() => {
      expectMoneyText(newerCard, newerTotal);
      expectMoneyText(seededCard, seededTotal);
    });
    expect(within(seededCard).getByText(seeded.notes!)).toBeInTheDocument();

    // Already-accepted proposals don't offer aceita/recusada actions.
    expect(within(seededCard).queryByRole("button", { name: "Marcar aceita" })).not.toBeInTheDocument();
    // The still-"sent" one does.
    expect(within(newerCard).getByRole("button", { name: "Marcar aceita" })).toBeInTheDocument();
  });
});

describe("LeadProposals — nova proposta", () => {
  test("adding Orquestra/Trio via the shared editor and submitting persists a new proposal and its item", async () => {
    const user = userEvent.setup();
    // contact-marcos already has one seeded ('sent') proposal — using it
    // keeps the header's "Nova proposta" button the only match on screen
    // (the empty-state's own CTA only renders when the lead has zero
    // proposals).
    const before = crud("proposals").list().filter((proposal) => proposal.contactId === "contact-marcos");
    expect(before).toHaveLength(1);

    renderLeadPanel("contact-marcos");
    await screen.findByRole("heading", { name: "Marcos Andrade" });

    // Wait for the seeded proposal row itself (not just the panel's
    // heading) so the list has actually loaded — otherwise both the
    // header's and the (momentarily-still-empty-state's) "Nova proposta"
    // buttons are on screen at once.
    await screen.findByTestId("proposal-proposal-marcos");

    await user.click(screen.getByRole("button", { name: "Nova proposta" }));
    await screen.findByRole("heading", { name: "Nova proposta" });

    await user.click(screen.getByRole("button", { name: "Adicionar serviço" }));
    await user.click(screen.getByRole("combobox", { name: "Serviço*" }));
    await user.click(await screen.findByRole("option", { name: "Orquestra" }));
    await user.click(await screen.findByRole("combobox", { name: "Variação*" }));
    await user.click(await screen.findByRole("option", { name: "Trio" }));
    await user.click(screen.getByRole("button", { name: "Adicionar" }));

    // The added row now shows in the dialog's own editor table.
    expect(await screen.findByText("Orquestra")).toBeInTheDocument();
    expect(screen.getByText("Trio")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Enviar proposta" }));

    await waitFor(() => {
      const after = crud("proposals").list().filter((proposal) => proposal.contactId === "contact-marcos");
      expect(after).toHaveLength(2);
    });

    const created = crud("proposals")
      .list()
      .find((proposal) => proposal.contactId === "contact-marcos" && proposal.id !== "proposal-marcos")!;
    expect(created.sentDate).toBe(todayISO());
    expect(created.discountCents).toBe(0);
    expect(created.status).toBe("sent");

    const createdItems = crud("proposalServices").list().filter((item) => item.proposalId === created.id);
    expect(createdItems).toHaveLength(1);
    expect(createdItems[0]).toMatchObject({
      serviceId: "svc-orquestra",
      variantId: "variant-orquestra-trio",
      priceCents: 350_000,
    });

    // The dialog closes on success.
    expect(screen.queryByRole("heading", { name: "Nova proposta" })).not.toBeInTheDocument();
  });
});

describe("LeadProposals — converter em evento", () => {
  test("converting the lead's accepted proposal creates the Evento with copied items/discount and navigates to it", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    expect(crud("events").list().some((event) => event.contactId === "contact-patricia")).toBe(false);

    renderLeadPanel("contact-patricia", onOpenChange);
    await screen.findByRole("heading", { name: "Patrícia Gomes" });

    // The button only appears once `useContactProposals` resolves and finds
    // the accepted proposal — `findByRole` (not `getByRole`) waits for that.
    await user.click(await screen.findByRole("button", { name: "Converter em evento" }));
    await screen.findByRole("heading", { name: "Converter em evento" });

    // Only one accepted proposal — auto-selected — and the name/tipo fields
    // prefill from the lead itself (Casamento / Patrícia Gomes).
    expect(screen.getByRole("combobox", { name: "Proposta*" })).toHaveTextContent("Enviada em");
    expect(screen.getByLabelText("Nome do evento*")).toHaveValue("Casamento Patrícia Gomes");
    expect(screen.getByRole("combobox", { name: "Tipo*" })).toHaveTextContent("Casamento");

    fireEvent.change(screen.getByLabelText("Data*"), { target: { value: "2026-12-05" } });
    await user.click(screen.getByRole("button", { name: "Converter" }));

    expect(await screen.findByTestId("evento-detalhe")).toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(false);

    const created = crud("events").list().find((event) => event.contactId === "contact-patricia")!;
    expect(created).toBeDefined();
    expect(created.name).toBe("Casamento Patrícia Gomes");
    expect(created.eventTypeId).toBe("type-casamento");
    expect(created.eventDate).toBe("2026-12-05");
    expect(created.eventTime).toBeNull();
    // Copied straight from proposal-patricia (see seed.ts).
    expect(created.discountCents).toBe(50_000);

    const createdServices = crud("eventServices").list().filter((item) => item.eventId === created.id);
    expect(createdServices).toHaveLength(3);
    expect(createdServices.map((item) => item.priceCents).sort((a, b) => a - b)).toEqual([180_000, 350_000, 800_000]);
    expect(createdServices.some((item) => item.variantId === "variant-orquestra-trio")).toBe(true);
  });

  test("the convert button is absent for a lead with no accepted proposal", async () => {
    // contact-marcos's only proposal is still 'sent' — never accepted.
    renderLeadPanel("contact-marcos");
    await screen.findByRole("heading", { name: "Marcos Andrade" });

    expect(screen.queryByRole("button", { name: "Converter em evento" })).not.toBeInTheDocument();
  });
});
