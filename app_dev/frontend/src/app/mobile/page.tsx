"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Loader2,
  Clock,
  Package,
  DollarSign,
  Percent,
  ChevronDown,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MonthScrollPicker } from "@/components/mobile/month-scroll-picker";
import { YearScrollPicker } from "@/components/mobile/year-scroll-picker";
import { YTDToggle, PeriodView } from "@/components/mobile/ytd-toggle";

const MobileDashboardCharts = dynamic(
  () => import("@/components/mobile/mobile-dashboard-charts").then((m) => m.MobileDashboardCharts),
  { ssr: false }
);

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

interface PlanoVsRealizadoItem {
  tipo_item: string;
  detalhe: string | null;
  valor_planejado: number;
  valor_realizado: number;
  status: string;
}

interface PlanoVsRealizado {
  anomes: string;
  receita_planejada: number;
  receita_realizada: number;
  despesas_planejadas: number;
  despesas_realizadas: number;
  lucro_planejado: number;
  lucro_realizado: number;
  percentual_atingimento: number;
  itens_receita: PlanoVsRealizadoItem[];
  itens_despesas: PlanoVsRealizadoItem[];
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

const GOAL_COLORS = [
  "#001D39", "#0A4174", "#2D5A7B", "#49769F", "#4E8EA2",
  "#5E9AB0", "#6EA2B3", "#7BBDE8", "#9AC9E8", "#BDD8E9", "#D4E8F0",
];
function getGoalColor(nome: string, index: number): string {
  const hash = nome.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const idx = (hash + index) % GOAL_COLORS.length;
  return GOAL_COLORS[Math.abs(idx)];
}

export default function PainelPage() {
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
  const [planoVsRealizado, setPlanoVsRealizado] = useState<PlanoVsRealizado | null>(null);
  const [planoTabAtiva, setPlanoTabAtiva] = useState<"receitas" | "despesas">("receitas");

  const handleError = () => {
    setKpis(null);
    setMixStatus([]);
    setLucroMensal([]);
    setLucroPorAno([]);
    setLucroPorAnoTotal([]);
    setPecasPorTipo([]);
    setPlanoVsRealizado(null);
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
      const planoUrl = `${API_URL}/api/v1/plano/plano-vs-realizado?mes=${mesParam}`;
      Promise.all([
        fetchWithTimeout(kpisUrl),
        fetchWithTimeout(mixUrl),
        fetchWithTimeout(lucroUrl),
        fetchWithTimeout(pecasUrl),
        fetchWithTimeout(planoUrl).catch(() => null),
      ])
        .then(([k, m, l, p, plano]) => {
          setKpis(k);
          setMixStatus(m);
          setLucroMensal(l);
          setPecasPorTipo(p);
          setLucroPorAno([]);
          setLucroPorAnoTotal([]);
          setPlanoVsRealizado(plano);
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

          {/* Card Plano vs Realizado - layout ProjetoFinancasV5 (Despesas vs Plano / Rendimentos) */}
          {period === "month" && planoVsRealizado &&
            (planoVsRealizado.itens_receita.length > 0 || planoVsRealizado.itens_despesas.length > 0) && (
            <Collapsible defaultOpen={false} className="group rounded-xl border border-gray-200 bg-gray-50 overflow-hidden mb-6">
              <CollapsibleTrigger className="w-full p-4 hover:bg-gray-100 transition-colors text-left">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Lucro realizado do plano</h3>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Orçado: {formatMoney(planoVsRealizado.lucro_planejado)} ·{" "}
                      {planoVsRealizado.lucro_planejado !== 0
                        ? planoVsRealizado.lucro_realizado >= planoVsRealizado.lucro_planejado
                          ? `Acima ${formatMoney(planoVsRealizado.lucro_realizado - planoVsRealizado.lucro_planejado)}`
                          : `Abaixo ${formatMoney(planoVsRealizado.lucro_planejado - planoVsRealizado.lucro_realizado)}`
                        : "Sem plano definido"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-sm font-bold ${
                        planoVsRealizado.lucro_realizado >= 0 ? "text-emerald-600" : "text-red-500"
                      }`}
                    >
                      {formatMoney(planoVsRealizado.lucro_realizado)}
                    </span>
                    <ChevronDown className="w-5 h-5 text-gray-400 group-data-[state=open]:rotate-180 transition-transform" />
                  </div>
                </div>
                {/* Barra preta: preenchida com lucro (receitas - custos), sempre visível */}
                <div className="mt-2">
                  <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden relative">
                    <div
                      className="h-full rounded-full bg-gray-900 transition-all"
                      style={{
                        width: (() => {
                          const p = planoVsRealizado.lucro_planejado;
                          const r = planoVsRealizado.lucro_realizado;
                          if (p > 0) {
                            return `${Math.max(0, Math.min(120, (r / p) * 100))}%`;
                          }
                          if (p < 0) {
                            const range = 0 - p;
                            const pos = r - p;
                            return `${Math.max(0, Math.min(120, (pos / range) * 100))}%`;
                          }
                          return "0%";
                        })(),
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] text-gray-400">
                      {planoVsRealizado.lucro_planejado >= 0 ? "R$ 0" : formatMoney(planoVsRealizado.lucro_planejado)}
                    </span>
                    <span className="text-[9px] text-gray-400">
                      {planoVsRealizado.lucro_planejado >= 0 ? formatMoney(planoVsRealizado.lucro_planejado) : "R$ 0"}
                    </span>
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4">
                {/* Abas Receitas | Despesas */}
                <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-4 mt-2">
                  <button
                    onClick={() => setPlanoTabAtiva("receitas")}
                    className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${
                      planoTabAtiva === "receitas" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                    }`}
                  >
                    Receitas
                  </button>
                  <button
                    onClick={() => setPlanoTabAtiva("despesas")}
                    className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${
                      planoTabAtiva === "despesas" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                    }`}
                  >
                    Despesas
                  </button>
                </div>
                {/* Lista estilo V5 */}
                {planoTabAtiva === "receitas" && (
                  <div className="space-y-3.5">
                    {planoVsRealizado.itens_receita
                      .filter((i) => i.valor_planejado > 0 || i.valor_realizado > 0)
                      .map((i, idx) => {
                        const diff = i.valor_realizado - i.valor_planejado;
                        const pct = i.valor_planejado > 0 ? (i.valor_realizado / i.valor_planejado) * 100 : 0;
                        const highlightText = diff >= 0 ? `+${formatMoney(diff)}` : `-${formatMoney(-diff)}`;
                        const highlightClass =
                          diff > 0 ? "text-emerald-600 font-semibold" : diff < 0 ? "text-red-500 font-semibold" : "text-gray-500 font-medium";
                        const color = getGoalColor(i.tipo_item, idx);
                        return (
                          <div key={idx}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2 shrink-0 min-w-0">
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                <span className="text-sm text-gray-800 truncate">
                                  {i.tipo_item}
                                  {i.detalhe ? ` (${i.detalhe})` : ""}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                                <span className={`text-xs ${highlightClass}`}>{highlightText}</span>
                                <span className="text-sm font-semibold text-gray-900">{formatMoney(i.valor_realizado)}</span>
                                <span className="text-[9px] text-gray-400">/ {formatMoney(i.valor_planejado)}</span>
                              </div>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(pct, 100)}%`,
                                  backgroundColor: diff >= 0 ? color : "#f87171",
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    {planoVsRealizado.itens_receita.filter((i) => i.valor_planejado > 0 || i.valor_realizado > 0).length === 0 && (
                      <p className="text-xs text-gray-400 py-2">Sem receitas no período</p>
                    )}
                  </div>
                )}
                {planoTabAtiva === "despesas" && (
                  <div className="space-y-3.5">
                    {planoVsRealizado.itens_despesas
                      .filter((i) => i.valor_planejado > 0 || i.valor_realizado > 0)
                      .map((i, idx) => {
                        const diff = i.valor_realizado - i.valor_planejado;
                        const pct = i.valor_planejado > 0 ? (i.valor_realizado / i.valor_planejado) * 100 : 0;
                        const isOver = i.valor_realizado > i.valor_planejado;
                        const highlightText = diff >= 0 ? `+${formatMoney(diff)}` : `-${formatMoney(-diff)}`;
                        const highlightClass =
                          diff > 0 ? "text-red-500 font-semibold" : diff < 0 ? "text-emerald-600 font-semibold" : "text-gray-500 font-medium";
                        const color = getGoalColor(i.detalhe || i.tipo_item, idx);
                        return (
                          <div key={idx}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2 shrink-0 min-w-0">
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                <span className="text-sm text-gray-800 truncate">{i.detalhe || i.tipo_item}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                                <span className={`text-xs ${highlightClass}`}>{highlightText}</span>
                                <span className="text-sm font-semibold text-gray-900">{formatMoney(i.valor_realizado)}</span>
                                <span className="text-[9px] text-gray-400">/ {formatMoney(i.valor_planejado)}</span>
                              </div>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(pct, 100)}%`,
                                  backgroundColor: isOver ? "#f87171" : color,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    {planoVsRealizado.itens_despesas.filter((i) => i.valor_planejado > 0 || i.valor_realizado > 0).length === 0 && (
                      <p className="text-xs text-gray-400 py-2">Sem despesas no período</p>
                    )}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          <MobileDashboardCharts
            period={period}
            lucroMensal={lucroMensal}
            chartDataYTD={chartDataYTD}
            chartDataYTDClosed={chartDataYTDClosed}
            chartDataAno={chartDataAno}
            lucroPorAnoOrdenado={lucroPorAnoOrdenado}
            mixParaPie={mixParaPie}
          />

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
