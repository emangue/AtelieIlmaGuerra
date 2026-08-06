"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight, Loader2 } from "lucide-react";

import { StatusBadge } from "@/components/atendimento/status-badge";
import { api } from "@/lib/api-client";
import { formatarData, formatarMoeda } from "@/lib/format";
import type { AtendimentoListItem, StatusAprovacao } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILTROS: { valor: StatusAprovacao | "todos"; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "pendente", rotulo: "Aguardando" },
  { valor: "aprovado", rotulo: "Aprovados" },
  { valor: "recusado", rotulo: "Recusados" },
];

function EnviadosConteudo() {
  const searchParams = useSearchParams();
  const idNovo = searchParams.get("novo");

  const [filtro, setFiltro] = useState<StatusAprovacao | "todos">("todos");
  const [itens, setItens] = useState<AtendimentoListItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    const query = filtro === "todos" ? "" : `?status=${filtro}`;
    api
      .get<AtendimentoListItem[]>(`/api/v1/atendimentos${query}`)
      .then((r) => ativo && setItens(r))
      .catch((err) => ativo && setErro(err instanceof Error ? err.message : "Erro ao carregar"))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [filtro]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Enviados</h1>

      {idNovo && (
        <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
          Enviado para aprovação. A Ilma vai revisar e você acompanha o status aqui.
        </p>
      )}

      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
        {FILTROS.map(({ valor, rotulo }) => (
          <button
            key={valor}
            type="button"
            onClick={() => setFiltro(valor)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filtro === valor
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground"
            )}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {erro && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

      {carregando ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : itens.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nada por aqui ainda.
        </p>
      ) : (
        <ul className="space-y-2">
          {itens.map((a) => (
            <li key={a.id}>
              <Link
                href={`/enviados/${a.id}`}
                className={cn(
                  "flex items-start gap-3 rounded-lg border bg-card p-3 hover:bg-muted",
                  String(a.id) === idNovo ? "border-emerald-300" : "border-border"
                )}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{a.cliente_nome}</span>
                    {a.tipo === "orcamento" && (
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        Orçamento
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{a.descricao_produto}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span>Entrega: {formatarData(a.data_entrega)}</span>
                    {a.valor_combinado != null && <span>{formatarMoeda(a.valor_combinado)}</span>}
                  </div>
                  <StatusBadge status={a.status_aprovacao} />
                  {a.status_aprovacao === "recusado" && a.motivo_recusa && (
                    <p className="text-[11px] text-red-700">Motivo: {a.motivo_recusa}</p>
                  )}
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function EnviadosPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <EnviadosConteudo />
    </Suspense>
  );
}
