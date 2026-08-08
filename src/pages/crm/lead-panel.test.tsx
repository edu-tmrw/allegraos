import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthProvider } from "@/data/auth";
import { crud, resetDB } from "@/data/store";
import { LeadPanel } from "@/pages/crm/lead-panel";

/** Every hook LeadPanel uses needs `QueryClientProvider`; mutations also need `useAuth()`'s `<AuthProvider>`. `useNavigate` needs a router. */
function renderLeadPanel(contactId: string | null, onOpenChange: (open: boolean) => void = () => {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <LeadPanel contactId={contactId} onOpenChange={onOpenChange} />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  resetDB(); // fresh seed relative to today — also clears store.ts's in-memory cache between tests
});

describe("LeadPanel — dados e timeline", () => {
  test("shows the seeded lead's data and its timeline newest-first", async () => {
    // contact-marcos already has one seeded activity (act-marcos-1, 6 days
    // ago). `crud().create()` always stamps createdAt = now, so this second
    // activity is unambiguously the newer of the two — the store-oracle
    // technique this brief calls for, used here to get a *deterministic*
    // two-row timeline out of a seed that only ever gives one row per lead.
    crud("activities").create({
      contactId: "contact-marcos",
      content: "Retornou o contato por WhatsApp.",
      dueDate: null,
      done: true,
      createdBy: "profile-ana",
    });

    renderLeadPanel("contact-marcos");

    expect(await screen.findByRole("heading", { name: "Marcos Andrade" })).toBeInTheDocument();

    expect(screen.getByLabelText("Nome")).toHaveValue("Marcos Andrade");
    expect(screen.getByLabelText("Telefone")).toHaveValue("(31) 98877-1122");
    expect(screen.getByLabelText("Email")).toHaveValue("marcos.andrade@gmail.com");
    expect(screen.getByRole("combobox", { name: "Interesse" })).toHaveTextContent("15 Anos");
    expect(screen.getByRole("combobox", { name: "Etapa" })).toHaveTextContent("Proposta enviada");

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Retornou o contato por WhatsApp.");
    expect(rows[1]).toHaveTextContent("Confirmar recebimento da proposta enviada.");
  });

  test("adding a note appends it to the top of the timeline and to the store", async () => {
    const user = userEvent.setup();
    renderLeadPanel("contact-fernanda");

    await screen.findByRole("heading", { name: "Fernanda Lima" });

    await user.type(screen.getByLabelText("Nova nota"), "Cliente pediu para retornar semana que vem.");
    await user.click(screen.getByRole("button", { name: "Anotar" }));

    const rows = await screen.findAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Cliente pediu para retornar semana que vem.");

    const stored = crud("activities")
      .list()
      .filter((activity) => activity.contactId === "contact-fernanda");
    expect(stored).toHaveLength(2);
    expect(stored.some((activity) => activity.content === "Cliente pediu para retornar semana que vem.")).toBe(true);
  });
});

describe("LeadPanel — GANHO e arquivado", () => {
  test("a lead with a linked event shows the GANHO badge; an archived lead renders read-only", async () => {
    // No seeded contact has converted yet (every seeded event's contactId is
    // null) — link one via the test-only store oracle, exactly as the brief
    // calls for.
    crud("events").create({
      name: "Casamento Patrícia & João",
      eventTypeId: "type-casamento",
      eventDate: "2026-12-05",
      eventTime: null,
      contactId: "contact-patricia",
      discountCents: 0,
      canceled: false,
      notes: null,
    });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    const first = renderLeadPanel("contact-patricia", onOpenChange);

    expect(await screen.findByTestId("ganho-badge")).toHaveTextContent("GANHO");
    await user.click(screen.getByRole("button", { name: "Ver evento" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // contact-lucas is seeded already archived — unmount first so this
    // second, independent render doesn't leave two panels in the DOM at
    // once (which would make every `getByLabelText` below ambiguous).
    first.unmount();
    renderLeadPanel("contact-lucas");

    expect(await screen.findByRole("heading", { name: "Lucas Tavares" })).toBeInTheDocument();
    expect(screen.getByText("Arquivado")).toBeInTheDocument();

    expect(screen.getByLabelText("Nome")).toBeDisabled();
    expect(screen.getByLabelText("Telefone")).toBeDisabled();
    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Interesse" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Etapa" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();

    expect(screen.getByRole("button", { name: "Desarquivar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Arquivar" })).not.toBeInTheDocument();
  });
});
