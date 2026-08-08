import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/lib/use-page-title";
import { CategoriasTab } from "@/pages/configuracoes/categorias-tab";
import { EtapasTab } from "@/pages/configuracoes/etapas-tab";
import { ServicosTab } from "@/pages/configuracoes/servicos-tab";
import { TiposEventoTab } from "@/pages/configuracoes/tipos-evento-tab";
import { UsuariasTab } from "@/pages/configuracoes/usuarias-tab";

/**
 * Configurações: cadastro tabs shared across the app (Eventos, Financeiro,
 * CRM all read from these), plus "Usuárias & papéis" — profiles and roles
 * (RBAC). Every tab here is mock data; usuárias' real email invite only
 * arrives in the database phase (for now a new profile just logs in from
 * the login screen with its assigned role).
 *
 * The trigger row scrolls horizontally instead of wrapping: at the 375px
 * mobile width, all five labels don't fit, and Radix's `TabsList` sizes to
 * its content (`w-fit`) rather than the viewport, so wrapping it in an
 * `overflow-x-auto` div is enough to make it a swipeable strip.
 */
export function ConfiguracoesPage() {
  usePageTitle("Configurações");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        subtitle="Cadastros usados em eventos, financeiro e CRM."
      />

      <Tabs defaultValue="tipos-evento">
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList className="w-max">
            <TabsTrigger value="tipos-evento">Tipos de evento</TabsTrigger>
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
            <TabsTrigger value="etapas">Etapas do funil</TabsTrigger>
            <TabsTrigger value="servicos">Serviços</TabsTrigger>
            <TabsTrigger value="usuarias">Usuárias &amp; papéis</TabsTrigger>
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
          <ServicosTab />
        </TabsContent>
        <TabsContent value="usuarias" className="pt-4">
          <UsuariasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
