import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="font-serif text-4xl text-foreground">Allegra</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sistema de gestão — fundação visual
        </p>
        <span className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Botão de ação
        </span>
      </div>
    </div>
  </StrictMode>,
);
