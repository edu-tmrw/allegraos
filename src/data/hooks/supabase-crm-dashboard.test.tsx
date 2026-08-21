import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

const { fromMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/data/supabase/client", () => ({
  supabase: { from: fromMock, rpc: rpcMock },
}));

import { useConvertLead, useCreateProposal } from "./use-crm";
import { useDashboardData } from "./use-dashboard";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  fromMock.mockReset();
  rpcMock.mockReset();
});

test("converts a lead through the atomic database RPC", async () => {
  rpcMock.mockResolvedValue({ data: "event-1", error: null });
  const { result } = renderHook(() => useConvertLead(), { wrapper });

  await act(async () => {
    await result.current.mutateAsync({
      contactId: "contact-1",
      proposalId: "proposal-1",
      eventName: "Evento",
      eventTypeId: "type-1",
      eventDate: "2026-10-10",
      eventTime: null,
    }).catch(() => undefined);
  });

  expect(rpcMock).toHaveBeenCalledWith("convert_lead", {
    p_contact_id: "contact-1",
    p_proposal_id: "proposal-1",
    p_event_name: "Evento",
    p_event_date: "2026-10-10",
  });
});

test("creates a proposal and its items through one database RPC", async () => {
  rpcMock.mockResolvedValue({ data: "proposal-1", error: null });
  const { result } = renderHook(() => useCreateProposal(), { wrapper });

  await act(async () => {
    await result.current.mutateAsync({
      contactId: "contact-1",
      sentDate: "2026-08-21",
      discountCents: 500,
      notes: null,
      items: [{ serviceId: "service-1", variantId: null, priceCents: 10_000 }],
    }).catch(() => undefined);
  });

  expect(rpcMock).toHaveBeenCalledWith("create_proposal_with_items", {
    p_contact_id: "contact-1",
    p_sent_date: "2026-08-21",
    p_discount_cents: 500,
    p_items: [{ service_id: "service-1", variant_id: null, price_cents: 10_000 }],
  });
});

test("loads dashboard financials from security-invoker views", async () => {
  renderHook(() => useDashboardData("year"), { wrapper });

  await waitFor(() => {
    expect(fromMock).toHaveBeenCalledWith("v_cash_position");
    expect(fromMock).toHaveBeenCalledWith("v_event_financials");
    expect(fromMock).toHaveBeenCalledWith("v_monthly_flow");
    expect(fromMock).toHaveBeenCalledWith("v_service_sales");
    expect(fromMock).toHaveBeenCalledWith("v_category_expenses");
  });
});
