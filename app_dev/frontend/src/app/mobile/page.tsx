"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  TrendingUp,
  Clock,
  Package,
  DollarSign,
  Percent,
} from "lucide-react";
import { MonthScrollPicker } from "@/components/mobile/month-scroll-picker";
import { YearScrollPicker } from "@/components/mobile/year-scroll-picker";
import { YTDToggle, PeriodView } from "@/components/mobile/ytd-toggle";
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
  LabelList,
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
  const router = useRouter();
  const hoje = new Date();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [selectedYear, setSelectedYear] = useState<number>(hoje.getFullYear());
  const [period, setPeriod] = useState<PeriodView>("month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [mixStatus, setMixStatus] = useState<MixStatus[]>([]);
  const [lucroMensal, setLucroMensal] = useState<LucroMensal[]>([]);
  const [lucroPorAno, setLucroPorAno] = useState<{ ano: number; dados: LucroMensal[] }[]>([]);
  const [lucroPorAnoTotal, setLucroPorAnoTotal] = useState<{ ano: number; valor: number }[]>([]);
  const [pecasPorTipo, setPecasPorTipo] = useState<PecasPorTipo[]>([]);

  const handleError = () => {
    setKpis(null);
    setMixStatus([]);
    setLucroMensal([]);
    setLucroPorAno([]);
    setLucroPorAnoTotal([]);
    setPecasPorTipo([]);
    setError("Não foi possível carregar. Verifique se o backend está rodando (porta 8000).");
  };

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
    const isMonth = period === "month";
    const isYearBased = period === "ytd" || period === "year" || period === "ytd-closed";
    const anoRef = isYearBased ? selectedYear : ano;
    const kpisUrl = isMonth
      ? `${API_URL}/api/v1/dashboard/kpis?mes=${mesParam}`
      : `${API_URL}/api/v1/dashboard/kpis?year=${anoRef}`;
    const mixUrl = isMonth
      ? `${API_URL}/api/v1/dashboard/mix-status?mes=${mesParam}`
      : `${API_URL}/api/v1/dashboard/mix-status?year=${anoRef}`;
    const pecasUrl = isMonth
      ? `${API_URL}/api/v1/dashboard/pecas-por-tipo?mes=${mesParam}`
      : `${API_URL}/api/v1/dashboard/pecas-por-tipo?year=${anoRef}`;

    if (isMonth) {
      const lucroUrl = `${API_URL}/api/v1/dashboard/lucro-mensal?meses=12`;
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
          setLucroPorAno([]);
          setLucroPorAnoTotal([]);
        })
        .catch(handleError)
        .finally(() => setLoading(false));
    } else {
      // YTD, Ano ou YTD-closed: buscar lucro de 3 anos
      const anosParaBuscar = [anoRef, anoRef - 1, anoRef - 2].filter((y) => y >= 2020);
      Promise.all([
        fetchWithTimeout(kpisUrl),
        fetchWithTimeout(mixUrl),
        fetchWithTimeout(pecasUrl),
        ...anosParaBuscar.map((y) =>
          fetchWithTimeout(`${API_URL}/api/v1/dashboard/lucro-mensal?meses=12&year=${y}`)
        ),
      ])
        .then((results) => {
          const [k, m, p, ...lucrosPorAno] = results;
          setKpis(k);
          setMixStatus(m);
          setPecasPorTipo(p);
          setLucroPorAno(
            anosParaBuscar.map((y, i) => ({
              ano: y,
              dados: lucrosPorAno[i] as LucroMensal[],
            }))
          );
          setLucroMensal([]);
          // Para visão Ano: totais por ano
          setLucroPorAnoTotal(
            anosParaBuscar.map((y, i) => {
              const dados = lucrosPorAno[i] as LucroMensal[];
              const total = dados?.reduce((s, d) => s + (d?.valor ?? 0), 0) ?? 0;
              return { ano: y, valor: total };
            })
          );
        })
        .catch(handleError)
        .finally(() => setLoading(false));
    }
  }, [mesParam, ano, period, selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const mixParaPie = mixStatus.map((s) => ({
    name: s.status,
    value: s.quantidade,
    fill: getCorStatus(s.status),
  }));

  const MESES_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const CORES_ANOS: Record<number, string> = {
    2026: "#6366f1",
    2025: "#3b82f6",
    2024: "#94a3b8",
    2023: "#64748b",
    2022: "#475569",
  };
  const mesAtual = hoje.getMonth(); // 0-11
  const lucroPorAnoOrdenado = useMemo(
    () => [...lucroPorAno].sort((a, b) => a.ano - b.ano),
    [lucroPorAno]
  );
  const chartDataYTD = useMemo(() => {
    if (lucroPorAno.length === 0) return [];
    const result: { mes: string; label: string; [ano: string]: string | number }[] = [];
    for (let i = 0; i < 12; i++) {
      const row: { mes: string; label: string; [ano: string]: string | number } = {
        mes: String(i + 1).padStart(2, "0"),
        label: MESES_LABELS[i],
      };
      lucroPorAno.forEach(({ ano, dados }) => {
        const d = dados[i];
        row[String(ano)] = d ? d.valor : 0;
      });
      result.push(row);
    }
    return result;
  }, [lucroPorAno]);

  // YTD fechado: uma barra por ano = faturamento até o mês atual (Jan..mesAtual)
  const chartDataYTDClosed = useMemo(() => {
    if (lucroPorAno.length === 0) return [];
    const até = mesAtual + 1; // 1..12
    return lucroPorAno
      .map(({ ano, dados }) => {
        const total = dados
          .slice(0, até)
          .reduce((s, d) => s + (d?.valor ?? 0), 0);
        return { ano: String(ano), label: String(ano), valor: total };
      })
      .sort((a, b) => Number(a.ano) - Number(b.ano));
  }, [lucroPorAno, mesAtual]);

  // Visão Ano: uma barra por ano (total faturamento - ano completo)
  const chartDataAno = useMemo(() => {
    if (lucroPorAnoTotal.length === 0) return [];
    return lucroPorAnoTotal
      .map(({ ano, valor }) => ({
        ano: String(ano),
        label: String(ano),
        valor,
      }))
      .sort((a, b) => Number(a.ano) - Number(b.ano));
  }, [lucroPorAnoTotal]);

  return (
    <div className="pb-24">
      {/* Seletor de mês/ano + toggle fixos abaixo do header */}
      <div className="sticky top-14 z-40 bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {period === "month" ? (
            <MonthScrollPicker
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
            />
          ) : (
            <YearScrollPicker
              selectedYear={selectedYear}
              onYearChange={setSelectedYear}
            />
          )}
        </div>
        <div className="flex justify-center mt-3">
          <YTDToggle
            value={period}
            onChange={(v) => {
              setPeriod(v);
              if (v !== "month") setSelectedYear(selectedMonth.getFullYear());
            }}
          />
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
                {period === "month" ? "Peças entregues" : "Peças entregues (ano)"}
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {kpis ? kpis.quantidade_entregues : "—"}
              </p>
            </div>

            {/* Margem Mês/Ano */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Percent className="w-4 h-4" />
                {period === "month" ? "Margem mês" : "Margem ano"}
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
                {period === "month"
                  ? "Mix de status (pedidos do mês)"
                  : `Mix de status (pedidos do ano ${selectedYear})`}
              </h3>
              <div className="h-[200px] min-h-[200px] w-full min-w-0">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minHeight={200}
                  initialDimension={{ width: 300, height: 200 }}
                >
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

          {/* Gráfico Lucro / Faturamento (barras) */}
          {(lucroMensal.length > 0 || chartDataYTD.length > 0 || chartDataYTDClosed.length > 0 || chartDataAno.length > 0) && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">
                {period === "month" && "Lucro mensal (últimos 12 meses)"}
                {period === "ytd" && "Faturamento por mês (ano completo)"}
                {period === "ytd-closed" && `Faturamento até ${MESES_LABELS[mesAtual]} (por ano)`}
                {period === "year" && "Faturamento por ano (anos fechados)"}
              </h3>
              <div className="h-[220px] min-h-[220px] w-full min-w-0">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minHeight={220}
                  initialDimension={{ width: 300, height: 220 }}
                >
                  {period === "month" && lucroMensal.length > 0 && (
                    <BarChart
                      data={lucroMensal}
                      margin={{ top: 20, right: 5, left: 5, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => v.split("/")[0]}
                      />
                      <YAxis hide />
                      <Tooltip
                        formatter={(val: number | undefined) => [val != null ? formatMoney(val) : "", "Lucro"]}
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                        labelFormatter={(l) => `Mês: ${l}`}
                      />
                      <Bar
                        dataKey="valor"
                        fill="#6366f1"
                        radius={[4, 4, 0, 0]}
                        name="Lucro"
                        cursor="pointer"
                        onClick={(data) => {
                          if (data?.mes) router.push(`/mobile/pedidos/todos?mes=${data.mes}`);
                        }}
                      >
                        <LabelList
                          position="insideTop"
                          formatter={(val: number) =>
                            val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val)
                          }
                          style={{ fontSize: 10, fill: "white", fontWeight: 600 }}
                        />
                      </Bar>
                    </BarChart>
                  )}
                  {period === "ytd" && chartDataYTD.length > 0 && (
                    <BarChart
                      data={chartDataYTD}
                      margin={{ top: 20, right: 5, left: 5, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis hide />
                      <Tooltip
                        formatter={(val: number | undefined) => [val != null ? formatMoney(val) : "", ""]}
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                        labelFormatter={(l) => `Mês: ${l}`}
                      />
                      {lucroPorAnoOrdenado.map(({ ano }) => (
                        <Bar
                          key={ano}
                          dataKey={String(ano)}
                          fill={CORES_ANOS[ano] ?? "#94a3b8"}
                          radius={[4, 4, 0, 0]}
                          name={String(ano)}
                        >
                          <LabelList
                            position="insideTop"
                            formatter={(val: number) =>
                              val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val > 0 ? String(val) : ""
                            }
                            style={{ fontSize: 9, fill: "white", fontWeight: 600 }}
                          />
                        </Bar>
                      ))}
                    </BarChart>
                  )}
                  {(period === "year" || period === "ytd-closed") &&
                    (period === "year" ? chartDataAno : chartDataYTDClosed).length > 0 && (
                    <BarChart
                      data={period === "year" ? chartDataAno : chartDataYTDClosed}
                      margin={{ top: 20, right: 5, left: 5, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis hide />
                      <Tooltip
                        formatter={(val: number | undefined) => [val != null ? formatMoney(val) : "", "Faturamento"]}
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                        labelFormatter={(l) => `Ano: ${l}`}
                      />
                      <Bar
                        dataKey="valor"
                        fill="#6366f1"
                        radius={[4, 4, 0, 0]}
                        name="Faturamento"
                        cursor="pointer"
                        onClick={(data) => {
                          if (data?.ano) router.push(`/mobile/pedidos/todos?mes=${data.ano}01`);
                        }}
                      >
                        <LabelList
                          position="insideTop"
                          formatter={(val: number) =>
                            val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val)
                          }
                          style={{ fontSize: 10, fill: "white", fontWeight: 600 }}
                        />
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
              {period === "ytd" && lucroPorAnoOrdenado.length > 0 && (
                <div className="flex flex-wrap gap-3 mt-3 justify-center">
                  {lucroPorAnoOrdenado.map(({ ano }) => (
                    <span key={ano} className="inline-flex items-center gap-1.5 text-xs">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: CORES_ANOS[ano] ?? "#94a3b8" }}
                      />
                      {ano}
                    </span>
                  ))}
                </div>
              )}
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
            chartDataYTD.length === 0 &&
            chartDataYTDClosed.length === 0 &&
            chartDataAno.length === 0 &&
            pecasPorTipo.length === 0 && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center text-gray-500 text-sm">
                {period === "month"
                  ? "Nenhum dado disponível para este mês."
                  : "Nenhum dado disponível para este ano."}
              </div>
            )}
        </>
      )}
      </div>
    </div>
  );
}
