import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoriasTab } from "@/pages/configuracoes/categorias-tab";
import { EtapasTab } from "@/pages/configuracoes/etapas-tab";
import { TiposEventoTab } from "@/pages/configuracoes/tipos-evento-tab";

/**
 * Configurações: cadastro tabs shared across the app (Eventos, Financeiro,
 * CRM all read from these). "Serviços" and "Usuárias & papéis" are
 * disabled placeholder triggers — their CRUD lands in Tasks 10/11 — but
 * each still carries a real (if inert) `TabsContent` panel, so wiring the
 * real tab in later is just swapping the child and dropping `disabled`.
 *
 * The trigger row scrolls horizontally instead of wrapping: at the 375px
 * mobile width, all five labels don't fit, and Radix's `TabsList` sizes to
 * its content (`w-fit`) rather than the viewport, so wrapping it in an
 * `overflow-x-auto` div is enough to make it a swipeable strip.
 */
export function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-serif text-3xl text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Cadastros usados em eventos, financeiro e CRM.</p>
      </div>

      <Tabs defaultValue="tipos-evento">
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList className="w-max">
            <TabsTrigger value="tipos-evento">Tipos de evento</TabsTrigger>
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
            <TabsTrigger value="etapas">Etapas do funil</TabsTrigger>
            {/* No `title` tooltip here on purpose: a `title` on an element that
                also has text content wins the accessible name in some a11y-tree
                computations, which would make both disabled tabs announce as
                "Em construção" instead of their own (still visible) label. */}
            <TabsTrigger value="servicos" disabled>
              Serviços
            </TabsTrigger>
            <TabsTrigger value="usuarias" disabled>
              Usuárias &amp; papéis
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tipos-evento" className="pt-4">
          <TiposEventoTab />
        </TabsContent>
        <TabsContent value="categorias" className="pt-4">
          <CategoriasTab />
        </TabsContent>
        <TabsContent value="etapas" className="pt-4">
          <EtapasTab />
        </TabsContent>
        <TabsContent value="servicos" className="pt-4">
          <p className="text-muted-foreground">Em construção.</p>
        </TabsContent>
        <TabsContent value="usuarias" className="pt-4">
          <p className="text-muted-foreground">Em construção.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
