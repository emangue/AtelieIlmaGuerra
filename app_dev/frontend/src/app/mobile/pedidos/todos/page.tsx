"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Pencil,
  Ruler,
  Scissors,
  Play,
  Package,
  Check,
  Loader2,
  ImageIcon,
  Search,
  ChevronDown,
  ChevronUp,
  DollarSign,
  FileText,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

interface PedidoItem {
  id: number;
  cliente_id: number;
  cliente_nome: string;
  tipo_pedido_nome: string | null;
  descricao_produto: string;
  status: string;
  data_pedido: string;
  data_entrega: string | null;
  foto_url: string | null;
}

interface PecasPorTipo {
  tipo: string;
  quantidade: number;
  valor: number;
}

function formatMoney(val: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function PedidosTodosPage() {
  const searchParams = useSearchParams();
  const mesFilter = searchParams.get("mes"); // YYYYMM
  const [pedidos, setPedidos] = useState<PedidoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [resumo, setResumo] = useState<PecasPorTipo[] | null>(null);
  const [resumoExpanded, setResumoExpanded] = useState(false);

  const fetchPedidos = () => {
    setLoading(true);
    const url = mesFilter
      ? `${API_URL}/api/v1/pedidos/todos?mes=${mesFilter}`
      : `${API_URL}/api/v1/pedidos/todos`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => setPedidos(data))
      .catch(() => setPedidos([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPedidos();
  }, [mesFilter]);

  useEffect(() => {
    if (!mesFilter) {
      setResumo(null);
      return;
    }
    fetch(`${API_URL}/api/v1/dashboard/pecas-por-tipo?mes=${mesFilter}`)
      .then((res) => res.json())
      .then((data: PecasPorTipo[]) => setResumo(data))
      .catch(() => setResumo(null));
  }, [mesFilter]);

  const handleStatusClick = async (pedido: PedidoItem, newStatus: string) => {
    setUpdatingId(pedido.id);
    try {
      const res = await fetch(`${API_URL}/api/v1/pedidos/${pedido.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Erro");
      const updated = await res.json();
      setPedidos((prev) =>
        prev.map((p) => (p.id === pedido.id ? { ...p, ...updated } : p))
      );
    } catch {
      setUpdatingId(null);
    } finally {
      setUpdatingId(null);
    }
  };

  const searchLower = search.trim().toLowerCase();
  const filtered = searchLower
    ? pedidos.filter(
        (p) =>
          p.cliente_nome.toLowerCase().includes(searchLower) ||
          (p.descricao_produto || "").toLowerCase().includes(searchLower) ||
          p.status.toLowerCase().includes(searchLower)
      )
    : pedidos;

  const grouped = filtered.reduce<Record<string, PedidoItem[]>>((acc, p) => {
    const key = p.data_entrega || "__sem_data__";
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => {
    if (a === "__sem_data__") return 1;
    if (b === "__sem_data__") return -1;
    return new Date(a).getTime() - new Date(b).getTime();
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pb-24">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-gray-900">
          {mesFilter
            ? `Pedidos de ${mesFilter.slice(4, 6)}/${mesFilter.slice(0, 4)}`
            : "Todos os Pedidos"}
        </h2>
        <p className="text-sm text-gray-500">
          {mesFilter
            ? "Pedidos com data de entrega neste mês"
            : "Lista completa, sem filtro de status"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/mobile/pedidos"
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            ← Ver apenas pedidos ativos
          </Link>
          {mesFilter && (
            <Link
              href="/mobile/pedidos/todos"
              className="text-sm text-gray-600 hover:text-gray-700 font-medium"
            >
              · Ver todos os pedidos
            </Link>
          )}
        </div>
      </div>

      {mesFilter && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setResumoExpanded((e) => !e)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">
                Total entregue
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-gray-900">
                {resumo
                  ? formatMoney(resumo.reduce((s, r) => s + r.valor, 0))
                  : "—"}
              </span>
              {resumo && resumo.length > 0 && (
                resumoExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )
              )}
            </div>
          </button>
          {resumoExpanded && resumo && resumo.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
              <div className="space-y-2">
                {resumo.map((r) => (
                  <div
                    key={r.tipo}
                    className="flex justify-between items-center text-sm"
                  >
                    <span className="text-gray-700">{r.tipo}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500">
                        {r.quantidade} un.
                      </span>
                      <span className="font-medium text-gray-900">
                        {formatMoney(r.valor)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="search"
          placeholder="Buscar por cliente, descrição ou status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
          aria-label="Buscar pedido"
        />
      </div>

      <Link href="/mobile/pedidos/novo" className="block">
        <Button className="w-full" size="lg">
          Novo Pedido
        </Button>
      </Link>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : pedidos.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 flex flex-col items-center justify-center min-h-[200px]">
          <Package className="w-12 h-12 text-gray-300 mb-4" />
          <p className="text-gray-500 text-center">
            Nenhum pedido cadastrado
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Clique em &quot;Novo Pedido&quot; para começar
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 flex flex-col items-center justify-center min-h-[200px]">
          <Search className="w-12 h-12 text-gray-300 mb-4" />
          <p className="text-gray-500 text-center">
            Nenhum pedido encontrado
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Tente outros termos na busca
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateKey) => (
            <div key={dateKey}>
              <h3 className="text-sm font-medium text-gray-500 mb-3">
                {dateKey === "__sem_data__"
                  ? "Sem data de entrega"
                  : formatDate(dateKey)}
              </h3>
              <div className="space-y-3">
                {grouped[dateKey].map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm min-h-[100px]"
                  >
                    <div className="flex gap-2">
                      <Link
                        href={`/mobile/pedidos/${p.id}`}
                        className="flex flex-1 min-w-0 gap-2"
                      >
                        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                          {p.foto_url ? (
                            <img
                              src={p.foto_url}
                              alt=""
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 line-clamp-2 break-words">
                            {p.cliente_nome}
                          </p>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {p.descricao_produto || "—"}
                          </p>
                        </div>
                      </Link>
                      <div
                        className="flex flex-col items-end justify-between gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          {p.status}
                        </span>
                        <Link
                          href={`/mobile/contratos/novo?cliente_id=${p.cliente_id}`}
                          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                          aria-label="Criar contrato"
                        >
                          <FileText className="h-4 w-4" />
                        </Link>
                        <Link href={`/mobile/pedidos/${p.id}`}>
                          <button
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                            aria-label="Ver detalhe"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </Link>
                        <div className="flex items-center gap-0.5 flex-wrap justify-end">
                          <button
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                            aria-label="Medidas"
                          >
                            <Ruler className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              handleStatusClick(p, "Cortado")
                            }
                            disabled={updatingId === p.id}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-50"
                            aria-label="Cortado"
                          >
                            <Scissors className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              handleStatusClick(p, "Provado")
                            }
                            disabled={updatingId === p.id}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-50"
                            aria-label="Provado"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              handleStatusClick(p, "Pronto")
                            }
                            disabled={updatingId === p.id}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-50"
                            aria-label="Pronto"
                          >
                            <Package className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              handleStatusClick(p, "Entregue")
                            }
                            disabled={updatingId === p.id}
                            className="p-1.5 rounded hover:bg-green-100 text-green-600 disabled:opacity-50"
                            aria-label="Entregue"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
