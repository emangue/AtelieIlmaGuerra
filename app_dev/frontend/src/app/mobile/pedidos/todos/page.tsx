"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Pencil,
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
import { getToken } from "@/lib/api-client";

const API_URL = "";
const PAGE_SIZE = 20;

function authFetch(url: string, init?: RequestInit) {
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

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
    return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function PedidoCard({
  p,
  mesFilter,
  updatingId,
  onStatusClick,
}: {
  p: PedidoItem;
  mesFilter: string | null;
  updatingId: number | null;
  onStatusClick: (p: PedidoItem, status: string) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex gap-2">
        <Link
          href={`/mobile/pedidos/${p.id}?from=historico${mesFilter ? `&mes=${mesFilter}` : ""}`}
          className="flex flex-1 min-w-0 gap-2"
        >
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
            {p.foto_url ? (
              <img src={p.foto_url} alt="" className="w-full h-full object-cover rounded-lg" />
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
            {p.data_entrega && (
              <p className="text-xs text-gray-400 mt-1">{formatDate(p.data_entrega)}</p>
            )}
          </div>
        </Link>
        <div className="flex flex-col items-end justify-between gap-2" onClick={(e) => e.stopPropagation()}>
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
          <Link href={`/mobile/pedidos/${p.id}?from=historico${mesFilter ? `&mes=${mesFilter}` : ""}`}>
            <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Editar">
              <Pencil className="h-4 w-4" />
            </button>
          </Link>
          <div className="flex items-center gap-0.5 flex-wrap justify-end">
            <button
              onClick={() => onStatusClick(p, "Cortado")}
              disabled={updatingId === p.id}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-50"
              aria-label="Cortado"
            >
              <Scissors className="h-4 w-4" />
            </button>
            <button
              onClick={() => onStatusClick(p, "Provado")}
              disabled={updatingId === p.id}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-50"
              aria-label="Provado"
            >
              <Play className="h-4 w-4" />
            </button>
            <button
              onClick={() => onStatusClick(p, "Pronto")}
              disabled={updatingId === p.id}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-50"
              aria-label="Pronto"
            >
              <Package className="h-4 w-4" />
            </button>
            <button
              onClick={() => onStatusClick(p, "Entregue")}
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
  );
}

function PedidosTodosContent() {
  const searchParams = useSearchParams();
  const mesFilter = searchParams.get("mes");
  const statusFilter = searchParams.get("status");

  const [pedidos, setPedidos] = useState<PedidoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [resumo, setResumo] = useState<PecasPorTipo[] | null>(null);
  const [resumoExpanded, setResumoExpanded] = useState(false);

  const offsetRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildUrl = useCallback((q: string, offset: number) => {
    const params = new URLSearchParams();
    params.set("offset", String(offset));
    params.set("limit", String(PAGE_SIZE));
    if (q.trim()) params.set("q", q.trim());
    if (mesFilter) params.set("mes", mesFilter);
    if (statusFilter) params.set("status", statusFilter);
    return `${API_URL}/api/v1/pedidos/historico?${params.toString()}`;
  }, [mesFilter, statusFilter]);

  const fetchPage = useCallback(async (q: string, offset: number, append: boolean) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await authFetch(buildUrl(q, offset));
      const data = await res.json();
      const items: PedidoItem[] = data.items ?? [];
      setPedidos((prev) => append ? [...prev, ...items] : items);
      setTotal(data.total ?? 0);
      setHasMore(data.has_more ?? false);
      offsetRef.current = offset + items.length;
    } catch {
      if (!append) setPedidos([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [buildUrl]);

  // Carregamento inicial
  useEffect(() => {
    offsetRef.current = 0;
    fetchPage("", 0, false);
  }, [mesFilter, statusFilter]);

  // Resumo por mês (quando vem do dashboard)
  useEffect(() => {
    if (!mesFilter) { setResumo(null); return; }
    authFetch(`${API_URL}/api/v1/dashboard/pecas-por-tipo?mes=${mesFilter}`)
      .then((r) => r.json())
      .then((d: PecasPorTipo[]) => setResumo(d))
      .catch(() => setResumo(null));
  }, [mesFilter]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearch(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      offsetRef.current = 0;
      fetchPage(q, 0, false);
    }, 400);
  };

  const handleLoadMore = () => {
    fetchPage(search, offsetRef.current, true);
  };

  const handleStatusClick = async (pedido: PedidoItem, newStatus: string) => {
    setUpdatingId(pedido.id);
    try {
      const res = await authFetch(`${API_URL}/api/v1/pedidos/${pedido.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setPedidos((prev) => prev.map((p) => (p.id === pedido.id ? { ...p, ...updated } : p)));
    } finally {
      setUpdatingId(null);
    }
  };

  const titulo = mesFilter
    ? `Pedidos de ${mesFilter.slice(4, 6)}/${mesFilter.slice(0, 4)}`
    : "Todos os Pedidos";

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pb-24">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-gray-900">{titulo}</h2>
        <p className="text-sm text-gray-500">
          {loading ? "Carregando..." : `${total} pedido${total !== 1 ? "s" : ""} encontrado${total !== 1 ? "s" : ""}`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/mobile/pedidos" className="text-sm text-red-600 hover:text-red-700 font-medium">
            ← Ver apenas pedidos ativos
          </Link>
          {mesFilter && (
            <Link href="/mobile/pedidos/todos" className="text-sm text-gray-600 hover:text-gray-700 font-medium">
              · Ver todos os pedidos
            </Link>
          )}
        </div>
      </div>

      {/* Resumo do mês */}
      {mesFilter && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setResumoExpanded((e) => !e)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Total entregue</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-gray-900">
                {resumo ? formatMoney(resumo.reduce((s, r) => s + r.valor, 0)) : "—"}
              </span>
              {resumo && resumo.length > 0 && (
                resumoExpanded
                  ? <ChevronUp className="w-5 h-5 text-gray-500" />
                  : <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </div>
          </button>
          {resumoExpanded && resumo && resumo.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50 space-y-2">
              {resumo.map((r) => (
                <div key={r.tipo} className="flex justify-between items-center text-sm">
                  <span className="text-gray-700">{r.tipo}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500">{r.quantidade} un.</span>
                    <span className="font-medium text-gray-900">{formatMoney(r.valor)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="search"
          placeholder="Buscar por cliente, descrição ou status..."
          value={search}
          onChange={handleSearchChange}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
          aria-label="Buscar pedido"
        />
      </div>

      <Link href="/mobile/pedidos/novo" className="block">
        <Button className="w-full" size="lg">Novo Pedido</Button>
      </Link>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : pedidos.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 flex flex-col items-center justify-center min-h-[200px]">
          <Search className="w-12 h-12 text-gray-300 mb-4" />
          <p className="text-gray-500 text-center">
            {search ? "Nenhum pedido encontrado" : "Nenhum pedido cadastrado"}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {search ? "Tente outros termos na busca" : 'Clique em "Novo Pedido" para começar'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pedidos.map((p) => (
            <PedidoCard
              key={p.id}
              p={p}
              mesFilter={mesFilter}
              updatingId={updatingId}
              onStatusClick={handleStatusClick}
            />
          ))}

          {hasMore && (
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="w-full py-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loadingMore
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</>
                : `Carregar mais (${total - pedidos.length} restantes)`
              }
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function PedidosTodosPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>}>
      <PedidosTodosContent />
    </Suspense>
  );
}
