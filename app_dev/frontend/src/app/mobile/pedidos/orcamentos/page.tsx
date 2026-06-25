"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Receipt, Loader2 } from "lucide-react";
import { getToken } from "@/lib/api-client";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

function authFetch(url: string, init?: RequestInit) {
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

interface PedidoItem {
  id: number;
  cliente_nome: string;
  descricao_produto: string;
  status: string;
  data_pedido: string;
  data_entrega: string | null;
  valor_pecas: number | null;
  tipo_pedido_nome: string | null;
  foto_url: string | null;
}

function formatDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

export default function PedidosOrcamentosPage() {
  const [orcamentos, setOrcamentos] = useState<PedidoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch(`${API_URL}/api/v1/pedidos/todos`)
      .then((res) => res.json())
      .then((data: PedidoItem[]) =>
        setOrcamentos(data.filter((p) => p.status === "Orçamento"))
      )
      .catch(() => setOrcamentos([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pb-24">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-gray-900">Orçamentos ativos</h2>
        <p className="text-sm text-gray-500">Pedidos aguardando aprovação</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : orcamentos.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 flex flex-col items-center justify-center min-h-[200px]">
          <Receipt className="w-12 h-12 text-gray-300 mb-4" />
          <p className="text-gray-500 text-center">Nenhum orçamento em aberto</p>
          <p className="text-sm text-gray-400 mt-1">
            Crie um pedido com status &quot;Orçamento&quot; para aparecer aqui
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orcamentos.map((p) => (
            <Link
              key={p.id}
              href={`/mobile/pedidos/${p.id}?from=historico`}
              className="block rounded-xl border border-gray-200 bg-white p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{p.cliente_nome}</p>
                {p.tipo_pedido_nome && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0">
                    {p.tipo_pedido_nome}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 line-clamp-1 mb-2">{p.descricao_produto}</p>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{formatDate(p.data_pedido)}</span>
                {p.valor_pecas != null && (
                  <span className="font-semibold text-gray-700 text-sm">
                    {formatMoney(p.valor_pecas)}
                  </span>
                )}
              </div>
              {p.data_entrega && (
                <p className="text-xs text-amber-600 mt-1">
                  Entrega prevista: {formatDate(p.data_entrega)}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
