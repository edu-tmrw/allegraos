import { useMemo } from "react";
import { Navigate, useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { defaultRouteFor, useAuth } from "@/data/auth";
import { crud, resetDB } from "@/data/store";
import { cn } from "@/lib/utils";
import type { Profile, Role } from "@/domain/types";

interface ActiveProfile {
  profile: Profile;
  role: Role;
}

/** Every active profile paired with its role, for the "Entrar como" list below. */
function listActiveProfiles(): ActiveProfile[] {
  const rolesById = new Map(crud("roles").list().map((role) => [role.id, role]));

  return crud("profiles")
    .list()
    .filter((profile) => profile.active)
    .flatMap((profile) => {
      const role = rolesById.get(profile.roleId);
      return role ? [{ profile, role }] : [];
    });
}

/**
 * The app's front door. Email/senha are decorative (real auth arrives with
 * Supabase in F2) — the actual sign-in is "Entrar como", one button per
 * active demo profile. Already logged in -> straight to that role's home.
 */
export function LoginPage() {
  const { user, loginAs } = useAuth();
  const navigate = useNavigate();
  const activeProfiles = useMemo(listActiveProfiles, []);

  if (user) return <Navigate to={defaultRouteFor(user.role)} replace />;

  function handleEnterAs(entry: ActiveProfile) {
    loginAs(entry.profile.userId);
    navigate(defaultRouteFor(entry.role), { replace: true });
  }

  function handleRestoreDemo() {
    resetDB();
    toast.success("Dados de demonstração restaurados");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col gap-8">
          <div className="flex flex-col items-center gap-2 pt-2 text-center">
            <h1 className="font-serif text-4xl text-foreground">Allegra</h1>
            <p className="text-sm tracking-wide text-muted-foreground">
              Onde cada detalhe fala de amor
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Input
              disabled
              type="email"
              aria-label="Email"
              placeholder="em breve — fase 2"
            />
            <Input
              disabled
              type="password"
              aria-label="Senha"
              placeholder="em breve — fase 2"
            />
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
              Entrar como
            </p>
            <div className="flex flex-col gap-2">
              {activeProfiles.map((entry, index) => (
                <Button
                  key={entry.profile.userId}
                  type="button"
                  variant={index === 0 ? "default" : "outline"}
                  className="h-auto flex-col items-start gap-0.5 py-2.5"
                  onClick={() => handleEnterAs(entry)}
                >
                  <span className="text-sm font-medium">{entry.profile.name}</span>
                  <span
                    className={cn(
                      "text-xs font-normal",
                      index === 0 ? "text-primary-foreground/70" : "text-muted-foreground",
                    )}
                  >
                    {entry.role.name}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>

        <CardFooter className="justify-center border-t border-border pt-6">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={handleRestoreDemo}
          >
            Restaurar dados de demonstração
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
