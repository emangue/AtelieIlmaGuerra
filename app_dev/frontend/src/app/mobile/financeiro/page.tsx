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
import { Plus, Loader2, ChevronDown, X, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";

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

interface PagamentoItem {
  id: number;
  origem: 'pedido' | 'despesa_manual';
  tipo: 'receita' | 'despesa';
  descricao: string;
  categoria: string;
  tipo_item: string | null;
  detalhe: string | null;
  cat_raw: string | null;
  valor: number;
  data: string | null;
  icon_key: string;
  despesa_id: number | null;
}

interface PagamentosResponse {
  mes: string;
  total_receitas: number;
  total_despesas: number;
  saldo: number;
  itens: PagamentoItem[];
}

interface PedidoSnippet {
  id: number;
  cliente_nome: string;
  tipo_pedido_nome: string | null;
  descricao_produto: string;
  data_pedido: string;
  data_entrega: string | null;
  valor_pecas: number | null;
  status: string;
}

interface DespesaSnippet {
  id: number;
  anomes: string;
  tipo_item: string;
  detalhe: string | null;
  categoria: string;
  data: string;
  valor: number;
  descricao: string | null;
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

const ICON_MAP: Record<string, React.ReactNode> = {
  receita:   <span>↑</span>,
  colab:     <span>👥</span>,
  espaco:    <span>🏠</span>,
  transp:    <span>🚗</span>,
  contas:    <span>💳</span>,
  maq:       <span>🖥</span>,
  marketing: <span>📊</span>,
  outros:    <span>🏷</span>,
};

const COLOR_MAP: Record<string, { bg: string; color: string }> = {
  receita:   { bg: 'rgba(99,122,85,.12)',  color: '#1F4D35' },
  colab:     { bg: 'rgba(99,122,85,.12)',  color: '#637A55' },
  espaco:    { bg: 'rgba(99,122,85,.12)',  color: '#637A55' },
  transp:    { bg: 'rgba(110,74,42,.11)',  color: '#6E4A2A' },
  contas:    { bg: 'rgba(166,138,91,.13)', color: '#A68A5B' },
  maq:       { bg: 'rgba(166,138,91,.13)', color: '#A68A5B' },
  marketing: { bg: 'rgba(51,78,104,.11)',  color: '#334E68' },
  outros:    { bg: 'rgba(122,49,57,.10)',  color: '#7A3139' },
};

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
  const [planoTabAtiva, setPlanoTabAtiva] = useState<"receitas" | "despesas">("receitas");

  // Movimentações
  const [movimentacoes,  setMovimentacoes]  = useState<PagamentoItem[]>([]);
  const [filtroTipo,     setFiltroTipo]     = useState<'todas' | 'receita' | 'despesa'>('todas');
  const [txSelecionada,  setTxSelecionada]  = useState<PagamentoItem | null>(null);
  const [detalheCarregando, setDetalheCarregando] = useState(false);
  const [pedidoDetalhe,  setPedidoDetalhe]  = useState<PedidoSnippet | null>(null);
  const [despesaDetalhe, setDespesaDetalhe] = useState<DespesaSnippet | null>(null);
  const [editValor,      setEditValor]      = useState('');
  const [editData,       setEditData]       = useState('');
  const [editDescricao,  setEditDescricao]  = useState('');
  const [editTipoItem,   setEditTipoItem]   = useState('');
  const [editDetalhe,    setEditDetalhe]    = useState('');
  const [editCategoria,  setEditCategoria]  = useState('Custo Fixo');
  const [salvando,       setSalvando]       = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState(false);

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
  const [editDetalhes, setEditDetalhes] = useState<string[]>([]);
  const [editDetalheCustom, setEditDetalheCustom] = useState(false);

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
    ])
      .then(([plano, evolucao]: [PlanoVsRealizado, EvolucaoMensalItem[]]) => {
        setPlanoVsRealizado(plano);
        setEvolucaoMensal(evolucao || []);
      })
      .catch(() => {
        setPlanoVsRealizado(null);
        setEvolucaoMensal([]);
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

  // Carrega detalhes para o sheet de edição de despesa
  useEffect(() => {
    if (!txSelecionada || txSelecionada.origem !== 'despesa_manual') return;
    fetch(`${API_URL}/api/v1/plano/detalhes?tipo=despesa`)
      .then((res) => res.json())
      .then((data) => setEditDetalhes(Array.isArray(data) ? data : []))
      .catch(() => setEditDetalhes([]));
    setEditDetalheCustom(false);
  }, [txSelecionada]);

  // Busca movimentações unificadas do mês
  useEffect(() => {
    if (period !== 'month') return;
    api.get<PagamentosResponse>(`/api/v1/pagamentos?mes=${mesParam}`)
      .then(data => setMovimentacoes(data.itens))
      .catch(() => setMovimentacoes([]));
  }, [mesParam, period]);

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
    movimentacoes.length === 0;

  const handleSubmitNovo = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(formValor.replace(",", "."));
    if (isNaN(v) || v < 0) return;
    setSaving(true);
    try {
      if (formModo === "realizado" && formTipo === "despesa") {
        // Despesa realizada → tabela despesas (que cria pagamento automaticamente)
        await api.post('/api/v1/despesas', {
          anomes: mesParam,
          tipo_item: formTipoItem,
          detalhe: formDetalhe.trim() || null,
          categoria: formCategoria,
          valor: v,
        });
        // Recarregar movimentações
        const data = await api.get<PagamentosResponse>(`/api/v1/pagamentos?mes=${mesParam}`);
        setMovimentacoes(data.itens);
      } else {
        // Plano ou receita → endpoint antigo
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
      }
      closeForm();
      fetchPlano();
    } catch (err) {
      alert('Erro ao salvar: ' + String(err));
    } finally {
      setSaving(false);
    }
  };

  const selectClass = "flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1";

  // ── Helpers para movimentações ────────────────────────────
  type Grupo = { data: string | null; label: string; itens: PagamentoItem[]; saldoDia: number };

  function formatDateLabel(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
            .replace('.', '').replace(/^\w/, c => c.toUpperCase());
  }

  function agruparPorData(itens: PagamentoItem[]): Grupo[] {
    const map = new Map<string | null, PagamentoItem[]>();
    for (const item of itens) {
      const key = item.data ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    const comData = [...map.entries()]
      .filter(([k]) => k !== null)
      .sort(([a], [b]) => b!.localeCompare(a!));
    const semData = map.has(null) ? [[null, map.get(null)!] as [null, PagamentoItem[]]] : [];
    return [...comData, ...semData].map(([data, its]) => ({
      data,
      label: data ? formatDateLabel(data) : 'Sem data cadastrada',
      itens: its,
      saldoDia: its.reduce((acc, i) => acc + (i.tipo === 'receita' ? i.valor : -i.valor), 0),
    }));
  }

  async function abrirDetalhe(item: PagamentoItem) {
    setTxSelecionada(item);
    setPedidoDetalhe(null);
    setDespesaDetalhe(null);
    setConfirmDelete(false);
    setDetalheCarregando(true);
    try {
      if (item.origem === 'pedido' && item.pedido_id) {
        const p = await api.get<PedidoSnippet>(`/api/v1/pedidos/${item.pedido_id}`);
        setPedidoDetalhe(p);
      } else if (item.origem === 'despesa_manual' && item.despesa_id) {
        const d = await api.get<DespesaSnippet>(`/api/v1/despesas/${item.despesa_id}`);
        setDespesaDetalhe(d);
        setEditTipoItem(d.tipo_item ?? '');
        setEditDetalhe(d.detalhe ?? '');
        setEditCategoria(d.categoria ?? 'Custo Fixo');
        setEditValor(d.valor.toFixed(2).replace('.', ','));
        setEditData(d.data ?? '');
        setEditDescricao(d.descricao ?? '');
      }
    } catch {
      // mantém campos do item da lista como fallback
      setEditTipoItem(item.tipo_item ?? '');
      setEditDetalhe(item.detalhe ?? '');
      setEditCategoria(item.cat_raw ?? 'Custo Fixo');
      setEditValor(item.valor.toFixed(2).replace('.', ','));
      setEditData(item.data ?? '');
      setEditDescricao(item.descricao);
    } finally {
      setDetalheCarregando(false);
    }
  }

  async function handleSalvar() {
    if (!txSelecionada || txSelecionada.origem !== 'despesa_manual') return;
    if (!txSelecionada.despesa_id) return;
    setSalvando(true);
    try {
      await api.patch(`/api/v1/despesas/${txSelecionada.despesa_id}`, {
        tipo_item: editTipoItem || null,
        detalhe: editDetalhe.trim() || null,
        categoria: editCategoria,
        valor: parseFloat(editValor.replace(',', '.')),
        data: editData || null,
        descricao: editDescricao.trim() || null,
      });
      setMovimentacoes(prev => prev.map(i =>
        i.id === txSelecionada.id && i.origem === 'despesa_manual'
          ? { ...i, valor: parseFloat(editValor.replace(',', '.')), data: editData || null, descricao: editDescricao }
          : i
      ));
      setTxSelecionada(null);
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir() {
    if (!txSelecionada || txSelecionada.origem !== 'despesa_manual') return;
    if (!txSelecionada.despesa_id) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setSalvando(true);
    try {
      await api.delete(`/api/v1/despesas/${txSelecionada.despesa_id}`);
      setMovimentacoes(prev => prev.filter(
        i => !(i.id === txSelecionada.id && i.origem === 'despesa_manual')
      ));
      setTxSelecionada(null);
    } finally {
      setSalvando(false);
    }
  }

  const itensFiltrados = movimentacoes.filter(
    i => filtroTipo === 'todas' || i.tipo === filtroTipo
  );
  const grupos = agruparPorData(itensFiltrados);

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

            {/* ── MOVIMENTAÇÕES ─────────────────────────────────── */}
            <div style={{ marginTop: 24 }}>
              {/* Eyebrow */}
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#8A93A5', marginBottom: 12 }}>
                MOVIMENTAÇÕES · {mesLabel(mesParam).toUpperCase()}
              </p>

              {/* Chips filtro */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {(['todas', 'receita', 'despesa'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFiltroTipo(f)}
                    style={{
                      padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                      border: '1.5px solid',
                      borderColor: filtroTipo === f ? '#A9852E' : '#E6E4DE',
                      background: filtroTipo === f ? 'rgba(169,133,46,.10)' : 'transparent',
                      color: filtroTipo === f ? '#A9852E' : '#4B5468',
                      cursor: 'pointer',
                    }}
                  >
                    {f === 'todas' ? 'Todas' : f === 'receita' ? 'Receitas' : 'Despesas'}
                  </button>
                ))}
              </div>

              {/* Lista agrupada por data */}
              {grupos.length === 0 ? (
                <p style={{ color: '#8A93A5', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
                  Nenhuma movimentação neste mês.
                </p>
              ) : grupos.map(grupo => (
                <div key={grupo.data ?? '__sem_data__'} style={{ marginBottom: 20 }}>
                  {/* Cabeçalho do grupo */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#4B5468' }}>{grupo.label}</span>
                    <span style={{
                      fontSize: 13, fontWeight: 700,
                      color: grupo.saldoDia >= 0 ? '#1F4D35' : '#6E1F27',
                    }}>
                      {grupo.saldoDia >= 0 ? '+' : ''}
                      {grupo.saldoDia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>

                  {/* Linhas de transação */}
                  {grupo.itens.map(item => {
                    const cor = COLOR_MAP[item.icon_key] ?? COLOR_MAP['outros'];
                    return (
                      <div
                        key={`${item.origem}-${item.id}`}
                        onClick={() => abrirDetalhe(item)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                          background: '#FFFFFF', borderRadius: 10, marginBottom: 6,
                          boxShadow: '0 1px 3px rgba(0,0,0,.07)', cursor: 'pointer',
                        }}
                      >
                        {/* Ícone */}
                        <div style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: cor.bg, color: cor.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 16, flexShrink: 0,
                        }}>
                          {ICON_MAP[item.icon_key] ?? ICON_MAP['outros']}
                        </div>
                        {/* Texto */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0B1220',
                                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.descricao}
                          </p>
                          <p style={{ margin: 0, fontSize: 11, color: '#8A93A5' }}>{item.categoria}</p>
                        </div>
                        {/* Valor */}
                        <span style={{
                          fontSize: 14, fontWeight: 700, flexShrink: 0,
                          color: item.tipo === 'receita' ? '#1F4D35' : '#6E1F27',
                        }}>
                          {item.tipo === 'despesa' ? '−' : '+'}
                          {item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

          </>
        )}
      </div>

      {/* ── BOTTOM SHEET: Detalhe / Edição de Movimentação ── */}
      {txSelecionada && (
        <>
          {/* Overlay */}
          <div
            onClick={() => setTxSelecionada(null)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
              zIndex: 999, backdropFilter: 'blur(2px)',
            }}
          />
          {/* Sheet */}
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: '#FAF8F3', borderRadius: '20px 20px 0 0',
            padding: '20px 20px 36px', zIndex: 1000,
            boxShadow: '0 -4px 24px rgba(0,0,0,.18)',
          }}>
            {/* Handle */}
            <div style={{ width: 40, height: 4, borderRadius: 2, background: '#E6E4DE', margin: '0 auto 20px' }} />

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0B1220' }}>
                {txSelecionada.origem === 'pedido' ? 'Detalhe da Receita' : 'Editar Despesa'}
              </h3>
              <span style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: txSelecionada.tipo === 'receita' ? 'rgba(31,77,53,.10)' : 'rgba(110,31,39,.10)',
                color: txSelecionada.tipo === 'receita' ? '#1F4D35' : '#6E1F27',
              }}>
                {txSelecionada.tipo === 'receita' ? 'Receita' : 'Despesa'}
              </span>
            </div>

            {/* Spinner de carregamento */}
            {detalheCarregando && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#A9852E' }}>
                Carregando dados…
              </div>
            )}

            {/* ── RECEITA (pedido) ── */}
            {!detalheCarregando && txSelecionada.origem === 'pedido' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Cliente */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#8A93A5', textTransform: 'uppercase', letterSpacing: 1 }}>Cliente</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#0B1220' }}>
                      {pedidoDetalhe?.cliente_nome ?? txSelecionada.descricao.split(' · ')[1] ?? '—'}
                    </span>
                  </div>
                  {/* Peça */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#8A93A5', textTransform: 'uppercase', letterSpacing: 1 }}>Peça</span>
                    <span style={{ fontSize: 15, color: '#0B1220' }}>
                      {pedidoDetalhe?.tipo_pedido_nome ?? pedidoDetalhe?.descricao_produto ?? '—'}
                    </span>
                  </div>
                  {/* Datas */}
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#8A93A5', textTransform: 'uppercase', letterSpacing: 1 }}>Data do pedido</span>
                      <span style={{ fontSize: 14, color: '#0B1220' }}>
                        {pedidoDetalhe?.data_pedido
                          ? new Date(pedidoDetalhe.data_pedido + 'T12:00:00').toLocaleDateString('pt-BR')
                          : '—'}
                      </span>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#8A93A5', textTransform: 'uppercase', letterSpacing: 1 }}>Data de entrega</span>
                      <span style={{ fontSize: 14, color: '#0B1220' }}>
                        {pedidoDetalhe?.data_entrega
                          ? new Date(pedidoDetalhe.data_entrega + 'T12:00:00').toLocaleDateString('pt-BR')
                          : '—'}
                      </span>
                    </div>
                  </div>
                  {/* Valor */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#8A93A5', textTransform: 'uppercase', letterSpacing: 1 }}>Valor recebido</span>
                    <span style={{ fontSize: 20, fontWeight: 800, color: '#1F4D35' }}>
                      {(pedidoDetalhe?.valor_pecas ?? txSelecionada.valor)
                        .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>
                {/* Ações */}
                <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                  <button
                    onClick={() => setTxSelecionada(null)}
                    style={{
                      flex: 1, padding: '12px 0', borderRadius: 12, fontWeight: 700, fontSize: 14,
                      border: '1.5px solid #E6E4DE', background: 'transparent', color: '#4B5468', cursor: 'pointer',
                    }}
                  >
                    Fechar
                  </button>
                  {txSelecionada.pedido_id && (
                    <a
                      href={`/mobile/pedidos/${txSelecionada.pedido_id}`}
                      style={{
                        flex: 2, padding: '12px 0', borderRadius: 12, fontWeight: 700, fontSize: 14,
                        background: '#1F4D35', color: '#fff', textDecoration: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      Ver pedido →
                    </a>
                  )}
                </div>
              </>
            )}

            {/* ── DESPESA ── */}
            {!detalheCarregando && txSelecionada.origem === 'despesa_manual' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Tipo */}
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#4B5468' }}>
                    Tipo
                    <select
                      value={editTipoItem}
                      onChange={e => setEditTipoItem(e.target.value)}
                      style={{
                        display: 'block', width: '100%', marginTop: 4,
                        padding: '10px 12px', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' as const,
                        border: '1.5px solid #E6E4DE', background: '#fff', color: '#0B1220',
                      }}
                    >
                      {TIPOS_DESPESA.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>

                  {/* Detalhe */}
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#4B5468' }}>
                    Detalhe <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(opcional)</span>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      {editDetalheCustom ? (
                        <>
                          <input
                            type="text"
                            value={editDetalhe}
                            onChange={e => setEditDetalhe(e.target.value)}
                            placeholder="Digite o novo detalhe"
                            autoFocus
                            style={{
                              flex: 1, padding: '10px 12px', borderRadius: 10, fontSize: 14,
                              border: '1.5px solid #A9852E', background: '#fff', boxSizing: 'border-box' as const,
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => { setEditDetalheCustom(false); setEditDetalhe(''); }}
                            style={{
                              width: 40, height: 40, borderRadius: 10, border: '1.5px solid #E6E4DE',
                              background: '#fff', cursor: 'pointer', fontSize: 16, color: '#4B5468',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}
                          >✕</button>
                        </>
                      ) : (
                        <>
                          <select
                            value={editDetalhe}
                            onChange={e => setEditDetalhe(e.target.value)}
                            style={{
                              flex: 1, padding: '10px 12px', borderRadius: 10, fontSize: 14,
                              border: '1.5px solid #E6E4DE', background: '#fff', color: '#0B1220',
                              boxSizing: 'border-box' as const,
                            }}
                          >
                            <option value="">— Opcional —</option>
                            {editDetalhes.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                          <button
                            type="button"
                            onClick={() => { setEditDetalheCustom(true); setEditDetalhe(''); }}
                            title="Adicionar novo detalhe"
                            style={{
                              width: 40, height: 40, borderRadius: 10, border: '1.5px solid #E6E4DE',
                              background: '#fff', cursor: 'pointer', fontSize: 20, color: '#4B5468',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}
                          >+</button>
                        </>
                      )}
                    </div>
                  </label>

                  {/* Categoria */}
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#4B5468' }}>
                    Categoria
                    <select
                      value={editCategoria}
                      onChange={e => setEditCategoria(e.target.value)}
                      style={{
                        display: 'block', width: '100%', marginTop: 4,
                        padding: '10px 12px', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' as const,
                        border: '1.5px solid #E6E4DE', background: '#fff', color: '#0B1220',
                      }}
                    >
                      {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>

                  {/* Valor */}
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#4B5468' }}>
                    Valor (R$)
                    <input
                      type="text"
                      value={editValor}
                      onChange={e => setEditValor(e.target.value)}
                      style={{
                        display: 'block', width: '100%', marginTop: 4,
                        padding: '10px 12px', borderRadius: 10, fontSize: 16, fontWeight: 700,
                        border: '1.5px solid #E6E4DE', boxSizing: 'border-box' as const,
                        color: '#6E1F27', background: '#fff',
                      }}
                    />
                  </label>

                  {/* Data */}
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#4B5468' }}>
                    Data do pagamento
                    <input
                      type="date"
                      value={editData}
                      onChange={e => setEditData(e.target.value)}
                      style={{
                        display: 'block', width: '100%', marginTop: 4,
                        padding: '10px 12px', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' as const,
                        border: '1.5px solid #A9852E', background: '#fff',
                      }}
                    />
                  </label>

                  {/* Descrição */}
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#4B5468' }}>
                    Descrição <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(opcional)</span>
                    <input
                      type="text"
                      value={editDescricao}
                      onChange={e => setEditDescricao(e.target.value)}
                      style={{
                        display: 'block', width: '100%', marginTop: 4,
                        padding: '10px 12px', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' as const,
                        border: '1.5px solid #E6E4DE', background: '#fff',
                      }}
                    />
                  </label>
                </div>

                {/* Ações */}
                <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                  <button
                    onClick={handleExcluir}
                    disabled={salvando}
                    style={{
                      flex: 1, padding: '12px 0', borderRadius: 12, fontWeight: 700, fontSize: 14,
                      border: `1.5px solid ${confirmDelete ? '#6E1F27' : '#E6E4DE'}`,
                      background: confirmDelete ? 'rgba(110,31,39,.08)' : 'transparent',
                      color: confirmDelete ? '#6E1F27' : '#4B5468',
                      cursor: salvando ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {confirmDelete ? '⚠️ Confirmar' : 'Excluir'}
                  </button>
                  <button
                    onClick={handleSalvar}
                    disabled={salvando}
                    style={{
                      flex: 2, padding: '12px 0', borderRadius: 12, fontWeight: 700, fontSize: 14,
                      background: '#1F4D35', color: '#fff', border: 'none',
                      cursor: salvando ? 'not-allowed' : 'pointer',
                      opacity: salvando ? 0.7 : 1,
                    }}
                  >
                    {salvando ? 'Salvando…' : 'Salvar alterações'}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* FAB + flutuante */}
      {period === "month" && !showForm && (
        <button
          onClick={openForm}
          className="fixed bottom-24 right-4 z-40 flex items-center gap-2 px-5 py-3.5 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 active:scale-95 transition-transform"
          aria-label="Adicionar receita ou despesa"
        >
          <Plus className="w-5 h-5 shrink-0" />
          <span className="text-sm font-semibold">Lançar</span>
        </button>
      )}

      {/* ── Bottom Sheet: Adicionar receita/despesa ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={closeForm} />

          {/* Sheet */}
          <div className="relative w-full bg-white rounded-t-2xl max-h-[92dvh] flex flex-col shadow-2xl">
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
              <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 pt-3 pb-24 flex gap-2">
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
