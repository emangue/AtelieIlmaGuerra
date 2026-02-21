"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  TrendingUp,
  Clock,
  Package,
  DollarSign,
  Percent,
} from "lucide-react";
import { MonthScrollPicker } from "@/components/mobile/month-scroll-picker";
import { YTDToggle, YTDToggleValue } from "@/components/mobile/ytd-toggle";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

function formatMoney(val: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

interface Kpis {
  mes?: string;
  ano?: string;
  faturamento_parcial: number;
  faturamento_potencial: number;
  horas_trabalhadas: number;
  horas_potencial?: number;
  margem_mes?: number;
  quantidade_entregues: number;
}

interface MixStatus {
  status: string;
  quantidade: number;
}

interface LucroMensal {
  mes: string;
  label: string;
  valor: number;
}

interface PecasPorTipo {
  tipo: string;
  quantidade: number;
  valor: number;
}

const CORES_STATUS: Record<string, string> = {
  Encomenda: "#3b82f6",
  Cortado: "#f59e0b",
  Provado: "#8b5cf6",
  Pronto: "#10b981",
  Entregue: "#22c55e",
};

function getCorStatus(status: string) {
  return CORES_STATUS[status] || "#6b7280";
}

export default function PainelPage() {
  const hoje = new Date();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [period, setPeriod] = useState<YTDToggleValue>("month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [mixStatus, setMixStatus] = useState<MixStatus[]>([]);
  const [lucroMensal, setLucroMensal] = useState<LucroMensal[]>([]);
  const [pecasPorTipo, setPecasPorTipo] = useState<PecasPorTipo[]>([]);

  const ano = selectedMonth.getFullYear();
  const mes = selectedMonth.getMonth() + 1;
  const mesParam = `${ano}${mes.toString().padStart(2, "0")}`;

  const fetchWithTimeout = (url: string, ms = 8000) => {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { signal: ctrl.signal })
      .then((r) => {
        clearTimeout(timeout);
        return r.json();
      })
      .catch((e) => {
        clearTimeout(timeout);
        throw e;
      });
  };

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    const isYear = period === "ytd";
    const kpisUrl = isYear
      ? `${API_URL}/api/v1/dashboard/kpis?year=${ano}`
      : `${API_URL}/api/v1/dashboard/kpis?mes=${mesParam}`;
    const mixUrl = isYear
      ? `${API_URL}/api/v1/dashboard/mix-status?year=${ano}`
      : `${API_URL}/api/v1/dashboard/mix-status?mes=${mesParam}`;
    const lucroUrl = isYear
      ? `${API_URL}/api/v1/dashboard/lucro-mensal?meses=12&year=${ano}`
      : `${API_URL}/api/v1/dashboard/lucro-mensal?meses=12`;
    const pecasUrl = isYear
      ? `${API_URL}/api/v1/dashboard/pecas-por-tipo?year=${ano}`
      : `${API_URL}/api/v1/dashboard/pecas-por-tipo?mes=${mesParam}`;
    Promise.all([
      fetchWithTimeout(kpisUrl),
      fetchWithTimeout(mixUrl),
      fetchWithTimeout(lucroUrl),
      fetchWithTimeout(pecasUrl),
    ])
      .then(([k, m, l, p]) => {
        setKpis(k);
        setMixStatus(m);
        setLucroMensal(l);
        setPecasPorTipo(p);
      })
      .catch(() => {
        setKpis(null);
        setMixStatus([]);
        setLucroMensal([]);
        setPecasPorTipo([]);
        setError(
          "Não foi possível carregar. Verifique se o backend está rodando (porta 8000)."
        );
      })
      .finally(() => setLoading(false));
  }, [mesParam, ano, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const mixParaPie = mixStatus.map((s) => ({
    name: s.status,
    value: s.quantidade,
    fill: getCorStatus(s.status),
  }));

  return (
    <div className="px-4 py-6 pb-24">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Painel Resultados
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          KPIs e gráficos do mês selecionado
        </p>
      </div>

      {/* Scroll horizontal de meses */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-white overflow-hidden">
        <MonthScrollPicker
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
        />
      </div>

      {/* Toggle Mês / Ano */}
      <div className="flex justify-center mb-6">
        <YTDToggle value={period} onChange={setPeriod} />
      </div>

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
          {/* Cards KPIs - Real e Potencial na mesma caixa */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {/* Faturamento: Real | Potencial */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-3">
                <DollarSign className="w-4 h-4" />
                Faturamento
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-gray-500">Real (entregues)</span>
                  <span className="text-base font-semibold text-gray-900">
                    {kpis ? formatMoney(kpis.faturamento_parcial) : "—"}
                  </span>
                </div>
                <div className="h-px bg-gray-100" />
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-gray-500">Potencial</span>
                  <span className="text-base font-medium text-gray-600">
                    {kpis ? formatMoney(kpis.faturamento_potencial) : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Horas: Real | Potencial */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-3">
                <Clock className="w-4 h-4" />
                Horas
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-gray-500">Real (entregues)</span>
                  <span className="text-base font-semibold text-gray-900">
                    {kpis ? `${kpis.horas_trabalhadas.toFixed(1)} h` : "—"}
                  </span>
                </div>
                <div className="h-px bg-gray-100" />
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-gray-500">Potencial</span>
                  <span className="text-base font-medium text-gray-600">
                    {kpis
                      ? `${(kpis.horas_potencial ?? kpis.horas_trabalhadas).toFixed(1)} h`
                      : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Peças entregues */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Package className="w-4 h-4" />
                Peças entregues
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {kpis ? kpis.quantidade_entregues : "—"}
              </p>
            </div>

            {/* Margem Mês */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Percent className="w-4 h-4" />
                Margem mês
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {kpis && kpis.margem_mes != null
                  ? `${kpis.margem_mes.toFixed(1)}%`
                  : "—"}
              </p>
            </div>
          </div>

          {/* Gráfico Mix Status (donut) */}
          {mixParaPie.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">
                Mix de status (pedidos do mês)
              </h3>
              <div className="h-[200px] min-h-[200px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                  <PieChart>
                    <Pie
                      data={mixParaPie}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                    >
                      {mixParaPie.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number | undefined) => [val != null ? `${val} pedidos` : "", "Quantidade"]}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-3 mt-3 justify-center">
                {mixParaPie.map((s) => (
                  <span
                    key={s.name}
                    className="inline-flex items-center gap-1.5 text-xs"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: s.fill }}
                    />
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Gráfico Lucro Mensal (barras) */}
          {lucroMensal.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">
                Lucro mensal (últimos 12 meses)
              </h3>
              <div className="h-[220px] min-h-[220px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minHeight={220}>
                  <BarChart
                    data={lucroMensal}
                    margin={{ top: 5, right: 5, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => v.split("/")[0]}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) =>
                        v >= 1000 ? `${v / 1000}k` : String(v)
                      }
                    />
                    <Tooltip
                      formatter={(val: number | undefined) => [val != null ? formatMoney(val) : "", "Lucro"]}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                      }}
                      labelFormatter={(l) => `Mês: ${l}`}
                    />
                    <Bar
                      dataKey="valor"
                      fill="#6366f1"
                      radius={[4, 4, 0, 0]}
                      name="Lucro"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Peças por tipo */}
          {pecasPorTipo.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-4">
                Peças entregues por tipo
              </h3>
              <div className="space-y-2">
                {pecasPorTipo.map((p) => {
                  const ticketMedio = p.quantidade > 0 ? p.valor / p.quantidade : 0;
                  return (
                    <div
                      key={p.tipo}
                      className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
                    >
                      <span className="text-sm text-gray-700">{p.tipo}</span>
                      <div className="text-right">
                        <span className="text-sm font-medium text-gray-900">
                          {p.quantidade} un.
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          {formatMoney(p.valor)}
                        </span>
                        {ticketMedio > 0 && (
                          <span className="text-[11px] text-gray-400 ml-1.5">
                            · {formatMoney(ticketMedio)}/un
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!loading &&
            mixParaPie.length === 0 &&
            lucroMensal.length === 0 &&
            pecasPorTipo.length === 0 && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center text-gray-500 text-sm">
                Nenhum dado disponível para este mês.
              </div>
            )}
        </>
      )}
    </div>
  );
}
