import { useState } from "react";
import {
  CalendarHeart,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { NavLink, Navigate, Outlet, useNavigate, type NavLinkRenderProps } from "react-router";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/data/auth";
import { cn } from "@/lib/utils";
import type { Role } from "@/domain/types";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  show: (role: Role) => boolean;
}

/**
 * Sidebar order, verbatim from spec. The mobile bottom bar reuses every item
 * except Configurações (which always lives in the "Mais" sheet — see below).
 */
const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: (role) => role.manageFinance },
  { to: "/eventos", label: "Eventos", icon: CalendarHeart, show: () => true },
  { to: "/financeiro", label: "Financeiro", icon: Wallet, show: (role) => role.manageFinance },
  { to: "/crm", label: "CRM", icon: HeartHandshake, show: (role) => role.manageCrm },
  { to: "/equipe", label: "Equipe", icon: Users, show: (role) => role.manageTeam },
  { to: "/configuracoes", label: "Configurações", icon: Settings, show: (role) => role.manageSettings },
];

/** The bottom nav bar shows at most this many route items before overflowing into "Mais". */
const MOBILE_BOTTOM_MAX = 4;

function sidebarLinkClass({ isActive }: NavLinkRenderProps): string {
  return cn(
    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
  );
}

function bottomNavLinkClass({ isActive }: NavLinkRenderProps): string {
  return cn(
    "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium",
    isActive ? "text-primary" : "text-muted-foreground",
  );
}

/**
 * The authenticated app frame: desktop sidebar / mobile top+bottom bars,
 * nav filtered by the current role's permissions, and the routed page in
 * `<Outlet/>`. Also the auth gate for every route nested under it — render
 * only reaches here (and its children) once `useAuth()` has a user.
 */
export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  const role = user.role;
  const visibleItems = NAV_ITEMS.filter((item) => item.show(role));
  const bottomCandidates = visibleItems.filter((item) => item.to !== "/configuracoes");
  const bottomPrimary = bottomCandidates.slice(0, MOBILE_BOTTOM_MAX);
  const overflowItems = [
    ...bottomCandidates.slice(MOBILE_BOTTOM_MAX),
    ...visibleItems.filter((item) => item.to === "/configuracoes"),
  ];

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-card md:flex">
        <div className="px-6 pt-8 pb-6">
          <Wordmark />
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {visibleItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={sidebarLinkClass}>
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-4">
          <p className="truncate text-sm font-medium text-foreground">{user.profile.name}</p>
          <p className="text-xs text-muted-foreground">{user.role.name}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-3 w-full justify-start gap-2 text-muted-foreground"
            onClick={handleLogout}
          >
            <LogOut className="size-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
        <Wordmark compact />
        <div
          title={user.profile.name}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-medium text-accent-foreground"
        >
          {user.profile.name.charAt(0).toUpperCase()}
        </div>
      </header>

      {/* Routed content */}
      <main className="bg-background md:pl-64">
        <div className="mx-auto max-w-6xl p-6 pb-20 md:p-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card md:hidden">
        {bottomPrimary.map((item) => (
          <NavLink key={item.to} to={item.to} className={bottomNavLinkClass}>
            <item.icon className="size-5" />
            {item.label}
          </NavLink>
        ))}

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium text-muted-foreground"
            >
              <Menu className="size-5" />
              Mais
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-xl">
            <SheetHeader>
              <SheetTitle className="font-serif text-xl">Mais opções</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-1 px-4 pb-6">
              {overflowItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={sidebarLinkClass}
                  onClick={() => setMoreOpen(false)}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </NavLink>
              ))}
              {overflowItems.length > 0 && <Separator className="my-2" />}
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                <LogOut className="size-4" />
                Sair
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <h1 className={cn("font-serif text-foreground", compact ? "text-2xl" : "text-3xl")}>
      Allegra<span className="text-primary">OS</span>
    </h1>
  );
}
