import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { AppShell } from "@/components/layout/app-shell";
import { defaultRouteFor, RequirePerm, useAuth } from "@/data/auth";
import { LoginPage } from "@/pages/login";
import { DashboardPage } from "@/pages/dashboard";
import { EventosPage } from "@/pages/eventos";
import { EventoDetalhePage } from "@/pages/eventos/detalhe";
import { FinanceiroPage } from "@/pages/financeiro";
import { CrmPage } from "@/pages/crm";
import { EquipePage } from "@/pages/equipe";
import { ConfiguracoesPage } from "@/pages/configuracoes";
import { NotFoundPage } from "@/pages/not-found";

/** `/` has no page of its own — land the user at the top of their role's world. */
function IndexRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? defaultRouteFor(user.role) : "/eventos"} replace />;
}

/**
 * The route table. Exported separately (rather than only as the
 * `createBrowserRouter` result below) so tests can drive it through a
 * `createMemoryRouter` without a real browser history.
 */
export const routes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <IndexRedirect /> },
      {
        path: "dashboard",
        element: (
          <RequirePerm perm="manageFinance">
            <DashboardPage />
          </RequirePerm>
        ),
      },
      { path: "eventos", element: <EventosPage /> },
      { path: "eventos/:id", element: <EventoDetalhePage /> },
      {
        path: "financeiro",
        element: (
          <RequirePerm perm="manageFinance">
            <FinanceiroPage />
          </RequirePerm>
        ),
      },
      {
        path: "crm",
        element: (
          <RequirePerm perm="manageCrm">
            <CrmPage />
          </RequirePerm>
        ),
      },
      {
        path: "equipe",
        element: (
          <RequirePerm perm="manageTeam">
            <EquipePage />
          </RequirePerm>
        ),
      },
      {
        path: "configuracoes",
        element: (
          <RequirePerm perm="manageSettings">
            <ConfiguracoesPage />
          </RequirePerm>
        ),
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export default createBrowserRouter(routes);
