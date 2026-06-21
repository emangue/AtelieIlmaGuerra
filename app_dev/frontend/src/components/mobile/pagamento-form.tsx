"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";

export interface ParcelaConfig {
  valor: number;
  data_vencimento: string;   // YYYY-MM-DD
  data_pagamento: string | null;
}

export interface EntradaConfig {
  valor: number;
  data_pagamento: string | null;   // data em que a entrada foi paga (ou null = ainda não)
}

export interface PagamentoConfig {
  pagamento_na_entrega: boolean;
  forma_pagamento: string | null;
  entrada: EntradaConfig | null;   // null = sem entrada
  parcelas: ParcelaConfig[];
}

interface Props {
  valorPecas: number;
  config: PagamentoConfig;
  onChange: (c: PagamentoConfig) => void;
}

// Pix = sempre 1 parcela; Crediário e Cartão de Crédito = N parcelas
const FORMAS = ["Pix", "Crediário", "Cartão de Crédito"] as const;
const FORMAS_PARCELADAS = ["Crediário", "Cartão de Crédito"];

function addMonths(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function gerarParcelas(
  valorTotal: number,
  valorEntrada: number,
  n: number,
  primeiroVencimento: string,
  pagamentosExistentes: (string | null)[]
): ParcelaConfig[] {
  if (n <= 0 || !primeiroVencimento) return [];
  const base = Math.max(0, valorTotal - valorEntrada);
  const valorParcela = Math.round((base / n) * 100) / 100;
  const resto = Math.round((base - valorParcela * n) * 100) / 100;
  return Array.from({ length: n }, (_, i) => ({
    valor: i === n - 1 ? Math.round((valorParcela + resto) * 100) / 100 : valorParcela,
    data_vencimento: addMonths(primeiroVencimento, i),
    data_pagamento: pagamentosExistentes[i] ?? null,
  }));
}

// ─── Componente para criação (novo pedido) ───────────────────────────────────
export function PagamentoForm({ valorPecas, config, onChange }: Props) {
  const [nParcelasStr, setNParcelasStr] = useState("1");
  const nParcelas = Math.max(1, parseInt(nParcelasStr) || 1);
  const [primeiroVenc, setPrimeiroVenc] = useState(todayISO());
  const [temEntrada, setTemEntrada] = useState(false);

  const isParcelado = FORMAS_PARCELADAS.includes(config.forma_pagamento ?? "");

  // Regenera parcelas quando muda nº, data ou entrada
  useEffect(() => {
    if (config.pagamento_na_entrega) return;
    const n = isParcelado ? nParcelas : 1;
    const valorEntrada = temEntrada ? (config.entrada?.valor ?? 0) : 0;
    const existentes = config.parcelas.map((p) => p.data_pagamento);
    const novas = gerarParcelas(valorPecas, valorEntrada, n, primeiroVenc, existentes);
    onChange({ ...config, parcelas: novas });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nParcelas, primeiroVenc, valorPecas, config.pagamento_na_entrega, isParcelado, temEntrada]);

  const setEntradaField = (field: keyof EntradaConfig, val: string | number | null) => {
    const e: EntradaConfig = { valor: config.entrada?.valor ?? 0, data_pagamento: config.entrada?.data_pagamento ?? null };
    onChange({ ...config, entrada: { ...e, [field]: val } });
  };

  const setPago = (i: number, val: string) => {
    const novas = config.parcelas.map((p, idx) =>
      idx === i ? { ...p, data_pagamento: val || null } : p
    );
    onChange({ ...config, parcelas: novas });
  };

  return (
    <div className="space-y-4">
      {/* Toggle pagar na entrega */}
      <Toggle
        label="Pagar na entrega"
        sub="Combinou pagar quando buscar a peça"
        value={config.pagamento_na_entrega}
        onChange={(v) => onChange({ ...config, pagamento_na_entrega: v, parcelas: [], entrada: null })}
      />

      {!config.pagamento_na_entrega && (
        <>
          {/* Forma de pagamento */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Forma de pagamento</p>
            <div className="grid grid-cols-3 gap-2">
              {FORMAS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    const nova = config.forma_pagamento === f ? null : f;
                    // Se mudar para Pix, força 1 parcela
                    if (nova === "Pix") setNParcelasStr("1");
                    onChange({ ...config, forma_pagamento: nova });
                  }}
                  className={`py-2 px-2 rounded-lg text-sm font-medium border text-center ${
                    config.forma_pagamento === f
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle entrada */}
          <Toggle
            label="Tem entrada?"
            sub="Parte do valor pago antes da entrega"
            value={temEntrada}
            onChange={(v) => {
              setTemEntrada(v);
              onChange({ ...config, entrada: v ? { valor: 0, data_pagamento: null } : null });
            }}
          />

          {temEntrada && (
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 flex flex-col gap-3">
              <p className="text-xs font-medium text-gray-500">Entrada</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Valor (R$)</p>
                  <input
                    type="number" min={0} step={0.01}
                    value={config.entrada?.valor || ""}
                    onChange={(e) => setEntradaField("valor", parseFloat(e.target.value) || 0)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Pago em (opcional)</p>
                  <input
                    type="date"
                    value={config.entrada?.data_pagamento || ""}
                    onChange={(e) => setEntradaField("data_pagamento", e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Config parcelas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Nº de parcelas</p>
              <input
                type="number" min={1} max={24}
                value={nParcelasStr}
                disabled={!isParcelado}
                onChange={(e) => setNParcelasStr(e.target.value)}
                onBlur={() => setNParcelasStr(String(nParcelas))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-100 disabled:text-gray-400"
              />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">
                {nParcelas === 1 ? "Data de vencimento" : "Data do 1º vencimento"}
              </p>
              <input
                type="date" value={primeiroVenc}
                onChange={(e) => setPrimeiroVenc(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Preview das parcelas geradas */}
          {config.parcelas.length > 0 && (
            <div className="flex flex-col gap-2">
              {config.parcelas.map((p, i) => (
                <ParcelaRow
                  key={i}
                  label={config.parcelas.length === 1 ? "Pagamento" : `${i + 1}ª parcela`}
                  valor={p.valor}
                  vencimento={p.data_vencimento}
                  pago={p.data_pagamento}
                  onPago={(v) => setPago(i, v)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Componente para edição (pedido existente) ───────────────────────────────
interface PagamentoFormEditProps {
  pedidoId: number;
  valorPecas: number;
  apiUrl: string;
  formaPagamento: string | null;
  pagamentoNaEntrega: boolean | null;
  onFormaPagamentoChange: (f: string | null) => void;
}

interface ParcelaOut {
  id: number;
  parcela_numero: number | null;
  parcela_total: number | null;
  valor: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: string;
}

interface ParcelaRowState {
  id?: number;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status?: string;
}

const PAG_STATUS_CLS: Record<string, string> = {
  confirmado: "text-green-600 bg-green-50 border-green-200",
  aguardando: "text-amber-600 bg-amber-50 border-amber-200",
  em_atraso: "text-red-600 bg-red-50 border-red-200",
};
const PAG_STATUS_LABEL: Record<string, string> = {
  confirmado: "Pago",
  aguardando: "Aguardando",
  em_atraso: "Em atraso",
};

export function PagamentoFormEdit({
  pedidoId, valorPecas, apiUrl, formaPagamento, pagamentoNaEntrega, onFormaPagamentoChange,
}: PagamentoFormEditProps) {
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parcelasExist, setParcelasExist] = useState<ParcelaRowState[]>([]);
  const [nParcelasStr, setNParcelasStr] = useState("1");
  const nParcelas = Math.max(1, parseInt(nParcelasStr) || 1);
  const [primeiroVenc, setPrimeiroVenc] = useState(todayISO());
  const [pnEntrega, setPnEntrega] = useState(pagamentoNaEntrega ?? false);
  const [temEntrada, setTemEntrada] = useState(false);
  const [entrada, setEntrada] = useState<EntradaConfig>({ valor: 0, data_pagamento: null });

  const isParcelado = FORMAS_PARCELADAS.includes(formaPagamento ?? "");

  const loadParcelas = () => {
    if (!pedidoId || isNaN(pedidoId)) { setLoaded(true); return; }
    setLoaded(false);
    fetch(`${apiUrl}/api/v1/pedidos/${pedidoId}/parcelas`)
      .then((r) => r.json())
      .then((data: ParcelaOut[]) => {
        const rows = data.map((p) => ({
          id: p.id,
          valor: p.valor,
          data_vencimento: p.data_vencimento || todayISO(),
          data_pagamento: p.data_pagamento,
          status: p.status,
        }));
        setParcelasExist(rows);
        if (rows.length > 0) setNParcelasStr(String(rows.length));
        setLoaded(true);
      })
      .catch(() => { setParcelasExist([]); setLoaded(true); });
  };

  useEffect(() => { loadParcelas(); }, [pedidoId]);

  // Regenera preview
  const valorEntrada = temEntrada ? entrada.valor : 0;
  const preview: ParcelaRowState[] = gerarParcelas(
    valorPecas,
    valorEntrada,
    isParcelado ? nParcelas : 1,
    primeiroVenc,
    parcelasExist.map((p) => p.data_pagamento)
  ).map((g, i) => ({ ...g, id: parcelasExist[i]?.id, status: parcelasExist[i]?.status }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`${apiUrl}/api/v1/pedidos/${pedidoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forma_pagamento: formaPagamento, pagamento_na_entrega: pnEntrega }),
      });
      if (!pnEntrega) {
        await fetch(`${apiUrl}/api/v1/pedidos/${pedidoId}/pagamento`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            forma_pagamento: formaPagamento,
            entrada: temEntrada ? { valor: entrada.valor, data_vencimento: primeiroVenc, data_pagamento: entrada.data_pagamento } : null,
            parcelas: preview.map((p) => ({
              valor: p.valor,
              data_vencimento: p.data_vencimento,
              data_pagamento: p.data_pagamento,
            })),
          }),
        });
      }
      loadParcelas();
    } finally { setSaving(false); }
  };

  if (!loaded) return <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-4">
      <Toggle
        label="Pagar na entrega"
        sub="Combinou pagar quando buscar a peça"
        value={pnEntrega}
        onChange={setPnEntrega}
      />

      {!pnEntrega && (
        <>
          {/* Forma */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Forma de pagamento</p>
            <div className="grid grid-cols-3 gap-2">
              {FORMAS.map((f) => (
                <button key={f} type="button"
                  onClick={() => {
                    const nova = formaPagamento === f ? null : f;
                    if (nova === "Pix") setNParcelasStr("1");
                    onFormaPagamentoChange(nova);
                  }}
                  className={`py-2 px-2 rounded-lg text-sm font-medium border text-center ${
                    formaPagamento === f
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle entrada */}
          <Toggle
            label="Tem entrada?"
            sub="Parte do valor pago antes da entrega"
            value={temEntrada}
            onChange={setTemEntrada}
          />

          {temEntrada && (
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 flex flex-col gap-3">
              <p className="text-xs font-medium text-gray-500">Entrada</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Valor (R$)</p>
                  <input
                    type="number" min={0} step={0.01}
                    value={entrada.valor || ""}
                    onChange={(e) => setEntrada((x) => ({ ...x, valor: parseFloat(e.target.value) || 0 }))}
                    placeholder="0,00"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Pago em (opcional)</p>
                  <input
                    type="date"
                    value={entrada.data_pagamento || ""}
                    onChange={(e) => setEntrada((x) => ({ ...x, data_pagamento: e.target.value || null }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Config parcelas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Nº de parcelas</p>
              <input
                type="number" min={1} max={24}
                value={nParcelasStr}
                disabled={!isParcelado}
                onChange={(e) => setNParcelasStr(e.target.value)}
                onBlur={() => setNParcelasStr(String(nParcelas))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-100 disabled:text-gray-400"
              />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">
                {(isParcelado ? nParcelas : 1) === 1 ? "Data de vencimento" : "Data do 1º vencimento"}
              </p>
              <input
                type="date" value={primeiroVenc}
                onChange={(e) => setPrimeiroVenc(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Preview parcelas */}
          {preview.length > 0 && (
            <div className="flex flex-col gap-2">
              {preview.map((p, i) => (
                <ParcelaRow
                  key={i}
                  label={preview.length === 1 ? "Pagamento" : `${i + 1}ª parcela`}
                  valor={p.valor}
                  vencimento={p.data_vencimento}
                  pago={p.data_pagamento}
                  status={p.status}
                  onPago={(v) => setParcelasExist((prev) => {
                    const clone = [...prev];
                    if (clone[i]) clone[i] = { ...clone[i], data_pagamento: v || null };
                    return clone;
                  })}
                />
              ))}
            </div>
          )}

          <button
            type="button" disabled={saving} onClick={handleSave}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Salvar pagamento
          </button>
        </>
      )}

      {pnEntrega && (
        <button
          type="button" disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await fetch(`${apiUrl}/api/v1/pedidos/${pedidoId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pagamento_na_entrega: true }),
              });
            } finally { setSaving(false); }
          }}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Salvar configuração
        </button>
      )}
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function Toggle({ label, sub, value, onChange }: { label: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-gray-50">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400">{sub}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${value ? "bg-blue-500" : "bg-gray-300"}`}
      >
        <span
          className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200"
          style={{ left: value ? "calc(100% - 20px)" : "4px" }}
        />
      </button>
    </div>
  );
}

function ParcelaRow({ label, valor, vencimento, pago, status, onPago }: {
  label: string;
  valor: number;
  vencimento: string;
  pago: string | null;
  status?: string;
  onPago: (v: string) => void;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        {status && PAG_STATUS_LABEL[status] && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${PAG_STATUS_CLS[status]}`}>
            {PAG_STATUS_LABEL[status]}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-[10px] text-gray-400 mb-1">Valor</p>
          <p className="text-xs font-semibold text-gray-800">
            R$ {valor.toFixed(2).replace(".", ",")}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 mb-1">Vencimento</p>
          <p className="text-xs text-gray-700">
            {new Date(vencimento + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 mb-1">Pago em</p>
          <input
            type="date"
            value={pago || ""}
            onChange={(e) => onPago(e.target.value)}
            className="w-full px-1.5 py-1 border border-gray-200 rounded-lg text-[10px]"
          />
        </div>
      </div>
    </div>
  );
}
