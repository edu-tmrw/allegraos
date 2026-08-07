import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";

/** Catch-all for any authenticated path that doesn't match a route. */
export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <p className="font-serif text-6xl text-muted-foreground">404</p>
      <h1 className="font-serif text-2xl text-foreground">Página não encontrada</h1>
      <p className="max-w-sm text-muted-foreground">
        O endereço que você tentou acessar não existe ou foi movido.
      </p>
      <Button type="button" variant="outline" className="mt-2" onClick={() => navigate(-1)}>
        Voltar
      </Button>
    </div>
  );
}
