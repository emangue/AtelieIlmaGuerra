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
  Loader2,
  ImageIcon,
  Search,
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
  const [pedidos, setPedidos] = useState<PedidoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const fetchPedidos = () => {
    setLoading(true);
    fetch(`${API_URL}/api/v1/pedidos/todos`)
      .then((res) => res.json())
      .then((data) => setPedidos(data))
      .catch(() => setPedidos([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPedidos();
  }, []);

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
        <h2 className="text-xl font-semibold text-gray-900">Todos os Pedidos</h2>
        <p className="text-sm text-gray-500">
          Lista completa, sem filtro de status
        </p>
        <Link
          href="/mobile/pedidos"
          className="text-sm text-red-600 hover:text-red-700 font-medium"
        >
          ← Ver apenas pedidos ativos
        </Link>
      </div>

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
                    <div className="flex gap-3">
                      <Link
                        href={`/mobile/pedidos/${p.id}`}
                        className="flex flex-1 min-w-0 gap-3"
                      >
                        <div className="flex-shrink-0 w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center">
                          {p.foto_url ? (
                            <img
                              src={p.foto_url}
                              alt=""
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <ImageIcon className="w-7 h-7 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">
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
