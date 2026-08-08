import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/data/auth";
import router from "@/router";
import "./index.css";

/**
 * Generic fallback toast for any mutation error a component doesn't already
 * surface itself. Most writes in this app already call `toast.error(...)`
 * from their own `onError` — but that's passed to `.mutate()` at call time,
 * which `MutationCache` never sees (only a hook-level `useMutation({onError})`
 * would be visible here), so those hooks mark themselves with
 * `meta: { toastHandled: true }` and this skips them rather than doubling up.
 * Everything without that flag previously failed silently; this is the net.
 */
const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.toastHandled) return;
      toast.error(error.message);
    },
  }),
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
