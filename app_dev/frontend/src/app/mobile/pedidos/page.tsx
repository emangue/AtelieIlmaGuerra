"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Pencil,
  Ruler,
  Scissors,
  Play,
  Package,
  Check,
  Calendar,
  Loader2,
  ImageIcon,
  Search,
  FileText,
  CreditCard,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import { getToken } from "@/lib/api-client";
import { FORMAS_PAGAMENTO } from "@/lib/formas-pagamento";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

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
  valor_pecas: number | null;
  quantidade_pecas: number | null;
  forma_pagamento: string | null;
  pagamento_na_entrega: boolean | null;
  status_pagamento: string | null;
  parcelas_pagas: number | null;
  parcelas_total: number | null;
}

interface ParcelaForm {
  valor: string;
  data_vencimento: string;
  data_pagamento: string;
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "numeric", month: "numeric", year: "numeric" });
  } catch { return iso; }
}

function formatMoney(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  Encomenda:  { label: "Encomenda",  cls: "bg-violet-50 text-violet-700" },
  Cortado:    { label: "Cortado",    cls: "bg-blue-50 text-blue-700" },
  Provado:    { label: "Provado",    cls: "bg-amber-50 text-amber-700" },
  Pronto:     { label: "Pronto",     cls: "bg-green-50 text-green-700" },
  Entregue:   { label: "Entregue",   cls: "bg-emerald-50 text-emerald-700" },
};

const PAG_BADGE: Record<string, { label: string; cls: string }> = {
  confirmado: { label: "Pago",       cls: "bg-green-50 text-green-700" },
  aguardando: { label: "Aguardando", cls: "bg-amber-50 text-amber-700" },
  em_atraso:  { label: "Em atraso",  cls: "bg-red-50 text-red-700" },
};


// ── Modal de pagamento ao marcar Entregue ──────────────────────────────────
type ModalStep = "choose" | "parcelar";

interface EntregueModalProps {
  pedido: PedidoItem;
  onClose: () => void;
  onConfirm: (pedido: PedidoItem, config: ParcelasConfigPayload | null) => Promise<void>;
}

interface ParcelasConfigPayload {
  forma_pagamento: string | null;
  entrada: { valor: number; data_vencimento: string; data_pagamento: string | null } | null;
  parcelas: { valor: number; data_vencimento: string; data_pagamento: string | null }[];
}

function EntregueModal({ pedido, onClose, onConfirm }: EntregueModalProps) {
  const [step, setStep] = useState<ModalStep>("choose");
  const [saving, setSaving] = useState(false);

  // form de parcelamento
  const [forma, setForma] = useState(pedido.forma_pagamento || "Pix");
  const [temEntrada, setTemEntrada] = useState(false);
  const [entrada, setEntrada] = useState<ParcelaForm>({
    valor: pedido.valor_pecas ? String(pedido.valor_pecas) : "",
    data_vencimento: todayISO(),
    data_pagamento: todayISO(),
  });
  const [parcelas, setParcelas] = useState<ParcelaForm[]>([
    { valor: "", data_vencimento: todayISO(), data_pagamento: "" },
  ]);

  const addParcela = () => setParcelas((p) => [...p, { valor: "", data_vencimento: todayISO(), data_pagamento: "" }]);
  const removeParcela = (i: number) => setParcelas((p) => p.filter((_, idx) => idx !== i));
  const updateParcela = (i: number, field: keyof ParcelaForm, val: string) =>
    setParcelas((p) => p.map((x, idx) => (idx === i ? { ...x, [field]: val } : x)));

  const handleJaRecebi = async () => {
    setSaving(true);
    await onConfirm(pedido, {
      forma_pagamento: pedido.forma_pagamento || "Pix",
      entrada: null,
      parcelas: [{
        valor: pedido.valor_pecas || 0,
        data_vencimento: todayISO(),
        data_pagamento: todayISO(),
      }],
    });
    setSaving(false);
  };

  const handleAindaNao = async () => {
    setSaving(true);
    await onConfirm(pedido, null);
    setSaving(false);
  };

  const handleSalvarParcelas = async () => {
    setSaving(true);
    const payload: ParcelasConfigPayload = {
      forma_pagamento: forma,
      entrada: temEntrada ? {
        valor: parseFloat(entrada.valor) || 0,
        data_vencimento: entrada.data_vencimento,
        data_pagamento: entrada.data_pagamento || null,
      } : null,
      parcelas: parcelas.map((p) => ({
        valor: parseFloat(p.valor) || 0,
        data_vencimento: p.data_vencimento,
        data_pagamento: p.data_pagamento || null,
      })),
    };
    await onConfirm(pedido, payload);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-2xl bg-white p-6 pb-safe"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "90vh", overflowY: "auto" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Marcar como Entregue</h3>
            <p className="text-sm text-gray-500">{pedido.cliente_nome}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === "choose" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-600 mb-2">Como foi o pagamento?</p>

            <button
              onClick={handleJaRecebi}
              disabled={saving}
              className="flex items-center gap-3 p-4 rounded-xl border-2 border-green-200 bg-green-50 text-left hover:bg-green-100 disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-800">Já recebi tudo</p>
                <p className="text-xs text-green-600">Pagamento confirmado hoje</p>
              </div>
            </button>

            <button
              onClick={() => setStep("parcelar")}
              disabled={saving}
              className="flex items-center gap-3 p-4 rounded-xl border-2 border-blue-200 bg-blue-50 text-left hover:bg-blue-100 disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-800">Quero parcelar</p>
                <p className="text-xs text-blue-600">Configurar entrada e parcelas</p>
              </div>
            </button>

            <button
              onClick={handleAindaNao}
              disabled={saving}
              className="flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 bg-gray-50 text-left hover:bg-gray-100 disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-gray-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Ainda não recebi</p>
                <p className="text-xs text-gray-500">Marcar como entregue sem registrar pagamento</p>
              </div>
            </button>
          </div>
        )}

        {step === "parcelar" && (
          <div className="flex flex-col gap-4">
            <button onClick={() => setStep("choose")} className="text-sm text-blue-600 text-left">← Voltar</button>

            {/* Forma de pagamento */}
            <div>
              <label className="text-xs uppercase tracking-wide text-gray-400 mb-1 block">Forma de pagamento</label>
              <div className="grid grid-cols-2 gap-2">
                {FORMAS_PAGAMENTO.map((f) => (
                  <button
                    key={f}
                    onClick={() => setForma(f)}
                    className={`py-2 px-3 rounded-lg border text-sm font-medium ${
                      forma === f ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-700"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Entrada */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="tem-entrada"
                  checked={temEntrada}
                  onChange={(e) => setTemEntrada(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="tem-entrada" className="text-sm font-medium text-gray-700">Tem entrada?</label>
              </div>
              {temEntrada && (
                <div className="bg-gray-50 rounded-xl p-3 flex flex-col gap-2">
                  <div>
                    <label className="text-xs text-gray-400">Valor da entrada</label>
                    <input
                      type="number"
                      value={entrada.valor}
                      onChange={(e) => setEntrada({ ...entrada, valor: e.target.value })}
                      placeholder="R$ 0,00"
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-400">Vencimento</label>
                      <input
                        type="date"
                        value={entrada.data_vencimento}
                        onChange={(e) => setEntrada({ ...entrada, data_vencimento: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">Pago em (opcional)</label>
                      <input
                        type="date"
                        value={entrada.data_pagamento}
                        onChange={(e) => setEntrada({ ...entrada, data_pagamento: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Parcelas */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">Parcelas</p>
                <button onClick={addParcela} className="text-xs text-blue-600 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Adicionar
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {parcelas.map((p, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500">Parcela {i + 1}</span>
                      {parcelas.length > 1 && (
                        <button onClick={() => removeParcela(i)} className="text-red-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">Valor</label>
                      <input
                        type="number"
                        value={p.valor}
                        onChange={(e) => updateParcela(i, "valor", e.target.value)}
                        placeholder="R$ 0,00"
                        className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-400">Vencimento</label>
                        <input
                          type="date"
                          value={p.data_vencimento}
                          onChange={(e) => updateParcela(i, "data_vencimento", e.target.value)}
                          className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Pago em (opcional)</label>
                        <input
                          type="date"
                          value={p.data_pagamento}
                          onChange={(e) => updateParcela(i, "data_pagamento", e.target.value)}
                          className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={handleSalvarParcelas} disabled={saving} className="w-full mt-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmar entrega e salvar pagamento
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
// ──────────────────────────────────────────────────────────────────────────

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<PedidoItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [entregueModal, setEntregueModal] = useState<PedidoItem | null>(null);

  const fetchPedidos = () => {
    setLoading(true);
    authFetch(`${API_URL}/api/v1/pedidos/ativos`)
      .then((res) => res.json())
      .then((data) => setPedidos(data))
      .catch(() => setPedidos([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPedidos(); }, []);

  const handleEntregueClick = (pedido: PedidoItem) => {
    setEntregueModal(pedido);
  };

  const handleEntregueConfirm = async (pedido: PedidoItem, config: ParcelasConfigPayload | null) => {
    setUpdatingId(pedido.id);
    try {
      // 1. Marcar status como Entregue
      const statusRes = await authFetch(`${API_URL}/api/v1/pedidos/${pedido.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Entregue" }),
      });
      if (!statusRes.ok) throw new Error("Erro ao atualizar status");

      // 2. Se há configuração de pagamento, salvar parcelas
      if (config && (config.entrada || config.parcelas.length > 0)) {
        await authFetch(`${API_URL}/api/v1/pedidos/${pedido.id}/pagamento`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });
      }

      // Remove da lista de ativos
      setPedidos((prev) => prev.filter((p) => p.id !== pedido.id));
    } catch {
      /* noop */
    } finally {
      setUpdatingId(null);
      setEntregueModal(null);
    }
  };

  const handleStatusClick = async (pedido: PedidoItem, newStatus: string) => {
    if (newStatus === "Entregue") {
      handleEntregueClick(pedido);
      return;
    }
    setUpdatingId(pedido.id);
    try {
      const res = await authFetch(`${API_URL}/api/v1/pedidos/${pedido.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Erro");
      const updated = await res.json();
      setPedidos((prev) => prev.map((p) => (p.id === pedido.id ? { ...p, ...updated } : p)));
    } catch {
      /* noop */
    } finally {
      setUpdatingId(null);
    }
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const pedidosFiltrados = normalizedSearch
    ? pedidos.filter((p) => {
        const texto = [
          p.cliente_nome,
          p.descricao_produto,
          p.tipo_pedido_nome,
          p.status,
          p.valor_pecas != null ? String(p.valor_pecas) : "",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return texto.includes(normalizedSearch);
      })
    : pedidos;

  const grouped = pedidosFiltrados.reduce<Record<string, PedidoItem[]>>((acc, p) => {
    const key = p.data_entrega || "__sem_data__";
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => {
    if (a === "__sem_data__") return 1;
    if (b === "__sem_data__") return -1;
    return new Date(a).getTime() - new Date(b).getTime();
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pb-24">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-gray-900">Pedidos Ativos</h2>
        <p className="text-sm text-gray-500">Pedidos em andamento (exclui orçamentos e entregues)</p>
      </div>

      <Link href="/mobile/pedidos/novo" className="block">
        <Button className="w-full" size="lg">Novo Pedido</Button>
      </Link>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          placeholder="Buscar por cliente ou pedido..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
          aria-label="Buscar pedidos ativos"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
            aria-label="Limpar busca"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : pedidos.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 flex flex-col items-center justify-center min-h-[200px]">
          <Package className="w-12 h-12 text-gray-300 mb-4" />
          <p className="text-gray-500 text-center">Nenhum pedido ativo no momento</p>
          <p className="text-sm text-gray-400 mt-1">Clique em &quot;Novo Pedido&quot; para começar</p>
        </div>
      ) : pedidosFiltrados.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 flex flex-col items-center justify-center min-h-[200px]">
          <Search className="w-12 h-12 text-gray-300 mb-4" />
          <p className="text-gray-500 text-center">Nenhum pedido encontrado</p>
          <p className="text-sm text-gray-400 mt-1">Tente buscar por outro nome ou descrição</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateKey) => (
            <div key={dateKey}>
              <h3 className="text-sm font-medium text-gray-500 mb-3">
                {dateKey === "__sem_data__" ? "Sem data de entrega" : formatDate(dateKey)}
              </h3>
              <div className="space-y-3">
                {grouped[dateKey].map((p) => {
                  const statusBadge = STATUS_BADGE[p.status] ?? { label: p.status, cls: "bg-gray-100 text-gray-700" };
                  const pagBadge = p.status_pagamento ? PAG_BADGE[p.status_pagamento] : null;

                  return (
                    <div key={p.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">

                      {/* Cabeçalho: foto + nome + badges */}
                      <Link href={`/mobile/pedidos/${p.id}`} className="flex gap-3 p-4 pb-3">
                        <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden">
                          {p.foto_url ? (
                            <img src={p.foto_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900">{p.cliente_nome}</span>
                            {p.tipo_pedido_nome && (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 border border-gray-200">
                                {p.tipo_pedido_nome}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{p.descricao_produto || "—"}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusBadge.cls}`}>
                            {statusBadge.label}
                          </span>
                          {pagBadge && (
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${pagBadge.cls}`}>
                              <CreditCard className="w-3 h-3" />
                              {pagBadge.label}
                            </span>
                          )}
                        </div>
                      </Link>

                      {/* Grid de info */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 pb-3 border-t border-gray-100 pt-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Entrega</p>
                          <p className="text-xs text-gray-800">{p.data_entrega ? formatDate(p.data_entrega) : "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Valor</p>
                          <p className="text-xs text-gray-800">{p.valor_pecas != null ? formatMoney(p.valor_pecas) : "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Quantidade</p>
                          <p className="text-xs text-gray-800">
                            {p.quantidade_pecas != null ? `${p.quantidade_pecas} ${p.quantidade_pecas === 1 ? "peça" : "peças"}` : "—"}
                          </p>
                        </div>
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Pagamento</p>
                            {p.forma_pagamento ? (
                              <p className="text-xs text-gray-800">
                                {p.parcelas_total && p.parcelas_total > 1
                                  ? `${p.forma_pagamento} · ${p.parcelas_pagas}/${p.parcelas_total}`
                                  : p.forma_pagamento}
                              </p>
                            ) : p.pagamento_na_entrega ? (
                              <p className="text-xs text-amber-600 font-medium">Na entrega</p>
                            ) : (
                              <p className="text-xs text-gray-400 italic">Legado</p>
                            )}
                          </div>
                          <Link
                            href={`/mobile/pedidos/${p.id}?aba=pagamento`}
                            className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Editar pagamento"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>

                      {/* Linha de ações */}
                      <div className="flex items-center gap-1 px-4 py-2 border-t border-gray-100">
                        <Link
                          href={`/mobile/contratos/novo?cliente_id=${p.cliente_id}`}
                          className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
                          aria-label="Criar contrato"
                        >
                          <FileText className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/mobile/pedidos/${p.id}`}
                          className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
                          aria-label="Editar pedido"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100" aria-label="Medidas">
                          <Ruler className="h-4 w-4" />
                        </button>
                        {/* Botões de status — ativo = azul com fundo */}
                        <button
                          onClick={() => handleStatusClick(p, "Cortado")}
                          disabled={updatingId === p.id}
                          className={`p-1.5 rounded-lg border disabled:opacity-40 ${
                            p.status === "Cortado"
                              ? "border-blue-300 bg-blue-50 text-blue-600"
                              : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
                          }`}
                          aria-label="Cortado"
                        >
                          <Scissors className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleStatusClick(p, "Provado")}
                          disabled={updatingId === p.id}
                          className={`p-1.5 rounded-lg border disabled:opacity-40 ${
                            p.status === "Provado"
                              ? "border-amber-300 bg-amber-50 text-amber-600"
                              : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
                          }`}
                          aria-label="Provado"
                        >
                          <Play className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleStatusClick(p, "Pronto")}
                          disabled={updatingId === p.id}
                          className={`p-1.5 rounded-lg border disabled:opacity-40 ${
                            p.status === "Pronto"
                              ? "border-green-300 bg-green-50 text-green-600"
                              : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
                          }`}
                          aria-label="Pronto"
                        >
                          <Package className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleStatusClick(p, "Entregue")}
                          disabled={updatingId === p.id}
                          className="ml-auto p-1.5 rounded-lg border border-green-200 bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-40"
                          aria-label="Entregue"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Link
        href="/mobile/pedidos/todos"
        className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600"
        aria-label="Lista total de pedidos"
      >
        <Calendar className="h-6 w-6" />
      </Link>

      {entregueModal && (
        <EntregueModal
          pedido={entregueModal}
          onClose={() => setEntregueModal(null)}
          onConfirm={handleEntregueConfirm}
        />
      )}
    </div>
  );
}
