"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, ClipboardList, Loader2 } from "lucide-react";

import { api } from "@/lib/api-client";

type StatusAprovacao = "pendente" | "aprovado" | "recusado";

interface AtendimentoItem {
  id: number;
  tipo: "pedido" | "orcamento";
  cliente_id: number;
  cliente_nome: string;
  tipo_pedido_nome: string | null;
  descricao_produto: string;
  data_pedido: string;
  data_entrega: string | null;
  quantidade_pecas: number | null;
  valor_combinado: number | null;
  status_aprovacao: StatusAprovacao;
  motivo_recusa: string | null;
  pedido_id: number | null;
  criado_por_nome: string;
  criado_em: string | null;
  foto_url: string | null;
}

const FILTROS: { valor: StatusAprovacao | "todos"; rotulo: string }[] = [
  { valor: "pendente", rotulo: "Aguardando" },
  { valor: "aprovado", rotulo: "Aprovados" },
  { valor: "recusado", rotulo: "Recusados" },
  { valor: "todos", rotulo: "Todos" },
];

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : "—";
}

function formatarMoeda(v: number | null): string {
  return v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function FilaAtendimentoPage() {
  const [filtro, setFiltro] = useState<StatusAprovacao | "todos">("pendente");
  const [itens, setItens] = useState<AtendimentoItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    const query = filtro === "todos" ? "" : `?status=${filtro}`;
    api
      .get<AtendimentoItem[]>(`/api/v1/atendimentos${query}`)
      .then((r) => ativo && setItens(r))
      .catch((err) => ativo && setErro(err instanceof Error ? err.message : "Erro ao carregar"))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [filtro]);

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Atendimento</h1>
        <p className="text-xs text-gray-500">
          Pedidos e orçamentos registrados no balcão, esperando sua aprovação.
        </p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
        {FILTROS.map(({ valor, rotulo }) => (
          <button
            key={valor}
            type="button"
            onClick={() => setFiltro(valor)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filtro === valor
                ? "border-black bg-black text-white"
                : "border-gray-200 bg-white text-gray-600"
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

      {carregando ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : itens.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-14 text-center">
          <ClipboardList className="h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">
            {filtro === "pendente" ? "Nada esperando aprovação." : "Nada por aqui."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {itens.map((a) => (
            <li key={a.id}>
              <Link
                href={`/mobile/atendimento/${a.id}`}
                className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-gray-900">{a.cliente_nome}</span>
                    {a.tipo === "orcamento" && (
                      <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                        Orçamento
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-2 text-xs text-gray-600">{a.descricao_produto}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
                    <span>Entrega: {formatarData(a.data_entrega)}</span>
                    <span>Conversado: {formatarMoeda(a.valor_combinado)}</span>
                    <span>por {a.criado_por_nome}</span>
                  </div>
                  {a.status_aprovacao === "aprovado" && a.pedido_id && (
                    <p className="text-[11px] text-emerald-700">Virou o pedido #{a.pedido_id}</p>
                  )}
                  {a.status_aprovacao === "recusado" && a.motivo_recusa && (
                    <p className="text-[11px] text-red-700">Recusado: {a.motivo_recusa}</p>
                  )}
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gray-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
