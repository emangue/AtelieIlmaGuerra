"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Check, Loader2, Plus, Pencil, Trash2, X } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

interface DespesaItem {
  id: number;
  detalhe: string;
  valor: number;
  grupo: string | null;
}

function formatMoney(val: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(val);
}

export default function DespesasPage() {
  const [despesas, setDespesas] = useState<DespesaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValor, setEditingValor] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [detalhe, setDetalhe] = useState("");
  const [valor, setValor] = useState("");
  const [grupo, setGrupo] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDespesas = () => {
    fetch(`${API_URL}/api/v1/despesas`)
      .then((res) => res.json())
      .then(setDespesas)
      .catch(() => setDespesas([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDespesas();
  }, []);

  const resetForm = () => {
    setDetalhe("");
    setValor("");
    setGrupo("");
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detalhe.trim()) return;
    const v = parseFloat(valor);
    if (isNaN(v) || v < 0) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/despesas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          detalhe: detalhe.trim(),
          valor: v,
          grupo: grupo.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Erro");
      resetForm();
      fetchDespesas();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleEditStart = (d: DespesaItem) => {
    setEditingId(d.id);
    setEditingValor(String(d.valor));
  };

  const handleEditSave = async () => {
    if (editingId === null) return;
    const v = parseFloat(editingValor.replace(",", "."));
    if (isNaN(v) || v < 0) return;
    setSavingId(editingId);
    try {
      const res = await fetch(`${API_URL}/api/v1/despesas/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor: v }),
      });
      if (!res.ok) throw new Error("Erro");
      setEditingId(null);
      fetchDespesas();
    } catch {
      // ignore
    } finally {
      setSavingId(null);
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditingValor("");
  };

  const handleDeleteClick = (id: number) => {
    setDeleteConfirmId(id);
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirmId === null) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/despesas/${deleteConfirmId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erro");
      setDeleteConfirmId(null);
      fetchDespesas();
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };

  const total = despesas.reduce((s, d) => s + d.valor, 0);

  const porGrupo = despesas.reduce<Record<string, DespesaItem[]>>((acc, d) => {
    const key = d.grupo?.trim() || "Sem grupo";
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});
  const gruposOrdenados = Object.keys(porGrupo).sort((a, b) =>
    a === "Sem grupo" ? 1 : b === "Sem grupo" ? -1 : a.localeCompare(b)
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pb-24">
      <div className="flex items-center gap-2">
        <Link href="/mobile/parametros">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Despesas Detalhadas
          </h2>
          <p className="text-sm text-gray-500">
            Base de despesas que alimenta Total Despesas nos parâmetros
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-500">Total</p>
        <p className="text-2xl font-bold text-gray-900">{formatMoney(total)}</p>
      </div>

      {despesas.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center text-gray-500">
          Nenhuma despesa. Clique em + para adicionar.
        </div>
      ) : (
        <div className="space-y-4">
          {gruposOrdenados.map((grupoNome) => {
            const itens = porGrupo[grupoNome];
            const subtotal = itens.reduce((s, d) => s + d.valor, 0);
            return (
              <div
                key={grupoNome}
                className="rounded-xl border border-gray-200 bg-white overflow-hidden"
              >
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">{grupoNome}</span>
                    <span className="text-sm font-semibold text-gray-700">
                      {formatMoney(subtotal)}
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {itens.map((d) => {
                    const isEditing = editingId === d.id;
                    return (
                      <div
                        key={d.id}
                        className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50/50"
                      >
                        <p className="flex-1 min-w-0 text-gray-900 font-medium truncate">
                          {d.detalhe}
                        </p>
                        {isEditing ? (
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={editingValor}
                            onChange={(e) => setEditingValor(e.target.value)}
                            className="h-9 w-24 text-right shrink-0"
                            placeholder="0,00"
                            autoFocus
                          />
                        ) : (
                          <span className="text-sm font-medium text-gray-700 shrink-0 min-w-[4rem] text-right">
                            {formatMoney(d.valor)}
                          </span>
                        )}
                        <div className="flex items-center shrink-0 gap-1">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={handleEditSave}
                                disabled={savingId === d.id}
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-green-50 active:bg-green-100 text-gray-500 hover:text-green-600 touch-manipulation disabled:opacity-50"
                                aria-label="Confirmar"
                              >
                                {savingId === d.id ? (
                                  <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                  <Check className="h-5 w-5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={handleEditCancel}
                                disabled={savingId === d.id}
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 active:bg-gray-200 text-gray-500 touch-manipulation disabled:opacity-50"
                                aria-label="Cancelar"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleEditStart(d)}
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 active:bg-gray-200 text-gray-500 touch-manipulation"
                                aria-label="Editar"
                              >
                                <Pencil className="h-5 w-5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteClick(d.id)}
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-50 active:bg-red-100 text-gray-500 hover:text-red-600 touch-manipulation"
                                aria-label="Excluir"
                              >
                                <Trash2 className="h-5 w-5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-200 bg-white p-4 space-y-4"
        >
          <h3 className="font-medium text-gray-900">Nova despesa</h3>
          <div>
            <Label>Detalhe *</Label>
            <Input
              value={detalhe}
              onChange={(e) => setDetalhe(e.target.value)}
              placeholder="Ex: Luz, Aluguel, Pró-Labore"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label>Valor (R$) *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label>Grupo</Label>
            <Input
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
              placeholder="Ex: Espaço Físico, Colaboradores"
              className="mt-1"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Adicionar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Nova despesa
        </Button>
      )}

      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover despesa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta despesa? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => handleDeleteConfirm()}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remover"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
