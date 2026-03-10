"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Plus,
  Copy,
} from "lucide-react";
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

export default function PlanoPage() {
  const [ano, setAno] = useState(2026);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumo, setResumo] = useState<PlanoResumoMes[]>([]);
  const [itens, setItens] = useState<PlanoItem[]>([]);
  const [mesExpandido, setMesExpandido] = useState<string | null>(null);

  // Modal editar
  const [editItem, setEditItem] = useState<PlanoItem | null>(null);
  const [editValor, setEditValor] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [aplicarFuturosLoading, setAplicarFuturosLoading] = useState(false);

  // Modal deletar
  const [deleteItem, setDeleteItem] = useState<PlanoItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Modal adicionar despesa realizada
  const [showAddDespesa, setShowAddDespesa] = useState(false);
  const [addDespesaMes, setAddDespesaMes] = useState("");
  const [opcoesDespesa, setOpcoesDespesa] = useState<OpcaoDespesa[]>([]);
  const [addDespesaCategoria, setAddDespesaCategoria] = useState("");
  const [addDespesaValor, setAddDespesaValor] = useState("");
  const [addDespesaDescricao, setAddDespesaDescricao] = useState("");
  const [addDespesaLoading, setAddDespesaLoading] = useState(false);

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

  const handleEdit = (item: PlanoItem) => {
    setEditItem(item);
    setEditValor(String(item.valor_planejado));
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    const val = parseFloat(editValor.replace(",", "."));
    if (isNaN(val) || val < 0) return;
    setEditLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/plano/${editItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor_planejado: val }),
      });
      if (res.ok) {
        setEditItem(null);
        fetchData();
      }
    } finally {
      setEditLoading(false);
    }
  };

  const handleAplicarFuturos = async () => {
    if (!editItem) return;
    setAplicarFuturosLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/v1/plano/aplicar-aos-futuros?mes_referencia=${editItem.anomes}&item_id=${editItem.id}&criar_ausentes=true`,
        { method: "POST" }
      );
      if (res.ok) {
        setEditItem(null);
        fetchData();
      }
    } finally {
      setAplicarFuturosLoading(false);
    }
  };

  const handleDelete = (item: PlanoItem) => setDeleteItem(item);

  const handleConfirmDelete = async () => {
    if (!deleteItem) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/plano/${deleteItem.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteItem(null);
        fetchData();
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const mesesParaSelect = mesesOrdenados.length > 0
    ? mesesOrdenados
    : Array.from({ length: 12 }, (_, i) => `${ano}${String(i + 1).padStart(2, "0")}`);

  const openAddDespesa = (anomes?: string) => {
    setAddDespesaMes(anomes || mesesParaSelect[0] || `${ano}01`);
    setAddDespesaCategoria("");
    setAddDespesaValor("");
    setAddDespesaDescricao("");
    setShowAddDespesa(true);
    fetch(`${API_URL}/api/v1/plano/opcoes-despesa?mes=${anomes || mesesParaSelect[0] || `${ano}01`}`)
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
      const res = await fetch(`${API_URL}/api/v1/transacoes-despesas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowAddDespesa(false);
        fetchData();
      }
    } finally {
      setAddDespesaLoading(false);
    }
  };

  return (
    <div className="pb-24">
      <div className="sticky top-14 z-40 bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Plano Financeiro</h2>
          <Button
            size="sm"
            onClick={() => openAddDespesa()}
            className="gap-1"
          >
            <Plus className="w-4 h-4" />
            Despesa
          </Button>
        </div>
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
            <Button onClick={fetchData} variant="outline">
              Tentar novamente
            </Button>
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
              {(resumo.some((r) => r.receita_realizada > 0 || r.despesas_realizadas > 0)) && (
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-gray-500">Receita realizada</p>
                    <p className="text-sm font-medium text-emerald-700">
                      {formatMoney(resumo.reduce((s, r) => s + r.receita_realizada, 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Despesas realizadas</p>
                    <p className="text-sm font-medium text-rose-700">
                      {formatMoney(resumo.reduce((s, r) => s + r.despesas_realizadas, 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Lucro realizado</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatMoney(resumo.reduce((s, r) => s + r.lucro_realizado, 0))}
                    </p>
                  </div>
                </div>
              )}
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
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Realizado</th>
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
                        <td className="py-2 px-3 text-right text-rose-600">
                          {r.despesas_realizadas > 0 ? formatMoney(r.despesas_realizadas) : "-"}
                        </td>
                        <td className="py-2 px-3 text-right font-medium">
                          {r.lucro_planejado >= 0 ? (
                            <span className="text-gray-900">{formatMoney(r.lucro_planejado)}</span>
                          ) : (
                            <span className="text-rose-600">{formatMoney(r.lucro_planejado)}</span>
                          )}
                          {r.lucro_realizado !== 0 && (
                            <span className="block text-xs text-gray-500">
                              {formatMoney(r.lucro_realizado)} real.
                            </span>
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
                        <div className="flex items-center">
                          <button
                            onClick={() => setMesExpandido(expandido ? null : anomes)}
                            className="flex-1 flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition"
                          >
                            <span className="font-medium text-gray-900">{formatMes(anomes)}</span>
                            {expandido ? (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-500" />
                            )}
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 mr-1"
                            onClick={() => openAddDespesa(anomes)}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                        {expandido && (
                          <div className="px-4 pb-4 space-y-4">
                            {rec.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-emerald-700 mb-2 flex items-center gap-1">
                                  <TrendingUp className="w-3.5 h-3.5" /> Receita
                                </p>
                                <div className="overflow-x-auto -mx-4 px-4">
                                  <table className="w-full text-sm min-w-[280px]">
                                    <thead>
                                      <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                                        <th className="py-2 pr-2 font-medium">Item</th>
                                        <th className="py-2 text-right font-medium w-24">Planejado</th>
                                        <th className="py-2 w-16"></th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {rec.map((i) => (
                                        <tr key={i.id} className="border-b border-gray-50 last:border-0 group">
                                          <td className="py-2.5 pr-2 text-gray-800">
                                            {i.tipo_item}
                                            {i.quantidade != null ? ` (${i.quantidade})` : ""}
                                          </td>
                                          <td className="py-2.5 text-right font-medium text-emerald-600">
                                            {formatMoney(i.valor_planejado)}
                                          </td>
                                          <td className="py-2.5 text-right">
                                            <span className="inline-flex opacity-0 group-hover:opacity-100 transition">
                                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(i)}>
                                                <Pencil className="w-3.5 h-3.5" />
                                              </Button>
                                              <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600" onClick={() => handleDelete(i)}>
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </Button>
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                            {desp.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-rose-700 mb-2 flex items-center gap-1">
                                  <TrendingDown className="w-3.5 h-3.5" /> Despesas
                                </p>
                                <div className="overflow-x-auto -mx-4 px-4">
                                  <table className="w-full text-sm min-w-[320px]">
                                    <thead>
                                      <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                                        <th className="py-2 pr-2 font-medium">Item</th>
                                        <th className="py-2 text-right font-medium w-20">Planejado</th>
                                        <th className="py-2 text-right font-medium w-20">Realizado</th>
                                        <th className="py-2 w-16"></th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {desp.map((i) => (
                                        <tr key={i.id} className="border-b border-gray-50 last:border-0 group">
                                          <td className="py-2.5 pr-2 text-gray-800">
                                            {i.detalhe || i.tipo_item}
                                            {i.categoria !== i.tipo_item ? (
                                              <span className="text-gray-500"> ({i.tipo_item})</span>
                                            ) : null}
                                          </td>
                                          <td className="py-2.5 text-right font-medium text-rose-600">
                                            {formatMoney(i.valor_planejado)}
                                          </td>
                                          <td className="py-2.5 text-right text-gray-600">
                                            {i.valor_realizado != null && i.valor_realizado > 0
                                              ? formatMoney(i.valor_realizado)
                                              : "—"}
                                          </td>
                                          <td className="py-2.5 text-right">
                                            <span className="inline-flex opacity-0 group-hover:opacity-100 transition">
                                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(i)}>
                                                <Pencil className="w-3.5 h-3.5" />
                                              </Button>
                                              <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600" onClick={() => handleDelete(i)}>
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </Button>
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
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

      {/* Modal Editar */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar valor planejado</DialogTitle>
          </DialogHeader>
          {editItem && (
            <>
              <p className="text-sm text-gray-600">
                {editItem.detalhe || editItem.tipo_item} ({formatMes(editItem.anomes)})
              </p>
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={editValor}
                  onChange={(e) => setEditValor(e.target.value)}
                  className="mt-1"
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={handleAplicarFuturos}
                  disabled={aplicarFuturosLoading}
                  className="gap-1"
                >
                  {aplicarFuturosLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  Aplicar aos próximos meses
                </Button>
                <Button onClick={handleSaveEdit} disabled={editLoading}>
                  {editLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

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
                    fetch(`${API_URL}/api/v1/plano/opcoes-despesa?mes=${e.target.value}`)
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
                  <option key={o.label} value={o.label}>{o.label}</option>
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
