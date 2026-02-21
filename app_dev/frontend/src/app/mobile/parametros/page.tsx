"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, List } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

function formatMoney(val: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(val);
}

export default function ParametrosPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [impostos, setImpostos] = useState("0.06");
  const [cartaoCredito, setCartaoCredito] = useState("0.03");
  const [totalHorasMes, setTotalHorasMes] = useState("160");
  const [margemTarget, setMargemTarget] = useState("0.25");
  const [totalDespesas, setTotalDespesas] = useState(0);

  const fetchParametros = () => {
    fetch(`${API_URL}/api/v1/parametros`)
      .then((res) => res.json())
      .then((data) => {
        setImpostos(String(data.impostos ?? 0.06));
        setCartaoCredito(String(data.cartao_credito ?? 0.03));
        setTotalHorasMes(String(data.total_horas_mes ?? 160));
        setMargemTarget(String(data.margem_target ?? 0.25));
        setTotalDespesas(data.total_despesas ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchParametros();
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") fetchParametros();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const { precoHora, faturamentoTarget } = useMemo(() => {
    const total = totalDespesas;
    const horas = parseFloat(totalHorasMes) || 0;
    const imp = parseFloat(impostos) || 0;
    const cartao = parseFloat(cartaoCredito) || 0;
    const margem = parseFloat(margemTarget) || 0;
    const preco = horas > 0 && total > 0 ? Math.round((total / horas) * 100) / 100 : 0;
    const denom = 1 - imp - cartao - margem;
    const fat = denom > 0 && total > 0 ? Math.round((total / denom) * 100) / 100 : null;
    return { precoHora: preco, faturamentoTarget: fat };
  }, [totalDespesas, totalHorasMes, impostos, cartaoCredito, margemTarget]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/parametros`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          impostos: parseFloat(impostos),
          cartao_credito: parseFloat(cartaoCredito),
          total_horas_mes: parseFloat(totalHorasMes) || null,
          margem_target: parseFloat(margemTarget) || null,
        }),
      });
      if (!res.ok) throw new Error("Erro");
      const data = await res.json();
      setTotalDespesas(data.total_despesas ?? 0);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div className="flex items-center gap-2">
        <Link href="/mobile">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Parâmetros Orçamento
          </h2>
          <p className="text-sm text-gray-500">
            Preço/hora, impostos e taxas para cálculo de margens
          </p>
        </div>
      </div>

      {/* Total Despesas - vem da base de despesas detalhadas */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs text-gray-500">Total Despesas</Label>
            <p className="text-lg font-semibold text-gray-900 mt-0.5">
              {formatMoney(totalDespesas)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Soma das despesas detalhadas
            </p>
          </div>
          <Link href="/mobile/despesas">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              Despesas
            </Button>
          </Link>
        </div>
      </div>

      {/* Preço por hora - calculado: total_despesas / total_horas_mes */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <Label className="text-xs text-gray-500">Preço por Hora</Label>
        <p className="text-lg font-semibold text-gray-900 mt-0.5">
          {formatMoney(precoHora)}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Total Despesas ÷ Total Horas/Mês
        </p>
      </div>

      {/* Faturamento Target - calculado */}
      {faturamentoTarget != null && faturamentoTarget > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <Label className="text-xs text-gray-500">Faturamento Target</Label>
          <p className="text-lg font-semibold text-gray-900 mt-0.5">
            {formatMoney(faturamentoTarget)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Total Despesas ÷ (1 − Impostos − Cartão − Margem)
          </p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700">Campos editáveis</h3>
        <div>
          <Label htmlFor="impostos">Impostos (0.06 = 6%)</Label>
          <Input
            id="impostos"
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={impostos}
            onChange={(e) => setImpostos(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="cartaoCredito">Cartão Crédito (0.03 = 3%)</Label>
          <Input
            id="cartaoCredito"
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={cartaoCredito}
            onChange={(e) => setCartaoCredito(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="totalHorasMes">Total Horas/Mês</Label>
          <Input
            id="totalHorasMes"
            type="number"
            min="0"
            value={totalHorasMes}
            onChange={(e) => setTotalHorasMes(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="margemTarget">Margem Target (0.25 = 25%)</Label>
          <Input
            id="margemTarget"
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={margemTarget}
            onChange={(e) => setMargemTarget(e.target.value)}
            className="mt-1"
          />
        </div>
        <Button type="submit" disabled={saving} className="w-full">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </form>
    </div>
  );
}
