import { useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wordmark } from "@/components/layout/app-shell";
import { defaultRouteFor, useAuth } from "@/data/auth";
import { usePageTitle } from "@/lib/use-page-title";

type PendingAction = "sign-in" | "reset" | null;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** The Supabase email/password front door for AllegraOS. */
export function LoginPage() {
  const { user, signInWithPassword, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  usePageTitle();

  if (user) return <Navigate to={defaultRouteFor(user.role)} replace />;

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setError("Informe seu email e sua senha.");
      return;
    }

    setPendingAction("sign-in");
    try {
      await signInWithPassword({ email: normalizedEmail, password });
    } catch (authError) {
      setError(errorMessage(authError, "Não foi possível entrar. Tente novamente."));
    } finally {
      setPendingAction(null);
    }
  }

  async function handlePasswordReset() {
    setError(null);
    setNotice(null);

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError("Informe seu email para recuperar a senha.");
      return;
    }

    setPendingAction("reset");
    try {
      await requestPasswordReset(normalizedEmail);
      setNotice("Enviamos as instruções de recuperação para o seu email.");
    } catch (resetError) {
      setError(errorMessage(resetError, "Não foi possível enviar o email de recuperação."));
    } finally {
      setPendingAction(null);
    }
  }

  const isPending = pendingAction !== null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col gap-8">
          <div className="flex flex-col items-center gap-2 pt-2 text-center">
            <Wordmark className="text-4xl" />
            <p className="text-sm tracking-wide text-muted-foreground">
              Onde cada detalhe fala de amor
            </p>
          </div>

          <form className="flex flex-col gap-4" onSubmit={handleSignIn} noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isPending}
                aria-invalid={error ? true : undefined}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-password">Senha</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isPending}
                aria-invalid={error ? true : undefined}
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
                {notice}
              </p>
            ) : null}

            <Button type="submit" disabled={isPending}>
              {pendingAction === "sign-in" ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center border-t border-border pt-6">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => void handlePasswordReset()}
            disabled={isPending}
          >
            {pendingAction === "reset" ? "Enviando…" : "Esqueci minha senha"}
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
