"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, TrendingUp, TrendingDown, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface PagamentoItem {
  id: number;
  tipo: "receita" | "despesa";
  origem: string;
  descricao: string;
  categoria: string;
  tipo_item: string | null;
  valor: number;
  data: string;
  icon_key: string;
  pedido_id: number | null;
}

interface PagamentosResponse {
  mes: string;
  total_receitas: number;
  total_despesas: number;
  saldo: number;
  itens: PagamentoItem[];
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
    const [year, month, day] = iso.split("-");
    return `${day}/${month}/${year}`;
  } catch {
    return iso;
  }
}

function getMesLabel(anomes: string) {
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const m = parseInt(anomes.slice(4, 6)) - 1;
  const y = anomes.slice(0, 4);
  return `${meses[m]} ${y}`;
}

function navegarMes(anomes: string, delta: number): string {
  let y = parseInt(anomes.slice(0, 4));
  let m = parseInt(anomes.slice(4, 6)) - 1 + delta;
  if (m < 0) { m = 11; y--; }
  if (m > 11) { m = 0; y++; }
  return `${y}${String(m + 1).padStart(2, "0")}`;
}

function mesAtual(): string {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function PagamentosPage() {
  const router = useRouter();
  const [mes, setMes] = useState(mesAtual);
  const [data, setData] = useState<PagamentosResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/pagamentos?mes=${mes}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [mes]);

  const receitas = data?.itens.filter((i) => i.tipo === "receita") ?? [];
  const despesas = data?.itens.filter((i) => i.tipo === "despesa") ?? [];

  return (
    <div className="flex flex-1 flex-col pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.push("/mobile/financeiro")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-900">Movimentações</h1>
          </div>
        </div>
      </div>

      {/* Navegação de mês */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <Button variant="ghost" size="icon" onClick={() => setMes((m) => navegarMes(m, -1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-base font-semibold text-gray-900">{getMesLabel(mes)}</span>
        <Button variant="ghost" size="icon" onClick={() => setMes((m) => navegarMes(m, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : !data ? (
        <div className="p-6 text-center text-gray-500">Erro ao carregar movimentações.</div>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          {/* Resumo */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Receitas</p>
              <p className="text-sm font-bold text-green-600">{formatMoney(data.total_receitas)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Despesas</p>
              <p className="text-sm font-bold text-red-600">{formatMoney(data.total_despesas)}</p>
            </div>
            <div className={`rounded-xl border p-3 text-center ${data.saldo >= 0 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
              <p className="text-xs text-gray-500 mb-1">Saldo</p>
              <p className={`text-sm font-bold ${data.saldo >= 0 ? "text-green-700" : "text-red-700"}`}>{formatMoney(data.saldo)}</p>
            </div>
          </div>

          {/* Receitas */}
          {receitas.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <h2 className="text-sm font-semibold text-gray-700">Receitas ({receitas.length})</h2>
              </div>
              <div className="space-y-2">
                {receitas.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-gray-200 bg-white p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
                    onClick={() => item.pedido_id && router.push(`/mobile/pedidos/${item.pedido_id}?from=pagamentos`)}
                  >
                    <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.descricao}</p>
                      <p className="text-xs text-gray-500">{formatDate(item.data)}</p>
                    </div>
                    <span className="text-sm font-semibold text-green-600 flex-shrink-0">
                      {formatMoney(item.valor)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Despesas */}
          {despesas.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                <h2 className="text-sm font-semibold text-gray-700">Despesas ({despesas.length})</h2>
              </div>
              <div className="space-y-2">
                {despesas.map((item) => (
                  <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.descricao || item.tipo_item || "Despesa"}</p>
                      <p className="text-xs text-gray-500">{item.categoria} · {formatDate(item.data)}</p>
                    </div>
                    <span className="text-sm font-semibold text-red-600 flex-shrink-0">
                      {formatMoney(item.valor)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {receitas.length === 0 && despesas.length === 0 && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
              <p className="text-gray-500">Nenhuma movimentação em {getMesLabel(mes)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
