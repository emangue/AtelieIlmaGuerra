"use client";

import React, { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MonthScrollPicker } from "@/components/mobile/month-scroll-picker";
import { YearScrollPicker } from "@/components/mobile/year-scroll-picker";
import { YTDToggle, PeriodView } from "@/components/mobile/ytd-toggle";
import { Plus, Loader2, ChevronDown, TrendingUp, CreditCard, X, Copy, Search } from "lucide-react";
import { cn } from "@/lib/utils";

function mesLabel(anomes: string): string {
  const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const m = parseInt(anomes.slice(4), 10);
  return MESES[m - 1] ?? anomes;
}

const ChartComparacaoMensal = dynamic(
  () => import("@/components/mobile/chart-comparacao-mensal").then((m) => m.ChartComparacaoMensal),
  { ssr: false }
);

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

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

interface EvolucaoMensalItem {
  anomes: string;
  label: string;
  receita_planejada: number;
  receita_realizada: number;
}

interface PedidoEntregueItem {
  id: number;
  tipo_pedido_nome: string;
  valor_pecas: number;
  data_entrega: string;
  cliente_nome: string;
}

interface DespesaRealizadaItem {
  id: number;
  tipo_item: string;
  detalhe: string | null;
  valor_realizado: number;
  categoria: string;
}

const CATEGORIAS = ["Custo Variável", "Custo Fixo"];
const TIPOS_DESPESA = ["Colaboradores", "Espaço Físico", "Marketing", "Transporte", "Maquinário", "Outros"];
const TIPOS_RECEITA = ["Vestido Noiva", "Vestido Festa", "Ajustes", "Peça Casual", "Outros"];

const GOAL_COLORS = [
  "#001D39", "#0A4174", "#2D5A7B", "#49769F", "#4E8EA2",
  "#5E9AB0", "#6EA2B3", "#7BBDE8", "#9AC9E8", "#BDD8E9", "#D4E8F0",
];
function getGoalColor(nome: string, index: number): string {
  const hash = nome.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const idx = (hash + index) % GOAL_COLORS.length;
  return GOAL_COLORS[Math.abs(idx)];
}

function formatMoney(val: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

export default function FinanceiroPage() {
  const hoje = new Date();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [selectedYear, setSelectedYear] = useState<number>(hoje.getFullYear());
  const [period, setPeriod] = useState<PeriodView>("month");
  const [loading, setLoading] = useState(true);
  const [planoVsRealizado, setPlanoVsRealizado] = useState<PlanoVsRealizado | null>(null);
  const [evolucaoMensal, setEvolucaoMensal] = useState<EvolucaoMensalItem[]>([]);
  const [pedidosEntregues, setPedidosEntregues] = useState<PedidoEntregueItem[]>([]);
  const [despesasRealizadas, setDespesasRealizadas] = useState<DespesaRealizadaItem[]>([]);
  const [planoTabAtiva, setPlanoTabAtiva] = useState<"receitas" | "despesas">("receitas");
  const [busca, setBusca] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);

  const [formModo, setFormModo] = useState<"plano" | "realizado">("realizado");
  const [formTipo, setFormTipo] = useState<"receita" | "despesa">("despesa");
  const [formTipoItem, setFormTipoItem] = useState("Outros");
  const [formCategoria, setFormCategoria] = useState("Custo Fixo");
  const [formDetalhe, setFormDetalhe] = useState("");
  const [formValor, setFormValor] = useState("");
  const [detalhes, setDetalhes] = useState<string[]>([]);
  const [showCustomDetalhe, setShowCustomDetalhe] = useState(false);

  const ano = selectedMonth.getFullYear();
  const mes = selectedMonth.getMonth() + 1;
  const mesParam = `${ano}${mes.toString().padStart(2, "0")}`;

  const mesAnteriorParam = (() => {
    const d = new Date(selectedMonth);
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, "0")}`;
  })();

  const mesProximoParam = (() => {
    const d = new Date(selectedMonth);
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    return `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, "0")}`;
  })();

  const fetchPlano = useCallback(() => {
    if (period !== "month") return;
    setLoading(true);
    Promise.all([
      fetch(`${API_URL}/api/v1/plano/plano-vs-realizado?mes=${mesParam}`).then((res) => res.json()),
      fetch(`${API_URL}/api/v1/plano/evolucao-mensal?mes=${mesParam}&meses=7`).then((res) => res.json()),
      fetch(`${API_URL}/api/v1/pedidos/entregues?mes=${mesParam}`).then((res) => res.json()),
      fetch(`${API_URL}/api/v1/plano/despesas-realizadas?mes=${mesParam}`).then((res) => res.json()),
    ])
      .then(([plano, evolucao, pedidos, despesas]: [PlanoVsRealizado, EvolucaoMensalItem[], PedidoEntregueItem[], DespesaRealizadaItem[]]) => {
        setPlanoVsRealizado(plano);
        setEvolucaoMensal(evolucao || []);
        setPedidosEntregues(pedidos || []);
        setDespesasRealizadas(despesas || []);
      })
      .catch(() => {
        setPlanoVsRealizado(null);
        setEvolucaoMensal([]);
        setPedidosEntregues([]);
        setDespesasRealizadas([]);
      })
      .finally(() => setLoading(false));
  }, [period, mesParam]);

  useEffect(() => {
    fetchPlano();
  }, [fetchPlano]);

  // Carrega detalhes quando o form abre ou o tipo muda
  useEffect(() => {
    if (!showForm) return;
    fetch(`${API_URL}/api/v1/plano/detalhes?tipo=${formTipo}`)
      .then((res) => res.json())
      .then((data) => setDetalhes(Array.isArray(data) ? data : []))
      .catch(() => setDetalhes([]));
  }, [showForm, formTipo]);

  const openForm = () => {
    setFormModo("realizado");
    setFormTipo("despesa");
    setFormTipoItem("Outros");
    setFormCategoria("Custo Fixo");
    setFormDetalhe("");
    setFormValor("");
    setShowCustomDetalhe(false);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setShowCustomDetalhe(false);
    setFormDetalhe("");
    setFormValor("");
  };

  const copiarMes = async (mesOrigem: string) => {
    setCopying(true);
    try {
      const res = await fetch(
        `${API_URL}/api/v1/plano/copiar-mes?mes_origem=${mesOrigem}&mes_destino=${mesParam}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert((err as { detail?: string }).detail || "Erro ao copiar o mês");
        return;
      }
      fetchPlano();
    } catch {
      alert("Erro ao copiar o mês");
    } finally {
      setCopying(false);
    }
  };

  const isEmptyMonth =
    !loading &&
    planoVsRealizado !== null &&
    planoVsRealizado.itens_receita.length === 0 &&
    planoVsRealizado.itens_despesas.length === 0 &&
    pedidosEntregues.length === 0 &&
    despesasRealizadas.length === 0;

  const handleSubmitNovo = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(formValor.replace(",", "."));
    if (isNaN(v) || v < 0) return;
    setSaving(true);
    try {
      const payload = {
        anomes: mesParam,
        tipo: formTipo,
        tipo_item: formTipoItem,
        categoria: formTipo === "despesa" ? formCategoria : "Receita",
        detalhe: formDetalhe.trim() || null,
        valor_planejado: formModo === "plano" ? v : 0,
        valor_realizado: formModo === "realizado" ? v : null,
      };
      const res = await fetch(`${API_URL}/api/v1/plano`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Erro");
      closeForm();
      fetchPlano();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const selectClass = "flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1";

  return (
    <div className="pb-24">
      {/* Header: scroll + toggle 4 opções (igual painel) */}
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
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : period !== "month" ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center text-gray-500">
            <p>Selecione &quot;Mês&quot; no toggle para ver o plano vs realizado</p>
          </div>
        ) : (
          <>
            {/* Estado vazio: sem dados para o mês */}
            {isEmptyMonth && (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center mb-6">
                <p className="text-sm font-medium text-gray-700 mb-1">Nenhum dado para este mês</p>
                <p className="text-xs text-gray-400 mb-5">Copiar plano financeiro de:</p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => copiarMes(mesAnteriorParam)}
                    disabled={copying}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 shadow-sm transition"
                  >
                    {copying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                    ← {mesLabel(mesAnteriorParam)}
                  </button>
                  <button
                    onClick={() => copiarMes(mesProximoParam)}
                    disabled={copying}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 shadow-sm transition"
                  >
                    {copying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                    {mesLabel(mesProximoParam)} →
                  </button>
                </div>
              </div>
            )}

            {/* Resumo do Mês */}
            {planoVsRealizado && (
              <div className="rounded-xl border border-gray-200 bg-white p-4 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900">Resumo do Mês</h3>
                  <span
                    className={cn(
                      "text-xs font-medium px-2.5 py-1 rounded-full",
                      planoVsRealizado.lucro_realizado >= (planoVsRealizado.lucro_planejado || 0)
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-800"
                    )}
                  >
                    {planoVsRealizado.lucro_realizado >= (planoVsRealizado.lucro_planejado || 0)
                      ? "Acima do plano"
                      : "Abaixo do plano"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 divide-x divide-gray-200">
                  <div className="pr-3">
                    <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Receitas</p>
                    <p className="text-base font-bold text-emerald-600">
                      {formatMoney(planoVsRealizado.receita_realizada)}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {planoVsRealizado.receita_planejada <= 0
                        ? "sem plano"
                        : planoVsRealizado.receita_realizada >= planoVsRealizado.receita_planejada
                          ? `Acima ${formatMoney(planoVsRealizado.receita_realizada - planoVsRealizado.receita_planejada)}`
                          : `Abaixo ${formatMoney(planoVsRealizado.receita_planejada - planoVsRealizado.receita_realizada)}`}
                    </p>
                  </div>
                  <div className="px-3">
                    <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Despesas</p>
                    <p className="text-base font-bold text-red-600">
                      {formatMoney(planoVsRealizado.despesas_realizadas)}
                    </p>
                    <p
                      className={cn(
                        "text-[10px] mt-0.5",
                        planoVsRealizado.despesas_realizadas > planoVsRealizado.despesas_planejadas
                          ? "text-red-600"
                          : "text-gray-500"
                      )}
                    >
                      {planoVsRealizado.despesas_planejadas <= 0
                        ? "sem plano"
                        : planoVsRealizado.despesas_realizadas > planoVsRealizado.despesas_planejadas
                          ? `${formatMoney(planoVsRealizado.despesas_realizadas - planoVsRealizado.despesas_planejadas)} acima`
                          : `${formatMoney(planoVsRealizado.despesas_planejadas - planoVsRealizado.despesas_realizadas)} abaixo`}
                    </p>
                  </div>
                  <div className="pl-3">
                    <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Lucro</p>
                    <p
                      className={cn(
                        "text-base font-bold",
                        planoVsRealizado.lucro_realizado >= 0 ? "text-emerald-600" : "text-red-600"
                      )}
                    >
                      {formatMoney(planoVsRealizado.lucro_realizado)}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {planoVsRealizado.lucro_planejado !== 0
                        ? `${planoVsRealizado.percentual_atingimento.toFixed(0)}% do plano`
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Gráfico Comparação Mensal */}
            {evolucaoMensal.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-4 mb-6 overflow-hidden">
                <h3 className="text-sm font-medium text-gray-700 mb-4">Comparação Mensal</h3>
                <ChartComparacaoMensal data={evolucaoMensal} />
              </div>
            )}

            {/* Card Lucro realizado do plano (collapse) */}
            {planoVsRealizado &&
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
                  <div className="mt-2">
                    <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden relative">
                      <div
                        className="h-full rounded-full bg-gray-900 transition-all"
                        style={{
                          width: (() => {
                            const p = planoVsRealizado.lucro_planejado;
                            const r = planoVsRealizado.lucro_realizado;
                            if (p > 0) return `${Math.max(0, Math.min(120, (r / p) * 100))}%`;
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
                  {/* Toggle Receitas | Despesas */}
                  <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-4 mt-2">
                    <button
                      onClick={() => setPlanoTabAtiva("receitas")}
                      className={cn(
                        "flex-1 py-2 rounded-md text-sm font-semibold transition",
                        planoTabAtiva === "receitas" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                      )}
                    >
                      Receitas
                    </button>
                    <button
                      onClick={() => setPlanoTabAtiva("despesas")}
                      className={cn(
                        "flex-1 py-2 rounded-md text-sm font-semibold transition",
                        planoTabAtiva === "despesas" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                      )}
                    >
                      Despesas
                    </button>
                  </div>
                  {/* Lista estilo V5 com barras */}
                  {planoTabAtiva === "receitas" && (
                    <div className="space-y-3.5">
                      {planoVsRealizado.itens_receita
                        .filter((i) => i.valor_planejado > 0 || i.valor_realizado > 0)
                        .map((i, idx) => {
                          const diff = i.valor_realizado - i.valor_planejado;
                          const pct = i.valor_planejado > 0 ? (i.valor_realizado / i.valor_planejado) * 100 : 0;
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
                                  <span className={cn("text-xs", diff >= 0 ? "text-emerald-600 font-semibold" : "text-red-500 font-semibold")}>
                                    {diff >= 0 ? `+${formatMoney(diff)}` : `-${formatMoney(-diff)}`}
                                  </span>
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
                          const color = getGoalColor(i.detalhe || i.tipo_item, idx);
                          return (
                            <div key={idx}>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2 shrink-0 min-w-0">
                                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                  <span className="text-sm text-gray-800 truncate">{i.detalhe || i.tipo_item}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                                  <span className={cn("text-xs", diff > 0 ? "text-red-500 font-semibold" : "text-emerald-600 font-semibold")}>
                                    {diff >= 0 ? `+${formatMoney(diff)}` : `-${formatMoney(-diff)}`}
                                  </span>
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

            {/* Transações - pedidos entregues do mês + despesas realizadas do plano */}
            {(pedidosEntregues.length > 0 || despesasRealizadas.length > 0) && (
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden mb-6">
                {/* Header + barra de busca */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-bold text-gray-900 mb-2">Transações</h3>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar por nome, data, peça..."
                      className="w-full pl-9 pr-3 h-9 rounded-lg border border-gray-200 bg-gray-50 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                    />
                    {busca && (
                      <button
                        onClick={() => setBusca("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {(() => {
                    const q = busca.toLowerCase().trim();
                    const pedidosFiltrados = pedidosEntregues.filter((p) => {
                      if (!q) return true;
                      return (
                        p.cliente_nome?.toLowerCase().includes(q) ||
                        p.tipo_pedido_nome?.toLowerCase().includes(q) ||
                        p.data_entrega?.includes(q)
                      );
                    });
                    const despesasFiltradas = despesasRealizadas.filter((i) => {
                      if (!q) return true;
                      return (
                        i.detalhe?.toLowerCase().includes(q) ||
                        i.tipo_item?.toLowerCase().includes(q) ||
                        i.categoria?.toLowerCase().includes(q)
                      );
                    });

                    const porData = pedidosFiltrados.reduce<Record<string, PedidoEntregueItem[]>>((acc, p) => {
                      const d = p.data_entrega || "";
                      if (!acc[d]) acc[d] = [];
                      acc[d].push(p);
                      return acc;
                    }, {});
                    // Ordenar do mais recente para o mais antigo
                    const datasOrdenadas = Object.keys(porData).sort().reverse();

                    const semResultados = datasOrdenadas.length === 0 && despesasFiltradas.length === 0;

                    return (
                      <>
                        {semResultados && (
                          <p className="text-xs text-gray-400 px-4 py-5 text-center">
                            Nenhuma transação encontrada para &quot;{busca}&quot;
                          </p>
                        )}
                        {datasOrdenadas.map((dataStr) => (
                          <div key={dataStr}>
                            <p className="text-xs text-gray-500 px-4 pt-3 pb-1">
                              {dataStr ? (() => {
                                try {
                                  const d = new Date(dataStr);
                                  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
                                } catch {
                                  return dataStr;
                                }
                              })() : "Sem data"}
                            </p>
                            {porData[dataStr].map((p) => (
                              <div key={`ped-${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50">
                                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 truncate">
                                    {p.tipo_pedido_nome}
                                    {p.cliente_nome ? ` · ${p.cliente_nome}` : ""}
                                  </p>
                                  <p className="text-xs text-gray-500">Receitas</p>
                                </div>
                                <span className="text-sm font-semibold text-emerald-600 shrink-0">
                                  +{formatMoney(p.valor_pecas)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ))}
                        {despesasFiltradas.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 px-4 pt-3 pb-1">Despesas</p>
                            {despesasFiltradas.map((i) => (
                              <div key={`desp-${i.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50">
                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                  <CreditCard className="w-5 h-5 text-gray-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 truncate">
                                    {i.detalhe || i.tipo_item}
                                  </p>
                                  <p className="text-xs text-gray-500">{i.tipo_item}</p>
                                </div>
                                <span className="text-sm font-semibold text-red-600 shrink-0">
                                  -{formatMoney(i.valor_realizado)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

          </>
        )}
      </div>

      {/* FAB + flutuante */}
      {period === "month" && !showForm && (
        <button
          onClick={openForm}
          className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg hover:bg-blue-700 active:scale-95 transition-transform"
          aria-label="Adicionar receita ou despesa"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* ── Bottom Sheet: Adicionar receita/despesa ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={closeForm} />

          {/* Sheet */}
          <div className="relative w-full bg-white rounded-t-2xl max-h-[92vh] flex flex-col shadow-2xl">
            {/* Handle visual */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 shrink-0">
              <h3 className="text-base font-semibold text-gray-900">Adicionar receita ou despesa</h3>
              <button
                onClick={closeForm}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Formulário com scroll */}
            <form onSubmit={handleSubmitNovo} className="overflow-y-auto flex-1 flex flex-col">
              <div className="px-4 py-4 space-y-4 flex-1">
              {/* Modo: plano ou realizado */}
              <div>
                <Label>Adicionar como</Label>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setFormModo("plano")}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-sm font-medium border transition",
                      formModo === "plano"
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    )}
                  >
                    Novo tema no plano
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormModo("realizado")}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-sm font-medium border transition",
                      formModo === "realizado"
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    )}
                  >
                    Valor realizado
                  </button>
                </div>
              </div>

              {/* Tipo: receita ou despesa */}
              <div>
                <Label>Tipo</Label>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => { setFormTipo("receita"); setFormTipoItem("Outros"); }}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-sm font-medium border transition",
                      formTipo === "receita"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-white text-gray-600 border-gray-200"
                    )}
                  >
                    Receita
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFormTipo("despesa"); setFormTipoItem("Outros"); }}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-sm font-medium border transition",
                      formTipo === "despesa"
                        ? "bg-red-50 text-red-700 border-red-300"
                        : "bg-white text-gray-600 border-gray-200"
                    )}
                  >
                    Despesa
                  </button>
                </div>
              </div>

              {/* Tipo item */}
              <div>
                <Label>{formTipo === "receita" ? "Tipo de receita" : "Tipo de despesa"} *</Label>
                <select
                  value={formTipoItem}
                  onChange={(e) => setFormTipoItem(e.target.value)}
                  className={cn(selectClass, "mt-1")}
                  required
                >
                  {(formTipo === "receita" ? TIPOS_RECEITA : TIPOS_DESPESA).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Categoria (só para despesa) */}
              {formTipo === "despesa" && (
                <div>
                  <Label>Categoria</Label>
                  <select
                    value={formCategoria}
                    onChange={(e) => setFormCategoria(e.target.value)}
                    className={cn(selectClass, "mt-1")}
                  >
                    {CATEGORIAS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Detalhe: dropdown com opção de adicionar novo */}
              <div>
                <Label>Detalhe (ex: Esli, Aluguel)</Label>
                <div className="flex gap-2 mt-1">
                  {showCustomDetalhe ? (
                    <>
                      <Input
                        value={formDetalhe}
                        onChange={(e) => setFormDetalhe(e.target.value)}
                        placeholder="Digite o novo detalhe..."
                        className="flex-1"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => { setShowCustomDetalhe(false); setFormDetalhe(""); }}
                        className="w-10 h-10 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 shrink-0 transition"
                        title="Cancelar novo detalhe"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <select
                        value={formDetalhe}
                        onChange={(e) => setFormDetalhe(e.target.value)}
                        className={cn(selectClass, "flex-1")}
                      >
                        <option value="">— Opcional —</option>
                        {detalhes.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => { setShowCustomDetalhe(true); setFormDetalhe(""); }}
                        className="w-10 h-10 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-700 hover:bg-gray-50 shrink-0 transition"
                        title="Adicionar novo detalhe"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
                {showCustomDetalhe && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    Novo detalhe — ficará disponível para seleção em lançamentos futuros
                  </p>
                )}
              </div>

              {/* Valor */}
              <div>
                <Label>Valor (R$) *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formValor}
                  onChange={(e) => setFormValor(e.target.value)}
                  placeholder="0,00"
                  required
                  className="mt-1"
                />
              </div>

              </div>
              {/* Botões — sticky no rodapé do sheet */}
              <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3 flex gap-2">
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar
                </Button>
                <Button type="button" variant="outline" onClick={closeForm}>
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
