import { CheckCircle2, Clock, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import type { StatusAprovacao } from "@/lib/types";

const ESTILOS: Record<StatusAprovacao, { texto: string; classe: string; Icone: typeof Clock }> = {
  pendente: {
    texto: "Aguardando aprovação",
    classe: "bg-amber-50 text-amber-700 border-amber-200",
    Icone: Clock,
  },
  aprovado: {
    texto: "Aprovado",
    classe: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Icone: CheckCircle2,
  },
  recusado: {
    texto: "Recusado",
    classe: "bg-red-50 text-red-700 border-red-200",
    Icone: XCircle,
  },
};

export function StatusBadge({ status, className }: { status: StatusAprovacao; className?: string }) {
  const { texto, classe, Icone } = ESTILOS[status] ?? ESTILOS.pendente;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        classe,
        className
      )}
    >
      <Icone className="h-3 w-3" />
      {texto}
    </span>
  );
}
