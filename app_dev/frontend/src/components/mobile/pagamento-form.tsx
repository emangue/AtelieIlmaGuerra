"use client";

/**
 * Componente de configuração de pagamento de pedido.
 * Usado na criação e edição de pedidos.
 *
 * Lógica:
 * - "Pagar na entrega" → nenhuma parcela criada agora, modal abre ao marcar Entregue
 * - "Configurar agora" → forma + valor + nº parcelas + 1º vencimento → gera as outras
 * - Cada parcela exibe campo "Pago em" (pode ficar vazio = não pago)
 */

import React, { useEffect, useState } from "react";
import { Loader2, Check, Plus, Trash2 } from "lucide-react";

export interface ParcelaConfig {
  valor: number;
  data_vencimento: string;   // YYYY-MM-DD
  data_pagamento: string | null;
}

export interface PagamentoConfig {
  pagamento_na_entrega: boolean;
  forma_pagamento: string | null;
  parcelas: ParcelaConfig[];
}

interface Props {
  valorPecas: number;
  config: PagamentoConfig;
  onChange: (c: PagamentoConfig) => void;
}

const FORMAS = ["Pix", "À Vista", "Crediário", "Cartão Parcelado"];

function addMonths(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function gerarParcelas(valor: number, n: number, primeiroVencimento: string): ParcelaConfig[] {
  if (n <= 0 || !primeiroVencimento) return [];
  const valorParcela = Math.round((valor / n) * 100) / 100;
  const resto = Math.round((valor - valorParcela * n) * 100) / 100;
  return Array.from({ length: n }, (_, i) => ({
    valor: i === n - 1 ? Math.round((valorParcela + resto) * 100) / 100 : valorParcela,
    data_vencimento: addMonths(primeiroVencimento, i),
    data_pagamento: null,
  }));
}

export function PagamentoForm({ valorPecas, config, onChange }: Props) {
  const [nParcelas, setNParcelas] = useState(1);
  const [primeiroVenc, setPrimeiroVenc] = useState(todayISO());

  // Gera parcelas automaticamente ao mudar nº ou data
  useEffect(() => {
    if (config.pagamento_na_entrega) return;
    const novas = gerarParcelas(valorPecas, nParcelas, primeiroVenc);
    // preserva data_pagamento já preenchida se a parcela existir
    const merged = novas.map((p, i) => ({
      ...p,
      data_pagamento: config.parcelas[i]?.data_pagamento ?? null,
    }));
    onChange({ ...config, parcelas: merged });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nParcelas, primeiroVenc, valorPecas, config.pagamento_na_entrega]);

  const setPago = (i: number, val: string) => {
    const novas = config.parcelas.map((p, idx) =>
      idx === i ? { ...p, data_pagamento: val || null } : p
    );
    onChange({ ...config, parcelas: novas });
  };

  return (
    <div className="space-y-4">
      {/* Toggle pagar na entrega */}
      <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-gray-50">
        <div>
          <p className="text-sm font-medium text-gray-700">Pagar na entrega</p>
          <p className="text-xs text-gray-400">Combinou pagar quando buscar a peça</p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...config, pagamento_na_entrega: !config.pagamento_na_entrega, parcelas: [] })}
          className={`w-12 h-6 rounded-full transition-colors relative ${
            config.pagamento_na_entrega ? "bg-blue-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              config.pagamento_na_entrega ? "translate-x-7" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {!config.pagamento_na_entrega && (
        <>
          {/* Forma de pagamento */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Forma de pagamento</p>
            <div className="grid grid-cols-2 gap-2">
              {FORMAS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => onChange({ ...config, forma_pagamento: config.forma_pagamento === f ? null : f })}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border text-left ${
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

          {/* Configuração das parcelas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Nº de parcelas</p>
              <input
                type="number"
                min={1}
                max={24}
                value={nParcelas}
                onChange={(e) => setNParcelas(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">
                {nParcelas === 1 ? "Data de vencimento" : "1º vencimento"}
              </p>
              <input
                type="date"
                value={primeiroVenc}
                onChange={(e) => setPrimeiroVenc(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Lista gerada de parcelas */}
          {config.parcelas.length > 0 && (
            <div className="flex flex-col gap-2">
              {config.parcelas.map((p, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                  <p className="text-xs font-medium text-gray-500 mb-2">
                    {config.parcelas.length === 1
                      ? "Pagamento"
                      : i === 0
                      ? "Entrada / 1ª parcela"
                      : `${i + 1}ª parcela`}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1">Valor</p>
                      <p className="text-xs font-semibold text-gray-800">
                        R$ {p.valor.toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1">Vencimento</p>
                      <p className="text-xs text-gray-700">
                        {p.data_vencimento
                          ? new Date(p.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1">Pago em</p>
                      <input
                        type="date"
                        value={p.data_pagamento || ""}
                        onChange={(e) => setPago(i, e.target.value)}
                        className="w-full px-1.5 py-1 border border-gray-200 rounded-lg text-[10px]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Versão do componente que carrega/salva parcelas existentes via API.
 * Usada na edição do pedido (não no novo).
 */
interface PagamentoFormEditProps {
  pedidoId: number;
  valorPecas: number;
  apiUrl: string;
  formaPagamento: string | null;
  pagamentoNaEntrega: boolean | null;
  onFormaPagamentoChange: (f: string | null) => void;
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

interface ParcelaOut {
  id: number;
  parcela_numero: number | null;
  parcela_total: number | null;
  valor: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: string;
}

interface ParcelaRow {
  id?: number;
  valor: string;
  data_vencimento: string;
  data_pagamento: string;
  status?: string;
}

export function PagamentoFormEdit({
  pedidoId,
  valorPecas,
  apiUrl,
  formaPagamento,
  pagamentoNaEntrega,
  onFormaPagamentoChange,
}: PagamentoFormEditProps) {
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parcelas, setParcelas] = useState<ParcelaRow[]>([]);
  const [nParcelas, setNParcelas] = useState(1);
  const [primeiroVenc, setPrimeiroVenc] = useState(todayISO());
  const [pnEntrega, setPnEntrega] = useState(pagamentoNaEntrega ?? false);

  const loadParcelas = () => {
    if (!pedidoId || isNaN(pedidoId)) { setLoaded(true); return; }
    setLoaded(false);
    fetch(`${apiUrl}/api/v1/pedidos/${pedidoId}/parcelas`)
      .then((r) => r.json())
      .then((data: ParcelaOut[]) => {
        const rows = data.map((p) => ({
          id: p.id,
          valor: String(p.valor),
          data_vencimento: p.data_vencimento || todayISO(),
          data_pagamento: p.data_pagamento || "",
          status: p.status,
        }));
        setParcelas(rows);
        if (rows.length > 0) setNParcelas(rows.length);
        setLoaded(true);
      })
      .catch(() => { setParcelas([]); setLoaded(true); });
  };

  useEffect(() => { loadParcelas(); }, [pedidoId]);

  // Regenera preview quando nParcelas ou primeiroVenc mudam
  const geradas = gerarParcelas(valorPecas, nParcelas, primeiroVenc);

  // Merge status das parcelas existentes no preview
  const preview: ParcelaRow[] = geradas.map((g, i) => ({
    id: parcelas[i]?.id,
    valor: String(g.valor),
    data_vencimento: g.data_vencimento,
    data_pagamento: parcelas[i]?.data_pagamento ?? "",
    status: parcelas[i]?.status,
  }));

  const handleSave = async () => {
    setSaving(true);
    try {
      // Atualiza forma_pagamento no pedido
      if (formaPagamento !== undefined) {
        await fetch(`${apiUrl}/api/v1/pedidos/${pedidoId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ forma_pagamento: formaPagamento, pagamento_na_entrega: pnEntrega }),
        });
      }
      if (!pnEntrega) {
        await fetch(`${apiUrl}/api/v1/pedidos/${pedidoId}/pagamento`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            forma_pagamento: formaPagamento,
            entrada: null,
            parcelas: preview.map((p) => ({
              valor: parseFloat(p.valor) || 0,
              data_vencimento: p.data_vencimento,
              data_pagamento: p.data_pagamento || null,
            })),
          }),
        });
      }
      loadParcelas();
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-4">
      {/* Toggle pagar na entrega */}
      <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-gray-50">
        <div>
          <p className="text-sm font-medium text-gray-700">Pagar na entrega</p>
          <p className="text-xs text-gray-400">Combinou pagar quando buscar a peça</p>
        </div>
        <button
          type="button"
          onClick={() => setPnEntrega(!pnEntrega)}
          className={`w-12 h-6 rounded-full transition-colors relative ${pnEntrega ? "bg-blue-500" : "bg-gray-300"}`}
        >
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${pnEntrega ? "translate-x-7" : "translate-x-1"}`} />
        </button>
      </div>

      {!pnEntrega && (
        <>
          {/* Forma de pagamento */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Forma de pagamento</p>
            <div className="grid grid-cols-2 gap-2">
              {FORMAS.map((f) => (
                <button key={f} type="button"
                  onClick={() => onFormaPagamentoChange(formaPagamento === f ? null : f)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border text-left ${
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

          {/* Config parcelas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Nº de parcelas</p>
              <input
                type="number" min={1} max={24} value={nParcelas}
                onChange={(e) => setNParcelas(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">{nParcelas === 1 ? "Data de vencimento" : "1º vencimento"}</p>
              <input
                type="date" value={primeiroVenc}
                onChange={(e) => setPrimeiroVenc(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Preview de parcelas geradas */}
          {preview.length > 0 && (
            <div className="flex flex-col gap-2">
              {preview.map((p, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-gray-500">
                      {preview.length === 1 ? "Pagamento" : i === 0 ? "Entrada / 1ª parcela" : `${i + 1}ª parcela`}
                    </span>
                    {p.status && PAG_STATUS_LABEL[p.status] && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${PAG_STATUS_CLS[p.status]}`}>
                        {PAG_STATUS_LABEL[p.status]}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1">Valor</p>
                      <p className="text-xs font-semibold text-gray-800">
                        R$ {parseFloat(p.valor).toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1">Vencimento</p>
                      <p className="text-xs text-gray-700">
                        {new Date(p.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1">Pago em</p>
                      <input
                        type="date"
                        value={p.data_pagamento}
                        onChange={(e) => {
                          const val = e.target.value;
                          setParcelas((prev) => {
                            const clone = [...prev];
                            if (clone[i]) clone[i] = { ...clone[i], data_pagamento: val };
                            else clone[i] = { valor: p.valor, data_vencimento: p.data_vencimento, data_pagamento: val };
                            return clone;
                          });
                        }}
                        className="w-full px-1.5 py-1 border border-gray-200 rounded-lg text-[10px]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Salvar pagamento
          </button>
        </>
      )}

      {pnEntrega && (
        <button
          type="button"
          disabled={saving}
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
