"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Loader2, TrendingUp, TrendingDown, ChevronDown, ChevronRight } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

function formatMoney(val: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

function formatMes(anomes: string) {
  if (anomes.length !== 6) return anomes;
  const m = anomes.slice(4, 6);
  const meses: Record<string, string> = {
    "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
    "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
    "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
  };
  return `${meses[m] || m}/${anomes.slice(0, 4)}`;
}

interface PlanoItem {
  id: number;
  anomes: string;
  tipo: string;
  categoria: string;
  tipo_item: string;
  detalhe: string | null;
  quantidade: number | null;
  ticket_medio: number | null;
  valor_planejado: number;
  valor_realizado: number | null;
}

interface PlanoResumoMes {
  anomes: string;
  receita_planejada: number;
  despesas_planejadas: number;
  lucro_planejado: number;
}

export default function PlanoPage() {
  const [ano, setAno] = useState(2026);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumo, setResumo] = useState<PlanoResumoMes[]>([]);
  const [itens, setItens] = useState<PlanoItem[]>([]);
  const [mesExpandido, setMesExpandido] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`${API_URL}/api/v1/plano/resumo-mensal?ano=${ano}`).then((r) => r.json()),
      fetch(`${API_URL}/api/v1/plano?ano=${ano}`).then((r) => r.json()),
    ])
      .then(([r, i]) => {
        setResumo(r);
        setItens(i);
      })
      .catch(() => {
        setResumo([]);
        setItens([]);
        setError("Não foi possível carregar. Verifique se o backend está rodando.");
      })
      .finally(() => setLoading(false));
  }, [ano]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const itensPorMes = itens.reduce<Record<string, PlanoItem[]>>((acc, item) => {
    if (!acc[item.anomes]) acc[item.anomes] = [];
    acc[item.anomes].push(item);
    return acc;
  }, {});

  const mesesOrdenados = Object.keys(itensPorMes).sort();

  return (
    <div className="pb-24">
      <div className="sticky top-14 z-40 bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Plano Financeiro</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Ano:</span>
          <select
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900 bg-white"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            <p className="text-sm text-gray-500">Carregando...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
            <p className="text-sm text-amber-800 mb-4">{error}</p>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition"
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <>
            {/* Resumo anual */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Resumo do ano</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs text-gray-500">Receita planejada</p>
                  <p className="text-base font-semibold text-emerald-600">
                    {formatMoney(resumo.reduce((s, r) => s + r.receita_planejada, 0))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Despesas planejadas</p>
                  <p className="text-base font-semibold text-rose-600">
                    {formatMoney(resumo.reduce((s, r) => s + r.despesas_planejadas, 0))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Lucro planejado</p>
                  <p className="text-base font-semibold text-gray-900">
                    {formatMoney(resumo.reduce((s, r) => s + r.lucro_planejado, 0))}
                  </p>
                </div>
              </div>
            </div>

            {/* Tabela resumo mensal */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden mb-6">
              <h3 className="text-sm font-medium text-gray-700 p-4 pb-2">Por mês</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Mês</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Receita</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Despesas</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Lucro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.map((r) => (
                      <tr key={r.anomes} className="border-b border-gray-100 last:border-0">
                        <td className="py-2 px-3 text-gray-900">{formatMes(r.anomes)}</td>
                        <td className="py-2 px-3 text-right text-emerald-600 font-medium">
                          {formatMoney(r.receita_planejada)}
                        </td>
                        <td className="py-2 px-3 text-right text-rose-600">
                          {formatMoney(r.despesas_planejadas)}
                        </td>
                        <td className="py-2 px-3 text-right font-medium">
                          {r.lucro_planejado >= 0 ? (
                            <span className="text-gray-900">{formatMoney(r.lucro_planejado)}</span>
                          ) : (
                            <span className="text-rose-600">{formatMoney(r.lucro_planejado)}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Detalhamento por mês (accordion) */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <h3 className="text-sm font-medium text-gray-700 p-4 pb-2">Detalhamento</h3>
              {mesesOrdenados.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-gray-500">
                  Nenhum item no plano para {ano}. Importe os dados do Excel.
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {mesesOrdenados.map((anomes) => {
                    const lista = itensPorMes[anomes] || [];
                    const rec = lista.filter((i) => i.tipo === "receita");
                    const desp = lista.filter((i) => i.tipo === "despesa");
                    const expandido = mesExpandido === anomes;
                    return (
                      <div key={anomes} className="border-t border-gray-100 first:border-t-0">
                        <button
                          onClick={() => setMesExpandido(expandido ? null : anomes)}
                          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition"
                        >
                          <span className="font-medium text-gray-900">{formatMes(anomes)}</span>
                          {expandido ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                        {expandido && (
                          <div className="px-4 pb-4 space-y-4">
                            {rec.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-emerald-700 mb-2 flex items-center gap-1">
                                  <TrendingUp className="w-3.5 h-3.5" /> Receita
                                </p>
                                <ul className="space-y-1.5">
                                  {rec.map((i) => (
                                    <li
                                      key={i.id}
                                      className="flex justify-between text-sm text-gray-700"
                                    >
                                      <span>
                                        {i.tipo_item}
                                        {i.quantidade != null ? ` (${i.quantidade})` : ""}
                                      </span>
                                      <span className="font-medium text-emerald-600">
                                        {formatMoney(i.valor_planejado)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {desp.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-rose-700 mb-2 flex items-center gap-1">
                                  <TrendingDown className="w-3.5 h-3.5" /> Despesas
                                </p>
                                <ul className="space-y-1.5">
                                  {desp.map((i) => (
                                    <li
                                      key={i.id}
                                      className="flex justify-between text-sm text-gray-700"
                                    >
                                      <span>
                                        {i.detalhe || i.tipo_item}
                                        {i.categoria !== i.tipo_item ? ` (${i.tipo_item})` : ""}
                                      </span>
                                      <span className="font-medium text-rose-600">
                                        {formatMoney(i.valor_planejado)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
