"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Pencil,
  Ruler,
  Scissors,
  Play,
  Package,
  Check,
  Calendar,
  Loader2,
  ImageIcon,
  FileText,
  CreditCard,
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
  valor_pecas: number | null;
  quantidade_pecas: number | null;
  forma_pagamento: string | null;
  status_pagamento: string | null;
  parcelas_pagas: number | null;
  parcelas_total: number | null;
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "numeric", month: "numeric", year: "numeric" });
  } catch { return iso; }
}

function formatMoney(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  Encomenda:  { label: "Encomenda",  cls: "bg-violet-50 text-violet-700" },
  Cortado:    { label: "Cortado",    cls: "bg-blue-50 text-blue-700" },
  Provado:    { label: "Provado",    cls: "bg-amber-50 text-amber-700" },
  Pronto:     { label: "Pronto",     cls: "bg-green-50 text-green-700" },
  Entregue:   { label: "Entregue",   cls: "bg-emerald-50 text-emerald-700" },
};

const PAG_BADGE: Record<string, { label: string; cls: string }> = {
  confirmado: { label: "Pago",       cls: "bg-green-50 text-green-700" },
  aguardando: { label: "Aguardando", cls: "bg-amber-50 text-amber-700" },
  em_atraso:  { label: "Em atraso",  cls: "bg-red-50 text-red-700" },
};

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<PedidoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchPedidos = () => {
    setLoading(true);
    fetch(`${API_URL}/api/v1/pedidos/ativos`)
      .then((res) => res.json())
      .then((data) => setPedidos(data))
      .catch(() => setPedidos([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPedidos(); }, []);

  const handleStatusClick = async (pedido: PedidoItem, newStatus: string) => {
    setUpdatingId(pedido.id);
    try {
      const res = await fetch(`${API_URL}/api/v1/pedidos/${pedido.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Erro");
      if (newStatus === "Entregue") {
        setPedidos((prev) => prev.filter((p) => p.id !== pedido.id));
      } else {
        const updated = await res.json();
        setPedidos((prev) => prev.map((p) => (p.id === pedido.id ? { ...p, ...updated } : p)));
      }
    } catch {
      /* noop */
    } finally {
      setUpdatingId(null);
    }
  };

  const grouped = pedidos.reduce<Record<string, PedidoItem[]>>((acc, p) => {
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
        <h2 className="text-xl font-semibold text-gray-900">Pedidos Ativos</h2>
        <p className="text-sm text-gray-500">Pedidos em andamento (exclui orçamentos e entregues)</p>
      </div>

      <Link href="/mobile/pedidos/novo" className="block">
        <Button className="w-full" size="lg">Novo Pedido</Button>
      </Link>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : pedidos.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 flex flex-col items-center justify-center min-h-[200px]">
          <Package className="w-12 h-12 text-gray-300 mb-4" />
          <p className="text-gray-500 text-center">Nenhum pedido ativo no momento</p>
          <p className="text-sm text-gray-400 mt-1">Clique em &quot;Novo Pedido&quot; para começar</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateKey) => (
            <div key={dateKey}>
              <h3 className="text-sm font-medium text-gray-500 mb-3">
                {dateKey === "__sem_data__" ? "Sem data de entrega" : formatDate(dateKey)}
              </h3>
              <div className="space-y-3">
                {grouped[dateKey].map((p) => {
                  const statusBadge = STATUS_BADGE[p.status] ?? { label: p.status, cls: "bg-gray-100 text-gray-700" };
                  const pagBadge = p.status_pagamento ? PAG_BADGE[p.status_pagamento] : null;

                  return (
                    <div key={p.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">

                      {/* Cabeçalho: foto + nome + badges */}
                      <Link href={`/mobile/pedidos/${p.id}`} className="flex gap-3 p-4 pb-3">
                        <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden">
                          {p.foto_url ? (
                            <img src={p.foto_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900">{p.cliente_nome}</span>
                            {p.tipo_pedido_nome && (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 border border-gray-200">
                                {p.tipo_pedido_nome}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{p.descricao_produto || "—"}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusBadge.cls}`}>
                            {statusBadge.label}
                          </span>
                          {pagBadge && (
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${pagBadge.cls}`}>
                              <CreditCard className="w-3 h-3" />
                              {pagBadge.label}
                            </span>
                          )}
                        </div>
                      </Link>

                      {/* Grid de info */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 pb-3 border-t border-gray-100 pt-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Entrega</p>
                          <p className="text-xs text-gray-800">{p.data_entrega ? formatDate(p.data_entrega) : "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Valor</p>
                          <p className="text-xs text-gray-800">{p.valor_pecas != null ? formatMoney(p.valor_pecas) : "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Quantidade</p>
                          <p className="text-xs text-gray-800">
                            {p.quantidade_pecas != null ? `${p.quantidade_pecas} ${p.quantidade_pecas === 1 ? "peça" : "peças"}` : "—"}
                          </p>
                        </div>
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Pagamento</p>
                            <p className="text-xs text-gray-800">
                              {p.forma_pagamento
                                ? p.parcelas_total && p.parcelas_total > 1
                                  ? `${p.forma_pagamento} · ${p.parcelas_pagas}/${p.parcelas_total}`
                                  : p.forma_pagamento
                                : "—"}
                            </p>
                          </div>
                          <Link
                            href={`/mobile/pedidos/${p.id}?aba=pagamento`}
                            className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Editar pagamento"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>

                      {/* Linha de ações */}
                      <div className="flex items-center gap-1 px-4 py-2 border-t border-gray-100">
                        <Link
                          href={`/mobile/contratos/novo?cliente_id=${p.cliente_id}`}
                          className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
                          aria-label="Criar contrato"
                        >
                          <FileText className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/mobile/pedidos/${p.id}`}
                          className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
                          aria-label="Editar pedido"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100" aria-label="Medidas">
                          <Ruler className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleStatusClick(p, "Cortado")}
                          disabled={updatingId === p.id}
                          className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
                          aria-label="Cortado"
                        >
                          <Scissors className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleStatusClick(p, "Provado")}
                          disabled={updatingId === p.id}
                          className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
                          aria-label="Provado"
                        >
                          <Play className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleStatusClick(p, "Pronto")}
                          disabled={updatingId === p.id}
                          className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
                          aria-label="Pronto"
                        >
                          <Package className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleStatusClick(p, "Entregue")}
                          disabled={updatingId === p.id}
                          className="ml-auto p-1.5 rounded-lg border border-green-200 bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-40"
                          aria-label="Entregue"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Link
        href="/mobile/pedidos/todos"
        className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600"
        aria-label="Lista total de pedidos"
      >
        <Calendar className="h-6 w-6" />
      </Link>
    </div>
  );
}
