"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, List, Plus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { getToken } from "@/lib/api-client";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

function authFetch(url: string, init?: RequestInit) {
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer `);
  return fetch(url, { ...init, headers });
}

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
    authFetch(`${API_URL}/api/v1/parametros`)
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
      const res = await authFetch(`${API_URL}/api/v1/parametros`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          impostos: parseFloat(impostos),
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

      <CustosReceberSection />
    </div>
  );
}


interface ParametroTaxa {
  id: number;
  forma: string;
  canal: string | null;
  parcelas_min: number | null;
  parcelas_max: number | null;
  percentual: number;
  tipo_custo: string;
  taxa_antecipacao_mes: number | null;
  padrao: boolean;
  ativo: boolean;
  descricao: string;
  deflator: number;
}

const FORMAS_TAXA = ["Cartão", "Pix"];
const CANAIS_TAXA = ["Maquininha", "Link de pagamento"];

interface RascunhoTaxa {
  forma: string;
  canal: string;
  parcelas_min: string;
  parcelas_max: string;
  percentual: string;
  tipo_custo: string;
}

function rascunhoDe(t?: ParametroTaxa): RascunhoTaxa {
  return {
    forma: t?.forma ?? "Cartão",
    canal: t?.canal ?? "Maquininha",
    parcelas_min: t?.parcelas_min != null ? String(t.parcelas_min) : "",
    parcelas_max: t?.parcelas_max != null ? String(t.parcelas_max) : "",
    percentual: t?.percentual != null ? String(t.percentual) : "",
    tipo_custo: t?.tipo_custo ?? "taxa",
  };
}

/**
 * Custo de receber por forma de pagamento, canal e prazo.
 *
 * Substitui o campo único de "cartão crédito": a taxa real varia entre maquininha
 * e link de pagamento, e entre até 6x e até 12x.
 */
function CustosReceberSection() {
  const [taxas, setTaxas] = useState<ParametroTaxa[] | null>(null);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [criando, setCriando] = useState(false);
  const [rascunho, setRascunho] = useState<RascunhoTaxa>(rascunhoDe());
  const [removerId, setRemoverId] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = () => {
    authFetch(`${API_URL}/api/v1/parametros/taxas`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setTaxas)
      .catch(() => setTaxas([]));
  };

  useEffect(carregar, []);

  const fechar = () => {
    setEditandoId(null);
    setCriando(false);
    setErro(null);
  };

  const corpoDoRascunho = () => {
    const pct = parseFloat(rascunho.percentual.replace(",", "."));
    if (isNaN(pct) || pct < 0 || pct > 100) {
      setErro("Informe um percentual entre 0 e 100.");
      return null;
    }
    const ehCartao = rascunho.forma === "Cartão";
    const min = rascunho.parcelas_min ? parseInt(rascunho.parcelas_min) : null;
    const max = rascunho.parcelas_max ? parseInt(rascunho.parcelas_max) : null;
    if (min != null && max != null && min > max) {
      setErro("A parcela inicial não pode ser maior que a final.");
      return null;
    }
    return {
      forma: rascunho.forma,
      // Pix não tem canal nem faixa de parcelas — mandar null evita casar errado no resolver.
      canal: ehCartao ? rascunho.canal : null,
      parcelas_min: ehCartao ? min : null,
      parcelas_max: ehCartao ? max : null,
      percentual: pct,
      tipo_custo: rascunho.tipo_custo,
    };
  };

  const salvar = async () => {
    const body = corpoDoRascunho();
    if (!body) return;
    setSalvando(true);
    setErro(null);
    try {
      const url = criando
        ? `${API_URL}/api/v1/parametros/taxas`
        : `${API_URL}/api/v1/parametros/taxas/${editandoId}`;
      const res = await authFetch(url, {
        method: criando ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(typeof b?.detail === "string" ? b.detail : "Não foi possível salvar.");
      }
      fechar();
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const patch = async (id: number, body: Record<string, unknown>) => {
    setSalvando(true);
    setErro(null);
    try {
      const res = await authFetch(`${API_URL}/api/v1/parametros/taxas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Não foi possível salvar.");
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const remover = async () => {
    if (!removerId) return;
    setSalvando(true);
    setErro(null);
    try {
      const res = await authFetch(`${API_URL}/api/v1/parametros/taxas/${removerId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(typeof b?.detail === "string" ? b.detail : "Não foi possível remover.");
      }
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao remover.");
    } finally {
      setRemoverId(null);
      setSalvando(false);
    }
  };

  if (!taxas) return null;

  const formulario = (
    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-gray-500 mb-1">Forma</p>
          <select
            value={rascunho.forma}
            onChange={(e) =>
              setRascunho((r) => ({
                ...r,
                forma: e.target.value,
                // Pix é desconto que ela dá; cartão é taxa que a adquirente cobra.
                tipo_custo: e.target.value === "Pix" ? "desconto" : "taxa",
              }))
            }
            className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm bg-white"
          >
            {FORMAS_TAXA.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Percentual (%)</p>
          <Input
            type="number" step="0.01" min="0" max="100"
            value={rascunho.percentual}
            onChange={(e) => setRascunho((r) => ({ ...r, percentual: e.target.value }))}
            placeholder="3,49"
          />
        </div>
      </div>

      {rascunho.forma === "Cartão" && (
        <>
          <div>
            <p className="text-xs text-gray-500 mb-1">Onde passou</p>
            <select
              value={rascunho.canal}
              onChange={(e) => setRascunho((r) => ({ ...r, canal: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm bg-white"
            >
              {CANAIS_TAXA.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-gray-500 mb-1">De (parcelas)</p>
              <Input
                type="number" min="1"
                value={rascunho.parcelas_min}
                onChange={(e) => setRascunho((r) => ({ ...r, parcelas_min: e.target.value }))}
                placeholder="1"
              />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Até (parcelas)</p>
              <Input
                type="number" min="1"
                value={rascunho.parcelas_max}
                onChange={(e) => setRascunho((r) => ({ ...r, parcelas_max: e.target.value }))}
                placeholder="6"
              />
            </div>
          </div>
        </>
      )}

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      <div className="flex gap-2">
        <Button size="sm" disabled={salvando} onClick={salvar} className="flex-1">
          {salvando && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          Salvar
        </Button>
        <Button size="sm" variant="outline" disabled={salvando} onClick={fechar}>
          Cancelar
        </Button>
      </div>
    </div>
  );

  return (
    <section className="mt-8">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-gray-700">Custos de receber</h3>
          <p className="text-xs text-gray-500 mt-1">
            Quanto some de cada pagamento. A taxa marcada como padrão é a usada no preço
            sugerido e no faturamento alvo.
          </p>
        </div>
        {!criando && editandoId === null && (
          <Button
            size="sm"
            onClick={() => {
              setRascunho(rascunhoDe());
              setErro(null);
              setCriando(true);
            }}
            className="flex-shrink-0"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nova
          </Button>
        )}
      </div>

      {erro && !criando && editandoId === null && (
        <p className="mt-2 text-xs text-red-600">{erro}</p>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {criando && formulario}

        {taxas.map((t) =>
          editandoId === t.id ? (
            <div key={t.id}>{formulario}</div>
          ) : (
            <div
              key={t.id}
              className={`rounded-xl border p-3 ${
                t.ativo ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {t.descricao}
                    {t.padrao && (
                      <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        padrão
                      </span>
                    )}
                    {!t.ativo && (
                      <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                        inativa
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    {t.tipo_custo === "desconto" ? "Desconto dado" : "Taxa cobrada"} · recebe{" "}
                    {t.deflator.toLocaleString("pt-BR")} de cada 100
                  </p>
                </div>
                <span className="text-sm font-semibold text-gray-900 flex-shrink-0">
                  {t.percentual.toLocaleString("pt-BR")}%
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-3 border-t border-gray-100 pt-2 text-xs">
                <button
                  type="button"
                  className="text-blue-600 hover:underline"
                  onClick={() => {
                    setRascunho(rascunhoDe(t));
                    setErro(null);
                    setCriando(false);
                    setEditandoId(t.id);
                  }}
                >
                  Editar
                </button>
                {!t.padrao && t.ativo && (
                  <button
                    type="button"
                    disabled={salvando}
                    className="text-gray-600 hover:underline disabled:opacity-50"
                    onClick={() => patch(t.id, { padrao: true })}
                  >
                    Tornar padrão
                  </button>
                )}
                <button
                  type="button"
                  disabled={salvando || t.padrao}
                  title={t.padrao ? "A taxa padrão não pode ser desativada" : undefined}
                  className="text-gray-600 hover:underline disabled:opacity-40"
                  onClick={() => patch(t.id, { ativo: !t.ativo })}
                >
                  {t.ativo ? "Desativar" : "Reativar"}
                </button>
                {!t.padrao && (
                  <button
                    type="button"
                    disabled={salvando}
                    className="text-red-600 hover:underline disabled:opacity-50 ml-auto"
                    onClick={() => setRemoverId(t.id)}
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>
          )
        )}
      </div>

      <AlertDialog open={!!removerId} onOpenChange={(o) => !o && setRemoverId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover esta taxa?</AlertDialogTitle>
            <p className="text-sm text-gray-500">
              Pedidos já salvos mantêm o valor que foi calculado na época. Só os próximos
              deixam de usar esta linha.
            </p>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remover} className="bg-red-600 hover:bg-red-700">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
