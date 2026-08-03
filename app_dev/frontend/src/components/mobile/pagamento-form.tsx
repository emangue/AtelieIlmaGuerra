"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Check, RotateCcw } from "lucide-react";
import { getToken } from "@/lib/api-client";
import {
  CANAIS_CARTAO,
  CANAL_CARTAO_PADRAO,
  FORMAS_PAGAMENTO,
  formaSelecionada,
  isCartao,
  isCartaoComTaxa,
  isCartaoDebito,
  isParcelado,
  isPix,
} from "@/lib/formas-pagamento";

function authFetch(url: string, init?: RequestInit) {
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

export interface ParcelaConfig {
  valor: number;
  data_vencimento: string; // YYYY-MM-DD
  data_pagamento: string | null;
  forma_pagamento: string | null;
}

export interface EntradaConfig {
  valor: number;
  data_pagamento: string | null; // data em que a entrada foi paga (ou null = ainda não)
  forma_pagamento: string | null;
}

export interface PagamentoConfig {
  pagamento_na_entrega: boolean;
  forma_pagamento: string | null; // forma do restante
  entrada: EntradaConfig | null; // null = sem entrada
  parcelas: ParcelaConfig[];
  canal_cartao: string | null;
  data_compra_cartao: string | null;
  // Valores efetivos (automáticos ou digitados) — usados no preview de margem.
  // Os flags dizem se foram digitados; só nesse caso vão no payload, senão o
  // backend recalcula pela tabela de taxas.
  taxa_cartao_valor: number;
  taxa_cartao_manual: boolean;
  desconto_pix_valor: number;
  desconto_pix_manual: boolean;
}

export function pagamentoConfigInicial(): PagamentoConfig {
  return {
    pagamento_na_entrega: false,
    forma_pagamento: null,
    entrada: null,
    parcelas: [],
    canal_cartao: null,
    data_compra_cartao: null,
    taxa_cartao_valor: 0,
    taxa_cartao_manual: false,
    desconto_pix_valor: 0,
    desconto_pix_manual: false,
  };
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function addMonths(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function brl(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function roundMoney(v: number) {
  return Math.round(v * 100) / 100;
}

function percentualSobreBase(valor: number, base: number) {
  if (!base) return 0;
  return roundMoney((valor / base) * 100);
}

function ddmm(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/**
 * Cartão de crédito cai em D+30, D+60… corridos a partir da compra — não no mesmo
 * dia dos meses seguintes. As outras formas seguem vencimento mensal.
 */
function gerarParcelas(
  valorTotal: number,
  valorEntrada: number,
  n: number,
  dataBase: string,
  forma: string | null,
  pagamentosExistentes: (string | null)[]
): ParcelaConfig[] {
  if (n <= 0 || !dataBase) return [];
  const base = Math.max(0, valorTotal - valorEntrada);
  const valorParcela = Math.round((base / n) * 100) / 100;
  const resto = Math.round((base - valorParcela * n) * 100) / 100;
  const cartao = isCartao(forma);
  return Array.from({ length: n }, (_, i) => ({
    valor: i === n - 1 ? Math.round((valorParcela + resto) * 100) / 100 : valorParcela,
    data_vencimento: cartao ? addDays(dataBase, 30 * (i + 1)) : addMonths(dataBase, i),
    // Parcela de cartão não é confirmada à mão: o backend grava a data prevista.
    data_pagamento: cartao ? null : pagamentosExistentes[i] ?? null,
    forma_pagamento: forma,
  }));
}

// ─── Estado compartilhado entre criação e edição ─────────────────────────────

interface EstadoPagamento {
  formaRestante: string | null;
  setFormaRestante: (f: string | null) => void;
  formaEntrada: string | null;
  setFormaEntrada: (f: string | null) => void;
  temEntrada: boolean;
  setTemEntrada: (v: boolean) => void;
  entradaValor: number;
  setEntradaValor: (v: number) => void;
  entradaPagoEm: string | null;
  setEntradaPagoEm: (v: string | null) => void;
  nParcelasStr: string;
  setNParcelasStr: (v: string) => void;
  dataBase: string;
  setDataBase: (v: string) => void;
  canalCartao: string;
  setCanalCartao: (v: string) => void;
  taxaCartaoManual: number | null;
  setTaxaCartaoManual: (v: number | null) => void;
  descontoPixManual: number | null;
  setDescontoPixManual: (v: number | null) => void;
}

function usePagamentoState(): EstadoPagamento {
  const [formaRestante, setFormaRestante] = useState<string | null>(null);
  const [formaEntrada, setFormaEntrada] = useState<string | null>(null);
  const [temEntrada, setTemEntrada] = useState(false);
  const [entradaValor, setEntradaValor] = useState(0);
  const [entradaPagoEm, setEntradaPagoEm] = useState<string | null>(null);
  const [nParcelasStr, setNParcelasStr] = useState("1");
  const [dataBase, setDataBase] = useState(todayISO());
  const [canalCartao, setCanalCartao] = useState<string>(CANAL_CARTAO_PADRAO);
  const [taxaCartaoManual, setTaxaCartaoManual] = useState<number | null>(null);
  const [descontoPixManual, setDescontoPixManual] = useState<number | null>(null);

  return {
    formaRestante, setFormaRestante, formaEntrada, setFormaEntrada,
    temEntrada, setTemEntrada, entradaValor, setEntradaValor,
    entradaPagoEm, setEntradaPagoEm, nParcelasStr, setNParcelasStr,
    dataBase, setDataBase, canalCartao, setCanalCartao,
    taxaCartaoManual, setTaxaCartaoManual, descontoPixManual, setDescontoPixManual,
  };
}

interface Taxas {
  cartaoPct: number;
  cartaoDebitoPct: number;
  pixPct: number;
}

function useTaxas(apiUrl: string): Taxas {
  const [taxas, setTaxas] = useState<Taxas>({ cartaoPct: 0, cartaoDebitoPct: 0, pixPct: 0 });
  useEffect(() => {
    authFetch(`${apiUrl}/api/v1/parametros/taxas`)
      .then((r) => (r.ok ? r.json() : []))
      .then((linhas: { forma: string; percentual: number; padrao: boolean; ativo: boolean }[]) => {
        const ativas = (linhas || []).filter((l) => l.ativo);
        const cartao = ativas.find((l) => l.forma === "Cartão" && l.padrao) ?? ativas.find((l) => l.forma === "Cartão");
        const cartaoDebito = ativas.find((l) => l.forma === "Cartão de Débito");
        const pix = ativas.find((l) => l.forma === "Pix");
        setTaxas({
          cartaoPct: cartao?.percentual ?? 0,
          cartaoDebitoPct: cartaoDebito?.percentual ?? 0,
          pixPct: pix?.percentual ?? 0,
        });
      })
      .catch(() => {});
  }, [apiUrl]);
  return taxas;
}

/**
 * Quanto do pedido não chega na mão da Ilma. A receita continua sendo o valor
 * cheio da peça — estes valores viram despesa.
 */
function calcularCustos(
  parcelas: ParcelaConfig[],
  entrada: EntradaConfig | null,
  taxas: Taxas,
  canalDisponivel: boolean,
  taxaManual: number | null,
  descontoManual: number | null
) {
  const todas = [
    ...(entrada && entrada.valor > 0 ? [{ valor: entrada.valor, forma_pagamento: entrada.forma_pagamento }] : []),
    ...parcelas,
  ];
  const total = todas.reduce((s, p) => s + p.valor, 0);
  const baseCartaoCredito = todas.filter((p) => isCartao(p.forma_pagamento)).reduce((s, p) => s + p.valor, 0);
  const baseCartaoDebito = todas.filter((p) => isCartaoDebito(p.forma_pagamento)).reduce((s, p) => s + p.valor, 0);
  const baseCartao = baseCartaoCredito + baseCartaoDebito;
  const basePix = todas.filter((p) => isPix(p.forma_pagamento)).reduce((s, p) => s + p.valor, 0);
  const pago100PctPix = todas.length > 0 && basePix > 0 && Math.abs(basePix - total) < 0.005;

  const taxaAuto = roundMoney(
    (baseCartaoCredito * taxas.cartaoPct) / 100 +
    (baseCartaoDebito * taxas.cartaoDebitoPct) / 100
  );
  const descontoAuto = pago100PctPix ? roundMoney((basePix * taxas.pixPct) / 100) : 0;

  return {
    total,
    baseCartao,
    baseCartaoCredito,
    baseCartaoDebito,
    basePix,
    pago100PctPix,
    canalDisponivel,
    taxaCartao: taxaManual ?? taxaAuto,
    descontoPix: descontoManual ?? descontoAuto,
    taxaAuto,
    descontoAuto,
    descontoPixPct: percentualSobreBase(descontoManual ?? descontoAuto, basePix),
  };
}

// ─── Componente para criação (novo pedido) ───────────────────────────────────

interface Props {
  valorPecas: number;
  config: PagamentoConfig;
  onChange: (c: PagamentoConfig) => void;
  apiUrl: string;
}

export function PagamentoForm({ valorPecas, config, onChange, apiUrl }: Props) {
  const st = usePagamentoState();
  const taxas = useTaxas(apiUrl);

  const isParceladoRestante = isParcelado(st.formaRestante);
  const nParcelas = Math.max(1, parseInt(st.nParcelasStr) || 1);
  const parcelasRestantes = isParceladoRestante ? nParcelas : 1;
  const cartaoCreditoNoRestante = isCartao(st.formaRestante);
  const cartaoTaxaNoRestante = isCartaoComTaxa(st.formaRestante);

  const entrada: EntradaConfig | null = st.temEntrada
    ? { valor: st.entradaValor, data_pagamento: st.entradaPagoEm, forma_pagamento: st.formaEntrada }
    : null;

  const parcelas = useMemo(
    () =>
      gerarParcelas(
        valorPecas,
        st.temEntrada ? st.entradaValor : 0,
        parcelasRestantes,
        st.dataBase,
        st.formaRestante,
        config.parcelas.map((p) => p.data_pagamento)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [valorPecas, st.temEntrada, st.entradaValor, parcelasRestantes, st.dataBase, st.formaRestante]
  );

  const custos = calcularCustos(
    parcelas, entrada, taxas, cartaoTaxaNoRestante, st.taxaCartaoManual, st.descontoPixManual
  );

  // Propaga para o pai sempre que algo relevante muda.
  useEffect(() => {
    if (config.pagamento_na_entrega) return;
    onChange({
      ...config,
      forma_pagamento: st.formaRestante,
      entrada,
      parcelas,
      canal_cartao: cartaoCreditoNoRestante ? st.canalCartao : null,
      data_compra_cartao: cartaoCreditoNoRestante ? st.dataBase : null,
      taxa_cartao_valor: custos.taxaCartao,
      taxa_cartao_manual: st.taxaCartaoManual != null,
      desconto_pix_valor: custos.descontoPix,
      desconto_pix_manual: st.descontoPixManual != null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    parcelas, st.formaRestante, st.formaEntrada, st.temEntrada, st.entradaValor,
    st.entradaPagoEm, st.canalCartao, st.taxaCartaoManual, st.descontoPixManual,
    custos.taxaCartao, custos.descontoPix, config.pagamento_na_entrega,
  ]);

  return (
    <div className="space-y-4">
      <Toggle
        label="Pagar na entrega"
        sub="Combinou pagar quando buscar a peça"
        value={config.pagamento_na_entrega}
        onChange={(v) => onChange({ ...config, pagamento_na_entrega: v, parcelas: [], entrada: null })}
      />

      {!config.pagamento_na_entrega && (
        <>
          <BlocoEntrada st={st} />
          <BlocoRestante st={st} isParceladoRestante={isParceladoRestante} cartao={cartaoCreditoNoRestante} />
          <PreviewParcelas parcelas={parcelas} temEntrada={st.temEntrada} onPago={(i, v) => {
            const novas = parcelas.map((p, idx) => (idx === i ? { ...p, data_pagamento: v || null } : p));
            onChange({ ...config, parcelas: novas });
          }} />
          <BlocoCustos
            valorPedido={valorPecas}
            custos={custos}
            taxas={taxas}
            onTaxa={st.setTaxaCartaoManual}
            onDesconto={st.setDescontoPixManual}
          />
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
  onSaved?: () => void;
}

interface ParcelaOut {
  id: number;
  parcela_numero: number | null;
  parcela_total: number | null;
  valor: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  descricao: string | null;
  status: string;
  forma_pagamento: string | null;
  liquidacao_automatica: boolean;
  desconto_adiantamento: number | null;
}

const PAG_STATUS_CLS: Record<string, string> = {
  confirmado: "text-green-600 bg-green-50 border-green-200",
  aguardando: "text-amber-600 bg-amber-50 border-amber-200",
  em_atraso: "text-red-600 bg-red-50 border-red-200",
  previsto: "text-blue-600 bg-blue-50 border-blue-200",
};
const PAG_STATUS_LABEL: Record<string, string> = {
  confirmado: "Pago",
  aguardando: "Aguardando",
  em_atraso: "Em atraso",
  previsto: "Previsto",
};

export function PagamentoFormEdit({
  pedidoId, valorPecas, apiUrl, formaPagamento, pagamentoNaEntrega, onFormaPagamentoChange, onSaved,
}: PagamentoFormEditProps) {
  const st = usePagamentoState();
  const taxas = useTaxas(apiUrl);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pagamentosExistentes, setPagamentosExistentes] = useState<(string | null)[]>([]);
  const [statusExistentes, setStatusExistentes] = useState<(string | undefined)[]>([]);
  const [pnEntrega, setPnEntrega] = useState(pagamentoNaEntrega ?? false);

  const isParceladoRestante = isParcelado(st.formaRestante);
  const nParcelas = Math.max(1, parseInt(st.nParcelasStr) || 1);
  const parcelasRestantes = isParceladoRestante ? nParcelas : 1;
  const cartaoCreditoNoRestante = isCartao(st.formaRestante);
  const cartaoTaxaNoRestante = isCartaoComTaxa(st.formaRestante);

  const { setFormaRestante, setFormaEntrada, setTemEntrada, setEntradaValor,
    setEntradaPagoEm, setNParcelasStr, setDataBase, setCanalCartao,
    setTaxaCartaoManual, setDescontoPixManual } = st;

  const loadParcelas = useCallback(() => {
    if (!pedidoId || isNaN(pedidoId)) { setLoaded(true); return; }
    setLoaded(false);
    Promise.all([
      authFetch(`${apiUrl}/api/v1/pedidos/${pedidoId}/parcelas`).then((r) => (r.ok ? r.json() : [])),
      authFetch(`${apiUrl}/api/v1/pedidos/${pedidoId}/custos-receber`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([data, custos]: [ParcelaOut[], any]) => {
        const rows = data || [];
        const entradaRow = rows.find((p) => (p.descricao || "").toLowerCase().startsWith("entrada"));
        const parcelaRows = rows.filter((p) => !(p.descricao || "").toLowerCase().startsWith("entrada"));

        setTemEntrada(Boolean(entradaRow));
        setEntradaValor(entradaRow?.valor ?? 0);
        setEntradaPagoEm(entradaRow?.data_pagamento ?? null);
        setFormaEntrada(entradaRow?.forma_pagamento ?? null);
        setFormaRestante(parcelaRows[0]?.forma_pagamento ?? formaPagamento ?? null);
        setPagamentosExistentes(parcelaRows.map((p) => p.data_pagamento));
        setStatusExistentes(parcelaRows.map((p) => p.status));

        if (parcelaRows.length > 0) setNParcelasStr(String(parcelaRows.length));

        if (custos) {
          if (custos.canal_cartao) setCanalCartao(custos.canal_cartao);
          if (custos.taxa_cartao_manual) setTaxaCartaoManual(custos.taxa_cartao_valor);
          if (custos.desconto_pix_manual) setDescontoPixManual(custos.desconto_pix_valor);
          // Cartão: a data-base é a da compra. Sem cartão: o 1º vencimento.
          if (custos.data_compra_cartao) setDataBase(custos.data_compra_cartao);
          else if (parcelaRows[0]?.data_vencimento) setDataBase(parcelaRows[0].data_vencimento);
          else if (entradaRow?.data_vencimento) setDataBase(entradaRow.data_vencimento);
        }
        setLoaded(true);
      })
      .catch(() => { setLoaded(true); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId, apiUrl]);

  useEffect(() => { loadParcelas(); }, [loadParcelas]);

  // Mantém o pai em sincronia com o seletor interno (o pedido guarda a forma).
  useEffect(() => {
    if (loaded) onFormaPagamentoChange(st.formaRestante);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.formaRestante, loaded]);

  const entrada: EntradaConfig | null = st.temEntrada
    ? { valor: st.entradaValor, data_pagamento: st.entradaPagoEm, forma_pagamento: st.formaEntrada }
    : null;

  const parcelas = gerarParcelas(
    valorPecas,
    st.temEntrada ? st.entradaValor : 0,
    parcelasRestantes,
    st.dataBase,
    st.formaRestante,
    pagamentosExistentes
  );

  const custos = calcularCustos(
    parcelas, entrada, taxas, cartaoTaxaNoRestante, st.taxaCartaoManual, st.descontoPixManual
  );

  const handleSave = async () => {
    setSaving(true);
    setErro(null);
    try {
      const res = await authFetch(`${apiUrl}/api/v1/pedidos/${pedidoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forma_pagamento: st.formaRestante, pagamento_na_entrega: pnEntrega }),
      });
      if (!res.ok) throw new Error("Não foi possível salvar a forma de pagamento.");

      if (!pnEntrega) {
        const res2 = await authFetch(`${apiUrl}/api/v1/pedidos/${pedidoId}/pagamento`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            forma_pagamento: st.formaRestante,
            entrada: entrada && entrada.valor > 0
              ? {
                  valor: entrada.valor,
                  data_vencimento: st.dataBase,
                  data_pagamento: entrada.data_pagamento,
                  forma_pagamento: entrada.forma_pagamento,
                }
              : null,
            parcelas,
            canal_cartao: cartaoCreditoNoRestante ? st.canalCartao : null,
            data_compra_cartao: cartaoCreditoNoRestante ? st.dataBase : null,
            taxa_cartao_valor: st.taxaCartaoManual,
            desconto_pix_valor: st.descontoPixManual,
          }),
        });
        if (!res2.ok) {
          const body = await res2.json().catch(() => null);
          throw new Error(typeof body?.detail === "string" ? body.detail : "Não foi possível salvar as parcelas.");
        }
      }
      loadParcelas();
      onSaved?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar pagamento.");
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
          <BlocoEntrada st={st} />
          <BlocoRestante st={st} isParceladoRestante={isParceladoRestante} cartao={cartaoCreditoNoRestante} />
          <PreviewParcelas
            parcelas={parcelas}
            temEntrada={st.temEntrada}
            statusPorIndice={statusExistentes}
            onPago={(i, v) => setPagamentosExistentes((prev) => {
              const clone = [...prev];
              clone[i] = v || null;
              return clone;
            })}
          />
          <BlocoCustos
            valorPedido={valorPecas}
            custos={custos}
            taxas={taxas}
            onTaxa={st.setTaxaCartaoManual}
            onDesconto={st.setDescontoPixManual}
          />
        </>
      )}

      {erro && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>
      )}

      <button
        type="button" disabled={saving} onClick={handleSave}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        {pnEntrega ? "Salvar configuração" : "Salvar pagamento"}
      </button>
    </div>
  );
}

// ─── Blocos compartilhados ───────────────────────────────────────────────────

function SeletorForma({ valor, onChange, label }: {
  valor: string | null;
  onChange: (f: string | null) => void;
  label: string;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
      <div className="grid grid-cols-2 gap-1.5">
        {FORMAS_PAGAMENTO.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onChange(formaSelecionada(valor, f) ? null : f)}
            className={`py-2 px-1 rounded-lg text-xs font-medium border text-center ${
              formaSelecionada(valor, f)
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}

function BlocoEntrada({ st }: { st: EstadoPagamento }) {
  return (
    <>
      <Toggle
        label="Tem entrada?"
        sub="Parte do valor pago antes da entrega"
        value={st.temEntrada}
        onChange={(v) => {
          st.setTemEntrada(v);
          if (!v) { st.setEntradaValor(0); st.setEntradaPagoEm(null); st.setFormaEntrada(null); }
        }}
      />

      {st.temEntrada && (
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 flex flex-col gap-3">
          <SeletorForma valor={st.formaEntrada} onChange={st.setFormaEntrada} label="Forma da entrada" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-gray-400 mb-1">Valor (R$)</p>
              <input
                type="number" min={0} step={0.01}
                value={st.entradaValor || ""}
                onChange={(e) => st.setEntradaValor(parseFloat(e.target.value) || 0)}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            {!isCartao(st.formaEntrada) && (
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Pago em (opcional)</p>
                <input
                  type="date"
                  value={st.entradaPagoEm || ""}
                  onChange={(e) => st.setEntradaPagoEm(e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function BlocoRestante({ st, isParceladoRestante, cartao }: {
  st: EstadoPagamento;
  isParceladoRestante: boolean;
  cartao: boolean;
}) {
  return (
    <>
      <SeletorForma
        valor={st.formaRestante}
        onChange={(f) => {
          if (f && !isParcelado(f)) st.setNParcelasStr("1");
          st.setFormaRestante(f);
        }}
        label={st.temEntrada ? "Forma do restante" : "Forma de pagamento"}
      />

      {cartao && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Onde passou o cartão</p>
          <div className="grid grid-cols-2 gap-2">
            {CANAIS_CARTAO.map((c) => (
              <button
                key={c} type="button"
                onClick={() => st.setCanalCartao(c)}
                className={`py-2 px-2 rounded-lg text-xs font-medium border text-center ${
                  st.canalCartao === c
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-1">Define qual taxa da tabela será aplicada.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-500 mb-1">
            {isParceladoRestante ? "Nº de parcelas do restante" : "Pagamentos no total"}
          </p>
          {isParceladoRestante ? (
            <input
              type="number" min={1} max={24}
              value={st.nParcelasStr}
              onChange={(e) => st.setNParcelasStr(e.target.value)}
              onBlur={() => st.setNParcelasStr(String(Math.max(1, parseInt(st.nParcelasStr) || 1)))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          ) : (
            <input
              type="text"
              value={String(1 + (st.temEntrada ? 1 : 0))}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-100 text-gray-400"
            />
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">
            {cartao ? "Data da compra no cartão" : isParceladoRestante ? "Data do 1º vencimento" : "Data de vencimento"}
          </p>
          <input
            type="date" value={st.dataBase}
            onChange={(e) => st.setDataBase(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
      </div>

      {cartao && (
        <p className="text-[11px] text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          Parcela de cartão cai sozinha em D+30, D+60… Não precisa confirmar recebimento.
        </p>
      )}
    </>
  );
}

function PreviewParcelas({ parcelas, temEntrada, statusPorIndice, onPago }: {
  parcelas: ParcelaConfig[];
  temEntrada: boolean;
  statusPorIndice?: (string | undefined)[];
  onPago: (i: number, v: string) => void;
}) {
  if (parcelas.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {parcelas.map((p, i) => {
        const cartao = isCartao(p.forma_pagamento);
        const label = parcelas.length === 1
          ? (temEntrada ? "Pagamento restante" : "Pagamento")
          : `${i + 1}ª parcela`;
        return (
          <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-gray-500">{label}</span>
              {cartao ? (
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${PAG_STATUS_CLS.previsto}`}>
                  Previsto — cai em {ddmm(p.data_vencimento)}
                </span>
              ) : (
                statusPorIndice?.[i] && PAG_STATUS_LABEL[statusPorIndice[i]!] && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${PAG_STATUS_CLS[statusPorIndice[i]!]}`}>
                    {PAG_STATUS_LABEL[statusPorIndice[i]!]}
                  </span>
                )
              )}
            </div>
            <div className={`grid gap-2 ${cartao ? "grid-cols-2" : "grid-cols-3"}`}>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Valor</p>
                <p className="text-xs font-semibold text-gray-800">R$ {brl(p.valor)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">{cartao ? "Cai em" : "Vencimento"}</p>
                <p className="text-xs text-gray-700">{ddmm(p.data_vencimento)}</p>
              </div>
              {/* Cartão não tem "Pago em": a data de crédito é o próprio vencimento. */}
              {!cartao && (
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Pago em</p>
                  <input
                    type="date"
                    value={p.data_pagamento || ""}
                    onChange={(e) => onPago(i, e.target.value)}
                    className="w-full px-1.5 py-1 border border-gray-200 rounded-lg text-[10px]"
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BlocoCustos({ valorPedido, custos, taxas, onTaxa, onDesconto }: {
  valorPedido: number;
  custos: ReturnType<typeof calcularCustos>;
  taxas: Taxas;
  onTaxa: (v: number | null) => void;
  onDesconto: (v: number | null) => void;
}) {
  const [mostrarPix, setMostrarPix] = useState(false);
  const temCartao = custos.baseCartao > 0;
  const pixVisivel = custos.pago100PctPix || mostrarPix || custos.descontoPix > 0;

  if (!temCartao && !custos.basePix) return null;

  const liquido = valorPedido - custos.taxaCartao - custos.descontoPix;

  return (
    <div className="bg-white rounded-xl p-3 border border-gray-200 flex flex-col gap-3">
      <p className="text-sm font-medium text-gray-700">Quanto você vai receber</p>

      {temCartao && (
        <CampoCusto
          label="Taxa de cartão (R$)"
          hint={hintTaxaCartao(custos, taxas)}
          valor={custos.taxaCartao}
          automatico={custos.taxaAuto}
          onChange={onTaxa}
        />
      )}

      {pixVisivel && (
        <CampoDescontoPix
          basePix={custos.basePix}
          descontoValor={custos.descontoPix}
          descontoAuto={custos.descontoAuto}
          descontoPct={custos.descontoPixPct}
          sugestaoPct={taxas.pixPct}
          onChangeValor={onDesconto}
        />
      )}

      {!pixVisivel && custos.basePix > 0 && (
        <button
          type="button"
          onClick={() => setMostrarPix(true)}
          className="text-xs text-blue-600 hover:underline text-left"
        >
          Aplicar desconto de Pix mesmo assim
        </button>
      )}

      <div className="flex items-baseline justify-between border-t border-gray-100 pt-2">
        <span className="text-xs text-gray-500">Valor do pedido R$ {brl(valorPedido)}</span>
        <span className="text-sm font-semibold text-gray-800">você recebe R$ {brl(liquido)}</span>
      </div>
    </div>
  );
}

function hintTaxaCartao(custos: ReturnType<typeof calcularCustos>, taxas: Taxas) {
  const partes: string[] = [];
  if (custos.baseCartaoCredito > 0) {
    partes.push(`${taxas.cartaoPct.toLocaleString("pt-BR")}% sobre R$ ${brl(custos.baseCartaoCredito)} no crédito`);
  }
  if (custos.baseCartaoDebito > 0) {
    partes.push(`${taxas.cartaoDebitoPct.toLocaleString("pt-BR")}% sobre R$ ${brl(custos.baseCartaoDebito)} no débito`);
  }
  return partes.join(" · ");
}

function CampoDescontoPix({ basePix, descontoValor, descontoAuto, descontoPct, sugestaoPct, onChangeValor }: {
  basePix: number;
  descontoValor: number;
  descontoAuto: number;
  descontoPct: number;
  sugestaoPct: number;
  onChangeValor: (v: number | null) => void;
}) {
  const editado = Math.abs(descontoValor - descontoAuto) > 0.005;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-gray-600">Desconto Pix (%)</p>
        {editado && (
          <button
            type="button"
            onClick={() => onChangeValor(null)}
            className="flex items-center gap-1 text-[10px] text-blue-600 hover:underline"
          >
            <RotateCcw className="w-3 h-3" /> recalcular
          </button>
        )}
      </div>
      <input
        type="number"
        min={0}
        max={100}
        step={0.1}
        value={descontoPct ? String(descontoPct) : ""}
        onChange={(e) => {
          const raw = e.target.value.replace(",", ".");
          if (raw === "") {
            onChangeValor(null);
            return;
          }
          const pct = Math.max(0, Math.min(100, parseFloat(raw) || 0));
          onChangeValor(roundMoney((basePix * pct) / 100));
        }}
        placeholder="0"
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
      />
      <p className="text-[10px] text-gray-400 mt-1">
        R$ {brl(descontoValor)} de desconto sobre R$ {brl(basePix)}
        {sugestaoPct > 0 ? ` · padrão cadastrado: ${sugestaoPct.toLocaleString("pt-BR")}%` : ""}
      </p>
    </div>
  );
}

function CampoCusto({ label, hint, valor, automatico, onChange }: {
  label: string;
  hint: string;
  valor: number;
  automatico: number;
  onChange: (v: number | null) => void;
}) {
  const editado = Math.abs(valor - automatico) > 0.005;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-gray-600">{label}</p>
        {editado && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex items-center gap-1 text-[10px] text-blue-600 hover:underline"
          >
            <RotateCcw className="w-3 h-3" /> recalcular
          </button>
        )}
      </div>
      <input
        type="number" min={0} step={0.01}
        value={valor ? valor.toFixed(2) : ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : parseFloat(v) || 0);
        }}
        placeholder="0,00"
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
      />
      <p className="text-[10px] text-gray-400 mt-1">{hint}</p>
    </div>
  );
}

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
