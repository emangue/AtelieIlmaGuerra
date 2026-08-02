"use client";

import React, { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Plus,
  Check,
  X,
  Copy,
  Pencil,
  ClipboardCopy,
} from "lucide-react";

const ChartPlanoMensal = dynamic(
  () => import("@/components/mobile/chart-plano-mensal").then((m) => m.ChartPlanoMensal),
  { ssr: false, loading: () => <div style={{ height: 210 }} /> }
);
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getToken } from "@/lib/api-client";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

function authFetch(url: string, init?: RequestInit) {
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

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
  transacoes_count: number | null;
}

interface PlanoResumoMes {
  anomes: string;
  receita_planejada: number;
  despesas_planejadas: number;
  lucro_planejado: number;
  receita_realizada: number;
  despesas_realizadas: number;
  lucro_realizado: number;
}

interface OpcaoDespesa {
  plano_item_id: number | null;
  label: string;
  tipo_item: string;
  detalhe: string | null;
  categoria: string;
}

interface PecaNecessaria {
  tipo_item: string;
  ticket_medio: number;
  faltam_valor: number;
  pecas_necessarias: number;
  realizado: number;
  realizado_quantidade: number;
  realizado_ticket_medio: number;
}

interface DespesaNaoLancada {
  tipo_item: string;
  detalhe: string | null;
  valor_planejado: number;
}

interface MetaMes {
  anomes: string;
  meta_receita: number;
  realizado: number;
  faltam: number;
  percentual: number;
  dias_uteis_restantes: number;
  pecas_necessarias: PecaNecessaria[];
  despesas_nao_lancadas: DespesaNaoLancada[];
}

const MESES_LABEL: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};

function hoje(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function addMes(anomes: string, n: number): string {
  const y = parseInt(anomes.slice(0, 4));
  const m = parseInt(anomes.slice(4, 6));
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function labelMes(anomes: string): string {
  return `${MESES_LABEL[anomes.slice(4, 6)] || anomes.slice(4, 6)}/${anomes.slice(0, 4)}`;
}

export default function PlanoPage() {
  const [mesSel, setMesSel] = useState(hoje);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumo, setResumo] = useState<PlanoResumoMes[]>([]);

  const ano = parseInt(mesSel.slice(0, 4));

  // Itens do mês selecionado
  const [itensMes, setItensMes] = useState<PlanoItem[]>([]);
  const [loadingMes, setLoadingMes] = useState(false);

  // Inline edit receita
  const [recEditId, setRecEditId] = useState<number | null>(null);
  const [recEditQtd, setRecEditQtd] = useState("");
  const [recEditTicket, setRecEditTicket] = useState("");

  // Inline edit despesa
  const [despEditId, setDespEditId] = useState<number | null>(null);
  const [despEditPlan, setDespEditPlan] = useState("");

  // Lançar realizado inline por linha
  const [lancarId, setLancarId] = useState<number | null>(null);
  const [lancarValor, setLancarValor] = useState("");
  const [lancarLoading, setLancarLoading] = useState(false);

  // Save / replicar state
  const [savingItemId, setSavingItemId] = useState<number | null>(null);
  const [replicarItemId, setReplicarItemId] = useState<number | null>(null);
  const [replicarLoading, setReplicarLoading] = useState(false);
  const [replicarErro, setReplicarErro] = useState<string | null>(null);
  // Depois de salvar, perguntamos se o valor vale daqui pra frente — antes isso
  // era só um link cinza que passava despercebido.
  const [perguntaReplicar, setPerguntaReplicar] = useState<PlanoItem | null>(null);
  const [replicarOkId, setReplicarOkId] = useState<number | null>(null);
  const [savedItemId, setSavedItemId] = useState<number | null>(null);

  // Modal deletar
  const [deleteItem, setDeleteItem] = useState<PlanoItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Modal adicionar receita (novo tipo)
  const [showAddReceita, setShowAddReceita] = useState(false);
  const [addRecTipoItem, setAddRecTipoItem] = useState("");
  const [addRecQtd, setAddRecQtd] = useState("");
  const [addRecTicket, setAddRecTicket] = useState("");
  const [addRecLoading, setAddRecLoading] = useState(false);

  // Modal adicionar despesa planejada (novo item)
  const [showAddDespesaPlano, setShowAddDespesaPlano] = useState(false);
  const [addDespCategoria, setAddDespCategoria] = useState("");
  const [addDespTipoItem, setAddDespTipoItem] = useState("");
  const [addDespDetalhe, setAddDespDetalhe] = useState("");
  const [addDespValor, setAddDespValor] = useState("");
  const [addDespPlanoLoading, setAddDespPlanoLoading] = useState(false);

  // Modal adicionar despesa realizada
  const [showAddDespesa, setShowAddDespesa] = useState(false);
  const [addDespesaMes, setAddDespesaMes] = useState("");
  const [opcoesDespesa, setOpcoesDespesa] = useState<OpcaoDespesa[]>([]);
  const [addDespesaCategoria, setAddDespesaCategoria] = useState("");
  const [addDespesaValor, setAddDespesaValor] = useState("");
  const [addDespesaDescricao, setAddDespesaDescricao] = useState("");
  const [addDespesaLoading, setAddDespesaLoading] = useState(false);

  // Meta do mês
  const [meta, setMeta] = useState<MetaMes | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);

  // Estimador de peças pendentes (estado local, não salvo)
  // key = tipo_item, value = { qty: string, preco: string }
  const [estimativa, setEstimativa] = useState<Record<string, { qty: string; preco: string }>>({});

  // Copiar plano de mês anterior
  const [copiandoPlano, setCopiandoPlano] = useState(false);

  const fetchResumo = useCallback(() => {
    setLoading(true);
    setError(null);
    const anoAnterior = ano - 1;
    Promise.all([
      authFetch(`${API_URL}/api/v1/plano/resumo-mensal?ano=${ano}`).then((r) => r.json()),
      authFetch(`${API_URL}/api/v1/plano/resumo-mensal?ano=${anoAnterior}`).then((r) => r.json()),
    ])
      .then(([rAno, rAnoAnt]) => {
        setResumo([...(rAnoAnt || []), ...(rAno || [])]);
      })
      .catch(() => {
        setResumo([]);
        setError("Não foi possível carregar. Verifique se o backend está rodando.");
      })
      .finally(() => setLoading(false));
  }, [ano]);

  useEffect(() => {
    fetchResumo();
  }, [fetchResumo]);

  const fetchItensMes = useCallback(() => {
    setLoadingMes(true);
    authFetch(`${API_URL}/api/v1/plano?anomes=${mesSel}`)
      .then((r) => r.json())
      .then((data) => setItensMes(Array.isArray(data) ? data : []))
      .catch(() => setItensMes([]))
      .finally(() => setLoadingMes(false));
  }, [mesSel]);

  const fetchMeta = useCallback(() => {
    setLoadingMeta(true);
    authFetch(`${API_URL}/api/v1/plano/meta-mes?mes=${mesSel}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setMeta(data))
      .catch(() => setMeta(null))
      .finally(() => setLoadingMeta(false));
  }, [mesSel]);

  useEffect(() => {
    fetchItensMes();
    fetchMeta();
    setRecEditId(null);
    setDespEditId(null);
    setSavedItemId(null);
    setReplicarItemId(null);
    setLancarId(null);
    setLancarValor("");
  }, [fetchItensMes, fetchMeta]);

  const handleLancarRealizado = async (item: PlanoItem) => {
    const val = parseFloat(lancarValor.replace(",", "."));
    if (isNaN(val) || val <= 0) return;
    setLancarLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/v1/pagamentos/despesa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anomes: mesSel, plano_item_id: item.id, valor: val }),
      });
      if (res.ok) {
        setLancarId(null);
        setLancarValor("");
        fetchItensMes();
        fetchResumo();
        fetchMeta();
      }
    } finally {
      setLancarLoading(false);
    }
  };

  const handleDelete = (item: PlanoItem) => setDeleteItem(item);

  const handleConfirmDelete = async () => {
    if (!deleteItem) return;
    setDeleteLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/v1/plano/${deleteItem.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteItem(null);
        fetchItensMes();
        fetchResumo();
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const startEditRec = (item: PlanoItem) => {
    setRecEditId(item.id);
    setRecEditQtd(item.quantidade != null ? String(item.quantidade) : "");
    setRecEditTicket(item.ticket_medio != null ? String(item.ticket_medio) : "");
    setDespEditId(null);
    setSavedItemId(null);
  };

  const saveRec = async (item: PlanoItem) => {
    const qtd = parseFloat(recEditQtd.replace(",", "."));
    const ticket = parseFloat(recEditTicket.replace(",", "."));
    if (isNaN(qtd) || isNaN(ticket) || qtd < 0 || ticket < 0) return;
    setSavingItemId(item.id);
    try {
      const res = await authFetch(`${API_URL}/api/v1/plano/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantidade: qtd, ticket_medio: ticket, valor_planejado: qtd * ticket }),
      });
      if (res.ok) {
        setRecEditId(null);
        setSavedItemId(item.id);
        setPerguntaReplicar({ ...item, quantidade: qtd, ticket_medio: ticket, valor_planejado: qtd * ticket });
        fetchItensMes();
        fetchResumo();
      }
    } finally {
      setSavingItemId(null);
    }
  };

  const startEditDesp = (item: PlanoItem) => {
    setDespEditId(item.id);
    setDespEditPlan(String(item.valor_planejado));
    setRecEditId(null);
    setSavedItemId(null);
  };

  const saveDesp = async (item: PlanoItem) => {
    const val = parseFloat(despEditPlan.replace(",", "."));
    if (isNaN(val) || val < 0) return;
    setSavingItemId(item.id);
    try {
      const res = await authFetch(`${API_URL}/api/v1/plano/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor_planejado: val }),
      });
      if (res.ok) {
        setDespEditId(null);
        setSavedItemId(item.id);
        setPerguntaReplicar({ ...item, valor_planejado: val });
        fetchItensMes();
        fetchResumo();
      }
    } finally {
      setSavingItemId(null);
    }
  };

  const handleReplicar = async (itemId: number) => {
    const item = itensMes.find((i) => i.id === itemId);
    if (!item) return;
    setReplicarLoading(true);
    setReplicarItemId(itemId);
    setReplicarErro(null);
    try {
      // authFetch, não fetch: o endpoint exige token e falhava com 401 em silêncio.
      const res = await authFetch(
        `${API_URL}/api/v1/plano/aplicar-aos-futuros?mes_referencia=${item.anomes}&item_id=${item.id}&criar_ausentes=true`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Não foi possível replicar para os próximos meses.");
      setSavedItemId(null);
      setReplicarItemId(null);
      setReplicarOkId(itemId);
      fetchItensMes();
      fetchResumo();
    } catch (e) {
      setReplicarErro(e instanceof Error ? e.message : "Erro ao replicar.");
    } finally {
      setReplicarLoading(false);
    }
  };

  // Adicionar novo tipo de receita
  const handleAddReceita = async () => {
    const qtd = parseFloat(addRecQtd.replace(",", "."));
    const ticket = parseFloat(addRecTicket.replace(",", "."));
    if (!addRecTipoItem.trim() || isNaN(qtd) || isNaN(ticket)) return;
    setAddRecLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/v1/plano`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anomes: mesSel,
          tipo: "receita",
          categoria: "Receita",
          tipo_item: addRecTipoItem.trim(),
          quantidade: qtd,
          ticket_medio: ticket,
          valor_planejado: qtd * ticket,
        }),
      });
      if (res.ok) {
        setShowAddReceita(false);
        setAddRecTipoItem("");
        setAddRecQtd("");
        setAddRecTicket("");
        fetchItensMes();
        fetchResumo();
      }
    } finally {
      setAddRecLoading(false);
    }
  };

  // Adicionar nova despesa planejada
  const handleAddDespesaPlano = async () => {
    const val = parseFloat(addDespValor.replace(",", "."));
    if (!addDespTipoItem.trim() || isNaN(val) || val < 0) return;
    setAddDespPlanoLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/v1/plano`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anomes: mesSel,
          tipo: "despesa",
          categoria: addDespCategoria.trim() || "Custo Fixo",
          tipo_item: addDespTipoItem.trim(),
          detalhe: addDespDetalhe.trim() || null,
          valor_planejado: val,
        }),
      });
      if (res.ok) {
        setShowAddDespesaPlano(false);
        setAddDespCategoria("");
        setAddDespTipoItem("");
        setAddDespDetalhe("");
        setAddDespValor("");
        fetchItensMes();
        fetchResumo();
      }
    } finally {
      setAddDespPlanoLoading(false);
    }
  };

  // Copiar plano do último mês com dados
  const ultimoMesComPlano = resumo
    .filter((r) => r.anomes < mesSel && (r.receita_planejada > 0 || r.despesas_planejadas > 0))
    .sort((a, b) => b.anomes.localeCompare(a.anomes))[0];

  const handleCopiarPlano = async () => {
    if (!ultimoMesComPlano) return;
    setCopiandoPlano(true);
    try {
      const res = await fetch(
        `${API_URL}/api/v1/plano/copiar-mes?mes_origem=${ultimoMesComPlano.anomes}&mes_destino=${mesSel}`,
        { method: "POST" }
      );
      if (res.ok) {
        fetchItensMes();
        fetchResumo();
      }
    } finally {
      setCopiandoPlano(false);
    }
  };

  const mesesParaSelect = Array.from({ length: 12 }, (_, i) => `${ano}${String(i + 1).padStart(2, "0")}`);

  const openAddDespesa = (anomes?: string) => {
    const mes = anomes || mesSel;
    setAddDespesaMes(mes);
    setAddDespesaCategoria("");
    setAddDespesaValor("");
    setAddDespesaDescricao("");
    setShowAddDespesa(true);
    authFetch(`${API_URL}/api/v1/plano/opcoes-despesa?mes=${mes}`)
      .then((r) => r.json())
      .then(setOpcoesDespesa)
      .catch(() => setOpcoesDespesa([]));
  };

  const handleAddDespesa = async () => {
    const val = parseFloat(addDespesaValor.replace(",", "."));
    if (isNaN(val) || val <= 0) return;
    const opt = opcoesDespesa.find((o) => o.label === addDespesaCategoria);
    if (!opt) return;
    setAddDespesaLoading(true);
    try {
      const body: Record<string, unknown> = {
        anomes: addDespesaMes,
        valor: val,
        descricao: addDespesaDescricao.trim() || undefined,
      };
      if (opt.plano_item_id) {
        body.plano_item_id = opt.plano_item_id;
      } else {
        body.tipo_item = opt.tipo_item;
        body.detalhe = opt.detalhe;
        body.categoria = opt.categoria;
      }
      const res = await authFetch(`${API_URL}/api/v1/pagamentos/despesa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowAddDespesa(false);
        fetchItensMes();
        fetchResumo();
      }
    } finally {
      setAddDespesaLoading(false);
    }
  };

  const receitas = itensMes.filter((i) => i.tipo === "receita");
  const despesas = itensMes.filter((i) => i.tipo === "despesa");

  const despPorTipoItem = despesas.reduce<Record<string, PlanoItem[]>>((acc, i) => {
    const grp = i.tipo_item || i.categoria;
    if (!acc[grp]) acc[grp] = [];
    acc[grp].push(i);
    return acc;
  }, {});

  // Categorias existentes para sugerir no datalist
  const categoriasExistentes = [...new Set(despesas.map((i) => i.categoria).filter(Boolean))];

  const resumoMes = resumo.find((r) => r.anomes === mesSel);
  const semPlano = !loadingMes && itensMes.length === 0;

  return (
    <div className="pb-24">
      <div className="sticky top-14 z-40 bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Plano Financeiro</h2>
          <Button size="sm" onClick={() => openAddDespesa()} className="gap-1">
            <Plus className="w-4 h-4" />
            Despesa
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMesSel((m) => addMes(m, -1))}
            className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-gray-900 min-w-[90px] text-center">
            {labelMes(mesSel)}
          </span>
          <button
            onClick={() => setMesSel((m) => addMes(m, 1))}
            className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
            aria-label="Próximo mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
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
            <Button onClick={fetchResumo} variant="outline">Tentar novamente</Button>
          </div>
        ) : (
          <>
            {/* Gráfico comparação — ano inteiro com scroll */}
            {(() => {
              const anoStr = mesSel.slice(0, 4);
              const mesesAno = Array.from({ length: 12 }, (_, i) => `${anoStr}${String(i + 1).padStart(2, "0")}`);
              const chartData = mesesAno.map((anomes) => {
                const r = resumo.find((x) => x.anomes === anomes);
                return {
                  anomes,
                  label: MESES_LABEL[anomes.slice(4, 6)] || anomes.slice(4, 6),
                  receita_planejada: r?.receita_planejada ?? 0,
                  despesas_planejadas: r?.despesas_planejadas ?? 0,
                  lucro_planejado: r?.lucro_planejado ?? 0,
                  receita_realizada: r?.receita_realizada ?? 0,
                  despesas_realizadas: r?.despesas_realizadas ?? 0,
                  lucro_realizado: r?.lucro_realizado ?? 0,
                };
              });
              return (
                <div className="rounded-xl border border-gray-200 bg-white p-4 mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Comparação — {anoStr}</h3>
                  <ChartPlanoMensal data={chartData} />
                </div>
              );
            })()}

            {/* Meta do mês */}
            {meta && (() => {
              // Calcula total estimado das peças pendentes
              const totalEstimado = meta.pecas_necessarias.reduce((sum, p) => {
                const e = estimativa[p.tipo_item];
                const qty = parseInt(e?.qty ?? "") || 0;
                const preco = parseFloat((e?.preco ?? "").replace(",", ".")) || p.ticket_medio;
                return sum + qty * preco;
              }, 0);
              const projetado = meta.realizado + totalEstimado;
              const pctReal = meta.meta_receita > 0 ? Math.min(100, (meta.realizado / meta.meta_receita) * 100) : 0;
              const pctEst = meta.meta_receita > 0 ? Math.min(100 - pctReal, (totalEstimado / meta.meta_receita) * 100) : 0;
              const faltamComEst = Math.max(0, meta.meta_receita - projetado);

              return (
                <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Meta de receita</p>
                    {meta.dias_uteis_restantes > 0 && (
                      <span className="text-xs text-gray-400">{meta.dias_uteis_restantes} dias úteis restantes</span>
                    )}
                  </div>
                  <div className="flex items-end justify-between mb-2">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{formatMoney(meta.realizado)}</p>
                      <p className="text-xs text-gray-400">de {formatMoney(meta.meta_receita)}</p>
                    </div>
                    <p className={`text-lg font-semibold ${meta.faltam > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {meta.faltam > 0 ? `Faltam ${formatMoney(meta.faltam)}` : "Meta atingida!"}
                    </p>
                  </div>
                  {/* Barra dupla: realizado + estimado */}
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
                    <div className="h-full flex">
                      <div
                        className={`h-full transition-all ${meta.percentual >= 100 ? "bg-emerald-500" : meta.percentual >= 60 ? "bg-amber-400" : "bg-rose-400"}`}
                        style={{ width: `${pctReal}%` }}
                      />
                      {pctEst > 0 && (
                        <div className="h-full bg-amber-200 transition-all" style={{ width: `${pctEst}%` }} />
                      )}
                    </div>
                  </div>
                  {totalEstimado > 0 && (
                    <p className="text-xs text-gray-400 mb-3">
                      Real + Estimado: <span className="font-medium text-gray-600">{formatMoney(projetado)}</span>
                      {faltamComEst > 0
                        ? <> · ainda faltam <span className="text-rose-500 font-medium">{formatMoney(faltamComEst)}</span></>
                        : <> · <span className="text-emerald-600 font-medium">meta atingida com estimativa</span></>
                      }
                    </p>
                  )}
                  {/* Estimador de peças pendentes */}
                  {meta.pecas_necessarias.length > 0 && (
                    <div className={`${totalEstimado > 0 ? "" : "mt-3"} pt-3 border-t border-gray-100`}>
                      <p className="text-xs font-medium text-gray-500 mb-2">Estimativa de peças pendentes</p>
                      <div className="space-y-2">
                        {meta.pecas_necessarias.map((p) => {
                          const e = estimativa[p.tipo_item] ?? { qty: "", preco: "" };
                          const qty = parseInt(e.qty) || 0;
                          const preco = parseFloat(e.preco.replace(",", ".")) || p.ticket_medio;
                          const subtotal = qty * preco;
                          return (
                            <div key={p.tipo_item}>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-600 w-28 shrink-0 truncate">{p.tipo_item}</span>
                                <div className="flex items-center gap-1 flex-1">
                                  <Input
                                    type="number"
                                    min={0}
                                    placeholder="0"
                                    value={e.qty}
                                    onChange={(ev) => setEstimativa((prev) => ({ ...prev, [p.tipo_item]: { ...prev[p.tipo_item] ?? { qty: "", preco: "" }, qty: ev.target.value } }))}
                                    className="h-7 w-12 text-xs px-1.5 text-center"
                                  />
                                  <span className="text-xs text-gray-400">×</span>
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder={String(Math.round(p.ticket_medio))}
                                    value={e.preco}
                                    onChange={(ev) => setEstimativa((prev) => ({ ...prev, [p.tipo_item]: { ...prev[p.tipo_item] ?? { qty: "", preco: "" }, preco: ev.target.value } }))}
                                    className="h-7 flex-1 text-xs px-1.5 text-right"
                                  />
                                </div>
                                <span className={`text-xs font-medium w-16 text-right shrink-0 ${subtotal > 0 ? "text-emerald-700" : "text-gray-300"}`}>
                                  {subtotal > 0 ? formatMoney(subtotal) : "—"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {totalEstimado > 0 && (
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                          <span className="text-xs text-gray-500">Total estimado</span>
                          <span className="text-sm font-semibold text-amber-600">{formatMoney(totalEstimado)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
            {loadingMeta && !meta && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 mb-4 flex justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
              </div>
            )}

            {/* Sem plano → opção de copiar */}
            {semPlano && ultimoMesComPlano && (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 mb-4 text-center">
                <p className="text-sm text-gray-500 mb-3">
                  Nenhum plano cadastrado para {formatMes(mesSel)}.
                </p>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleCopiarPlano}
                  disabled={copiandoPlano}
                >
                  {copiandoPlano ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ClipboardCopy className="w-4 h-4" />
                  )}
                  Copiar plano de {formatMes(ultimoMesComPlano.anomes)}
                </Button>
              </div>
            )}

            {/* Receitas do mês */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden mb-4">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-emerald-700 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" /> Receitas — {formatMes(mesSel)}
                </p>
                <button
                  className="text-xs text-gray-400 hover:text-emerald-600 flex items-center gap-1 transition-colors"
                  onClick={() => {
                    setAddRecTipoItem("");
                    setAddRecQtd("");
                    setAddRecTicket("");
                    setShowAddReceita(true);
                  }}
                >
                  <Plus className="w-3.5 h-3.5" /> Novo tipo
                </button>
              </div>
              {loadingMes ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                </div>
              ) : receitas.length === 0 ? (
                <p className="px-4 py-4 text-sm text-gray-400 italic">
                  Nenhuma receita planejada. Clique em &ldquo;Novo tipo&rdquo; para adicionar.
                </p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {receitas.map((item) => {
                    const isEditing = recEditId === item.id;
                    const isSaving = savingItemId === item.id;
                    const justSaved = savedItemId === item.id;
                    const qtdNum = parseFloat(recEditQtd.replace(",", "."));
                    const ticketNum = parseFloat(recEditTicket.replace(",", "."));
                    const previewTotal = !isNaN(qtdNum) && !isNaN(ticketNum) ? qtdNum * ticketNum : null;
                    return (
                      <div key={item.id}>
                        {isEditing ? (
                          /* Modo edição: layout de grade compacto */
                          <div className="bg-emerald-50 px-4 py-3 space-y-2">
                            <p className="text-sm font-medium text-gray-800">{item.tipo_item}</p>
                            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Qtd</p>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={recEditQtd}
                                  onChange={(e) => setRecEditQtd(e.target.value)}
                                  className="h-8 text-sm px-2 text-right"
                                  autoFocus
                                />
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Ticket médio (R$)</p>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={recEditTicket}
                                  onChange={(e) => setRecEditTicket(e.target.value)}
                                  className="h-8 text-sm px-2 text-right"
                                />
                              </div>
                              <div className="flex gap-1 pb-0.5">
                                <button
                                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                  onClick={() => saveRec(item)}
                                  disabled={isSaving}
                                >
                                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                </button>
                                <button
                                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100"
                                  onClick={() => setRecEditId(null)}
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            {previewTotal != null && (
                              <p className="text-sm font-semibold text-emerald-700 text-right">
                                Total: {formatMoney(previewTotal)}
                              </p>
                            )}
                          </div>
                        ) : (
                          /* Modo visualização: 2 linhas, nome completo no topo */
                          (() => {
                            const metaItem = meta?.pecas_necessarias.find((p) => p.tipo_item === item.tipo_item);
                            const realizado = metaItem?.realizado ?? 0;
                            const pct = item.valor_planejado > 0 ? (realizado / item.valor_planejado) * 100 : 0;
                            const barPct = Math.min(pct, 100);
                            return (
                              <div
                                className="px-4 py-3 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
                                onClick={() => startEditRec(item)}
                              >
                                {/* Linha 1: nome + botões */}
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <span className="text-sm font-medium text-gray-800 leading-snug">{item.tipo_item}</span>
                                  <div className="flex items-center gap-0.5 shrink-0 -mt-0.5" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      className="w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:text-emerald-500 hover:bg-emerald-50 transition-colors"
                                      onClick={() => startEditRec(item)}
                                      title="Editar"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      className="w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                                      onClick={() => handleDelete(item)}
                                      title="Excluir"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                                {/* Linha 2: planejado */}
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-400">
                                    Plano:{" "}
                                    {item.quantidade != null && item.ticket_medio != null
                                      ? `${item.quantidade} × ${formatMoney(item.ticket_medio)} = `
                                      : ""}
                                    <span className="font-medium text-gray-600">{formatMoney(item.valor_planejado)}</span>
                                  </span>
                                </div>
                                {/* Linha 3: realizado com qtd e ticket médio reais */}
                                <div className="flex items-center justify-between mb-1 mt-0.5">
                                  <span className="text-xs text-gray-400">
                                    Real:{" "}
                                    {metaItem && metaItem.realizado_quantidade > 0
                                      ? <>
                                          <span>{metaItem.realizado_quantidade} × {formatMoney(metaItem.realizado_ticket_medio)} = </span>
                                          <span className="font-medium text-emerald-700">{formatMoney(realizado)}</span>
                                        </>
                                      : <span className="font-medium text-gray-300">—</span>
                                    }
                                  </span>
                                  <span className="text-xs text-gray-400">{pct > 0 ? `${Math.round(pct)}%` : ""}</span>
                                </div>
                                {/* Barra mini de progresso */}
                                <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-emerald-400" : "bg-gray-300"}`}
                                    style={{ width: `${barPct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })()
                        )}
                        {justSaved && !isEditing && (
                          <div className="px-4 pb-2 -mt-0.5">
                            <button
                              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors disabled:opacity-50"
                              onClick={() => handleReplicar(item.id)}
                              disabled={replicarLoading && replicarItemId === item.id}
                            >
                              {replicarLoading && replicarItemId === item.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              Replicar para os próximos meses
                            </button>
                            {replicarOkId === item.id && (
                              <span className="ml-2 text-xs text-emerald-600">replicado</span>
                            )}
                            {replicarErro && replicarItemId === item.id && (
                              <span className="ml-2 text-xs text-red-600">{replicarErro}</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {/* Hint editar */}
                  <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Pencil className="w-3 h-3" /> Toque em uma linha para editar
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Despesas do mês */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden mb-4">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-rose-700 flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4" /> Despesas — {formatMes(mesSel)}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    className="text-xs text-gray-400 hover:text-rose-600 flex items-center gap-1 transition-colors"
                    onClick={() => {
                      setAddDespCategoria("");
                      setAddDespTipoItem("");
                      setAddDespDetalhe("");
                      setAddDespValor("");
                      setShowAddDespesaPlano(true);
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" /> Nova despesa
                  </button>
                </div>
              </div>
              {loadingMes ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                </div>
              ) : despesas.length === 0 ? (
                <p className="px-4 py-4 text-sm text-gray-400 italic">
                  Nenhuma despesa planejada. Clique em &ldquo;Nova despesa&rdquo; para adicionar.
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {Object.entries(despPorTipoItem).map(([grp, items]) => (
                    <div key={grp}>
                      <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">{grp}</p>
                      {items.map((item) => {
                        const isEditing = despEditId === item.id;
                        const isLancando = lancarId === item.id;
                        const isSaving = savingItemId === item.id;
                        const justSaved = savedItemId === item.id;
                        const nome = item.detalhe || item.tipo_item;
                        const isAndrea = item.tipo_item === "Colaboradores" && nome === "Andrea";
                        const andreaPedidosUrl = `/mobile/pedidos/todos?mes=${mesSel}&status=Entregue&tipo=AJUSTE&repasse_funcionaria=1`;
                        return (
                          <div key={item.id} className="border-t border-gray-50 first:border-t-0">
                            {/* Modo editar planejado */}
                            {isEditing ? (
                              <div className="bg-rose-50 px-4 py-3 flex items-center gap-2">
                                <span className="flex-1 text-sm text-gray-700 truncate">{nome}</span>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={despEditPlan}
                                  onChange={(e) => setDespEditPlan(e.target.value)}
                                  className="h-8 w-28 text-sm px-2 text-right"
                                  autoFocus
                                />
                                <div className="flex gap-1">
                                  <button
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                    onClick={() => saveDesp(item)}
                                    disabled={isSaving}
                                  >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                  </button>
                                  <button
                                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100"
                                    onClick={() => setDespEditId(null)}
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ) : isLancando ? (
                              /* Modo lançar realizado */
                              <div className="bg-amber-50 px-4 py-3">
                                <p className="text-xs text-amber-700 font-medium mb-2">Lançar realizado — {nome}</p>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="R$ 0"
                                    value={lancarValor}
                                    onChange={(e) => setLancarValor(e.target.value)}
                                    className="h-8 flex-1 text-sm px-2 text-right"
                                    autoFocus
                                  />
                                  <button
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-500 text-white hover:bg-amber-600"
                                    onClick={() => handleLancarRealizado(item)}
                                    disabled={lancarLoading}
                                  >
                                    {lancarLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                  </button>
                                  <button
                                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100"
                                    onClick={() => { setLancarId(null); setLancarValor(""); }}
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* Modo visualização */
                              <div
                                className="px-4 py-3 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
                                onClick={() => startEditDesp(item)}
                              >
                                {/* Linha 1: nome + ações */}
                                <div className="flex items-center justify-between gap-2">
                                  {isAndrea ? (
                                    <Link
                                      href={andreaPedidosUrl}
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-sm text-gray-800 font-medium underline decoration-gray-300 underline-offset-4 hover:text-red-700 hover:decoration-red-300"
                                    >
                                      {nome}
                                    </Link>
                                  ) : (
                                    <span className="text-sm text-gray-800 font-medium">{nome}</span>
                                  )}
                                  <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      className="w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                                      onClick={() => { setLancarId(item.id); setLancarValor(""); setDespEditId(null); }}
                                      title="Lançar realizado"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      className="w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                                      onClick={() => startEditDesp(item)}
                                      title="Editar planejado"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      className="w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                                      onClick={() => handleDelete(item)}
                                      title="Excluir"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                                {/* Linha 2: planejado vs realizado */}
                                <div className="flex items-center justify-between mt-0.5">
                                  <span className="text-xs text-gray-400">Planejado: <span className="font-medium text-rose-600">{formatMoney(item.valor_planejado)}</span></span>
                                  {item.valor_realizado != null && item.valor_realizado > 0 ? (
                                    <span className="text-xs text-gray-700 font-medium">
                                      {formatMoney(item.valor_realizado)} lançado
                                      {item.transacoes_count != null && item.transacoes_count > 1 && (
                                        <span className="text-gray-400 font-normal"> · {item.transacoes_count}×</span>
                                      )}
                                    </span>
                                  ) : item.valor_planejado > 0 ? (
                                    <span className="text-xs text-amber-600 font-medium">Não lançado</span>
                                  ) : null}
                                </div>
                                {/* Barra de progresso */}
                                {item.valor_planejado > 0 && (() => {
                                  const real = item.valor_realizado ?? 0;
                                  const pct = Math.round((real / item.valor_planejado) * 100);
                                  const barPct = Math.min(pct, 100);
                                  const over = real > item.valor_planejado;
                                  return (
                                    <div className="mt-1.5 flex items-center gap-2">
                                      <div className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                                        <div
                                          className="h-full rounded-full transition-all"
                                          style={{
                                            width: `${barPct}%`,
                                            background: over ? "#E24B4A" : real > 0 ? "#D85A30" : "#e5e7eb",
                                          }}
                                        />
                                      </div>
                                      {real > 0 && (
                                        <span className="text-[10px] shrink-0" style={{ color: over ? "#E24B4A" : "#9ca3af" }}>
                                          {pct}%
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                            {justSaved && !isEditing && !isLancando && (
                              <div className="px-4 pb-2">
                                <button
                                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors disabled:opacity-50"
                                  onClick={() => handleReplicar(item.id)}
                                  disabled={replicarLoading && replicarItemId === item.id}
                                >
                                  {replicarLoading && replicarItemId === item.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                  Replicar para os próximos meses
                                </button>
                                {replicarOkId === item.id && (
                                  <span className="ml-2 text-xs text-emerald-600">replicado</span>
                                )}
                                {replicarErro && replicarItemId === item.id && (
                                  <span className="ml-2 text-xs text-red-600">{replicarErro}</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  {/* Hint editar */}
                  <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Pencil className="w-3 h-3" /> Toque em uma linha para editar o planejado · <Plus className="w-3 h-3" /> para lançar realizado
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Lucro do mês */}
            {resumoMes && (
              <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
                <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">Resumo — {formatMes(mesSel)}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Receita planejada</p>
                    <p className="text-base font-semibold text-emerald-600">{formatMoney(resumoMes.receita_planejada)}</p>
                    {resumoMes.receita_realizada > 0 && (
                      <p className="text-xs text-emerald-800">{formatMoney(resumoMes.receita_realizada)} real.</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Despesas planejadas</p>
                    <p className="text-base font-semibold text-rose-600">{formatMoney(resumoMes.despesas_planejadas)}</p>
                    {resumoMes.despesas_realizadas > 0 && (
                      <p className="text-xs text-rose-800">{formatMoney(resumoMes.despesas_realizadas)} real.</p>
                    )}
                  </div>
                  <div className="col-span-2 pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-0.5">Lucro planejado</p>
                    <p className={`text-lg font-bold ${resumoMes.lucro_planejado >= 0 ? "text-gray-900" : "text-rose-600"}`}>
                      {formatMoney(resumoMes.lucro_planejado)}
                    </p>
                    {resumoMes.lucro_realizado !== 0 && (
                      <p className={`text-sm font-medium ${resumoMes.lucro_realizado >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                        {formatMoney(resumoMes.lucro_realizado)} realizado
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Deletar */}
      <AlertDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item?</AlertDialogTitle>
            <p className="text-sm text-gray-500">
              {deleteItem && `${deleteItem.detalhe || deleteItem.tipo_item} - ${formatMoney(deleteItem.valor_planejado)}`}
            </p>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteLoading}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pergunta se o novo valor vale daqui pra frente */}
      <AlertDialog
        open={!!perguntaReplicar}
        onOpenChange={(o) => !o && setPerguntaReplicar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vale para os próximos meses?</AlertDialogTitle>
            <p className="text-sm text-gray-500">
              {perguntaReplicar && (
                <>
                  <span className="font-medium text-gray-700">
                    {perguntaReplicar.detalhe || perguntaReplicar.tipo_item}
                  </span>{" "}
                  ficou em{" "}
                  <span className="font-medium text-gray-700">
                    {formatMoney(perguntaReplicar.valor_planejado)}
                  </span>{" "}
                  em {labelMes(perguntaReplicar.anomes)}.
                  <br />
                  Quer usar esse mesmo valor de {labelMes(addMes(perguntaReplicar.anomes, 1))} até
                  dezembro de {perguntaReplicar.anomes.slice(0, 4)}?
                </>
              )}
            </p>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Só neste mês</AlertDialogCancel>
            <AlertDialogAction
              disabled={replicarLoading}
              onClick={() => {
                const item = perguntaReplicar;
                setPerguntaReplicar(null);
                if (item) handleReplicar(item.id);
              }}
            >
              {replicarLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Aplicar daqui pra frente"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Adicionar tipo de receita */}
      <Dialog open={showAddReceita} onOpenChange={setShowAddReceita}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo tipo de receita</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-600">Tipo de item</Label>
              <Input
                placeholder="Ex: Vestido Noiva, Ajustes..."
                value={addRecTipoItem}
                onChange={(e) => setAddRecTipoItem(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-600">Quantidade</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={addRecQtd}
                  onChange={(e) => setAddRecQtd(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-600">Ticket médio (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={addRecTicket}
                  onChange={(e) => setAddRecTicket(e.target.value)}
                />
              </div>
            </div>
            {addRecQtd && addRecTicket && !isNaN(parseFloat(addRecQtd)) && !isNaN(parseFloat(addRecTicket)) && (
              <p className="text-sm text-emerald-700 font-medium">
                Total: {formatMoney(parseFloat(addRecQtd.replace(",", ".")) * parseFloat(addRecTicket.replace(",", ".")))}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddReceita(false)}>Cancelar</Button>
            <Button
              onClick={handleAddReceita}
              disabled={addRecLoading || !addRecTipoItem.trim() || !addRecQtd || !addRecTicket}
            >
              {addRecLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Adicionar despesa planejada */}
      <Dialog open={showAddDespesaPlano} onOpenChange={setShowAddDespesaPlano}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova despesa planejada</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-600">Categoria</Label>
              <Input
                list="cats-list"
                placeholder="Ex: Custo Fixo, Colaboradores..."
                value={addDespCategoria}
                onChange={(e) => setAddDespCategoria(e.target.value)}
                autoFocus
              />
              <datalist id="cats-list">
                {["Custo Fixo", "Custo Variável", "Colaboradores", "Espaço Físico", "Marketing", "Transporte", ...categoriasExistentes]
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-600">Tipo de item</Label>
              <Input
                placeholder="Ex: Pró-Labore, Aluguel..."
                value={addDespTipoItem}
                onChange={(e) => setAddDespTipoItem(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-600">Detalhe (opcional)</Label>
              <Input
                placeholder="Ex: Funcionária 1, Sala de costura..."
                value={addDespDetalhe}
                onChange={(e) => setAddDespDetalhe(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-600">Valor planejado (R$)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={addDespValor}
                onChange={(e) => setAddDespValor(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDespesaPlano(false)}>Cancelar</Button>
            <Button
              onClick={handleAddDespesaPlano}
              disabled={addDespPlanoLoading || !addDespTipoItem.trim() || !addDespValor}
            >
              {addDespPlanoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Adicionar despesa realizada */}
      <Dialog open={showAddDespesa} onOpenChange={setShowAddDespesa}>
        <DialogContent className="max-w-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar despesa realizada</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="add-mes" className="text-xs font-medium text-gray-600">Mês</Label>
                <select
                  id="add-mes"
                  value={addDespesaMes}
                  onChange={(e) => {
                    setAddDespesaMes(e.target.value);
                    authFetch(`${API_URL}/api/v1/plano/opcoes-despesa?mes=${e.target.value}`)
                      .then((r) => r.json())
                      .then(setOpcoesDespesa)
                      .catch(() => setOpcoesDespesa([]));
                  }}
                  className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  {mesesParaSelect.map((m) => (
                    <option key={m} value={m}>{formatMes(m)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-valor" className="text-xs font-medium text-gray-600">Valor (R$)</Label>
                <Input
                  id="add-valor"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={addDespesaValor}
                  onChange={(e) => setAddDespesaValor(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-categoria" className="text-xs font-medium text-gray-600">Categoria</Label>
              <select
                id="add-categoria"
                value={addDespesaCategoria}
                onChange={(e) => setAddDespesaCategoria(e.target.value)}
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Selecione...</option>
                {opcoesDespesa.map((o) => (
                  <option key={o.label} value={o.label}>{o.detalhe || o.tipo_item}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-descricao" className="text-xs font-medium text-gray-600">Descrição (opcional)</Label>
              <Textarea
                id="add-descricao"
                placeholder="Ex: Pagamento referente a..."
                value={addDespesaDescricao}
                onChange={(e) => setAddDespesaDescricao(e.target.value)}
                rows={2}
                className="resize-none text-sm"
              />
            </div>
          </div>
          <DialogFooter className="flex-row gap-2 sm:gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowAddDespesa(false)} className="flex-1 sm:flex-initial">
              Cancelar
            </Button>
            <Button
              onClick={handleAddDespesa}
              disabled={addDespesaLoading || !addDespesaCategoria || !addDespesaValor}
              className="flex-1 sm:flex-initial"
            >
              {addDespesaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
