import { ToolCard } from "@/app/components/shared/ToolCard";
import { TOOL_GROUPS } from "@/app/lib/tools";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <section className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Todas as ferramentas de PDF, direto no seu navegador
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Gratuito e privado: o processamento acontece no seu computador e
          nenhum arquivo é enviado para a internet.
        </p>
      </section>

      <div className="space-y-10">
        {TOOL_GROUPS.map((group) => (
          <section key={group.id} aria-labelledby={`group-${group.id}`}>
            <h2
              id={`group-${group.id}`}
              className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase"
            >
              {group.title}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.tools.map((tool) => (
                <ToolCard key={tool.href} {...tool} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
