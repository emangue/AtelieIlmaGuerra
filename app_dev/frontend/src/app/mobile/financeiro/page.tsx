"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2, Check, X, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";

function formatMoney(val: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

function hojeStr(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addMes(anomes: string, n: number): string {
  const y = parseInt(anomes.slice(0, 4));
  const m = parseInt(anomes.slice(4, 6));
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function labelMes(anomes: string): string {
  const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${MESES[parseInt(anomes.slice(4)) - 1]}/${anomes.slice(0, 4)}`;
}

function formatDataBR(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

interface CobrancaItem {
  id: number;
  pedido_id: number;
  cliente_nome: string;
  tipo_pedido: string;
  forma_pagamento: string | null;
  parcela_numero: number | null;
  parcela_total: number | null;
  valor: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: string;
  dias_atraso: number;
  liquidacao_automatica: boolean;
  desconto_adiantamento: number | null;
}

interface CobrancasResumo {
  total_em_atraso: number;
  count_em_atraso: number;
  total_vence_7dias: number;
  count_vence_7dias: number;
  total_a_vencer: number;
  count_a_vencer: number;
  total_pago: number;
  count_pago: number;
  total_previsto_cartao: number;
  count_previsto_cartao: number;
  total_taxa_cartao: number;
  total_desconto_pix: number;
}

interface CobrancasResponse {
  em_atraso: CobrancaItem[];
  vence_hoje: CobrancaItem[];
  a_vencer: CobrancaItem[];
  pagas: CobrancaItem[];
  previstas_cartao: CobrancaItem[];
  resumo: CobrancasResumo;
}

interface RepasseItem {
  id: number;
  pedido_id: number;
  cliente_nome: string;
  tipo_pedido: string;
  valor_pedido: number;
  percentual_lucro_dono: number;
  percentual_repasse: number;
  valor: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: string;
}

interface RepassesResponse {
  pendentes: RepasseItem[];
  pagos: RepasseItem[];
  resumo: {
    total_pendente: number;
    count_pendente: number;
    total_pago: number;
    count_pago: number;
  };
}

type Filtro = "todas" | "em_atraso" | "a_vencer" | "pagas" | "cartao";

function parcelaLabel(item: CobrancaItem): string {
  if (item.parcela_numero && item.parcela_total) {
    return `Parcela ${item.parcela_numero} de ${item.parcela_total}`;
  }
  if (item.parcela_numero) return `Parcela ${item.parcela_numero}`;
  return "À vista";
}

function CardCobranca({
  item,
  confirmandoId,
  confirmandoData,
  descontoAdiantar,
  salvando,
  onIniciarConfirmar,
  onCancelarConfirmar,
  onChangeData,
  onChangeDesconto,
  onConfirmar,
  onAdiantar,
}: {
  item: CobrancaItem;
  confirmandoId: number | null;
  confirmandoData: string;
  descontoAdiantar: string;
  salvando: boolean;
  onIniciarConfirmar: (id: number) => void;
  onCancelarConfirmar: () => void;
  onChangeData: (v: string) => void;
  onChangeDesconto: (v: string) => void;
  onConfirmar: () => void;
  onAdiantar: () => void;
}) {
  const router = useRouter();
  const isConfirmando = confirmandoId === item.id;
  // Parcela de cartão não se confirma: cai sozinha. A única ação é adiantar.
  const automatica = item.liquidacao_automatica;
  const previsto = item.status === "previsto";

  const borderColor =
    item.status === "em_atraso" ? "#F7C1C1"
    : item.status === "vence_hoje" ? "#FAC775"
    : previsto ? "#BBD5F2"
    : "var(--color-border-tertiary, #e5e7eb)";

  const accentColor =
    item.status === "em_atraso" ? "#A32D2D"
    : item.status === "vence_hoje" ? "#854F0B"
    : item.status === "pago" ? "#3B6D11"
    : previsto ? "#1B4F86"
    : "var(--color-text-primary)";

  return (
    <div
      onClick={() => router.push(`/mobile/pedidos/${item.pedido_id}?from=financeiro&aba=pagamento`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/mobile/pedidos/${item.pedido_id}?from=financeiro&aba=pagamento`);
        }
      }}
      style={{ border: `0.5px solid ${borderColor}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8, cursor: "pointer" }}
    >
      {/* Linha 1: nome + valor */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 }}>
        <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "var(--color-text-primary)", flex: 1, paddingRight: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {item.cliente_nome}
        </p>
        <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: accentColor, flexShrink: 0 }}>
          {formatMoney(item.valor)}
        </p>
      </div>

      {/* Linha 2: tipo · forma + badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>
          {item.tipo_pedido}{item.forma_pagamento ? ` · ${item.forma_pagamento}` : ""}
        </p>
        {item.status === "em_atraso" && (
          <span style={{ fontSize: 11, background: "#F7C1C1", color: "#791F1F", padding: "2px 8px", borderRadius: 20, flexShrink: 0 }}>
            {item.dias_atraso}d atraso
          </span>
        )}
        {item.status === "vence_hoje" && (
          <span style={{ fontSize: 11, background: "#FAC775", color: "#633806", padding: "2px 8px", borderRadius: 20, flexShrink: 0 }}>
            hoje
          </span>
        )}
        {item.status === "pago" && (
          <span style={{ fontSize: 11, background: item.desconto_adiantamento ? "#DDD0F0" : "#C0DD97", color: item.desconto_adiantamento ? "#452A70" : "#27500A", padding: "2px 8px", borderRadius: 20, flexShrink: 0 }}>
            {item.desconto_adiantamento ? "adiantado" : automatica ? "quitado" : "pago"}
          </span>
        )}
        {previsto && (
          <span style={{ fontSize: 11, background: "#D6E6F7", color: "#1B4F86", padding: "2px 8px", borderRadius: 20, flexShrink: 0 }}>
            previsto
          </span>
        )}
      </div>

      {/* Linha 3: parcela info + ação */}
      {!isConfirmando ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderTop: "0.5px solid var(--color-border-tertiary, #f0f0f0)", paddingTop: 10 }}>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0, minWidth: 0 }}>
            {parcelaLabel(item)}
            {previsto && item.data_vencimento ? ` · cai em ${formatDataBR(item.data_vencimento)}` : ""}
            {!previsto && item.status !== "pago" && item.data_vencimento ? ` · vence ${formatDataBR(item.data_vencimento)}` : ""}
            {item.status === "pago" && item.data_pagamento ? ` · ${formatDataBR(item.data_pagamento)}` : ""}
          </p>
          {previsto ? (
            <button
              onClick={(e) => { e.stopPropagation(); onIniciarConfirmar(item.id); }}
              style={{
                fontSize: 12, padding: "6px 14px", borderRadius: 20, flexShrink: 0, whiteSpace: "nowrap",
                border: `0.5px solid ${accentColor}`, background: "transparent", color: accentColor, cursor: "pointer",
              }}
            >
              Adiantar
            </button>
          ) : item.status !== "pago" ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onIniciarConfirmar(item.id);
              }}
              style={{
                fontSize: 12, padding: "6px 14px", borderRadius: 20, flexShrink: 0, whiteSpace: "nowrap",
                border: `0.5px solid ${accentColor}`,
                background: "transparent",
                color: accentColor,
                cursor: "pointer",
              }}
            >
              Confirmar
            </button>
          ) : null}
        </div>
      ) : (
        <div style={{ borderTop: "0.5px solid var(--color-border-tertiary, #f0f0f0)", paddingTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0, flexShrink: 0 }}>Recebido em</p>
            <Input
              type="date"
              value={confirmandoData}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onChangeData(e.target.value)}
              className="h-8 text-sm flex-1"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                previsto ? onAdiantar() : onConfirmar();
              }}
              disabled={salvando}
              style={{ width: 32, height: 32, borderRadius: 8, background: "#639922", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              {salvando ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <Check style={{ width: 14, height: 14 }} />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancelarConfirmar();
              }}
              style={{ width: 32, height: 32, borderRadius: 8, background: "transparent", border: "0.5px solid var(--color-border-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
          {/* Adiantar cobra um desconto da adquirente — o valor real vem do extrato. */}
          {previsto && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0, flexShrink: 0 }}>Desconto (R$)</p>
              <Input
                type="number" min={0} step="0.01" placeholder="0,00"
                value={descontoAdiantar}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onChangeDesconto(e.target.value)}
                className="h-8 text-sm flex-1"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ cor, label, count, total }: { cor: string; label: string; count: number; total?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, marginTop: 16 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: cor }} />
      <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", letterSpacing: "0.06em" }}>
        {label}
      </span>
      {count > 0 && (
        <span style={{ fontSize: 11, background: "var(--color-background-secondary)", color: "var(--color-text-secondary)", padding: "1px 8px", borderRadius: 20 }}>
          {count}{total !== undefined ? ` · ${formatMoney(total)}` : ""}
        </span>
      )}
    </div>
  );
}

function CardRepasse({
  item,
  confirmandoId,
  confirmandoData,
  salvando,
  onIniciarConfirmar,
  onCancelarConfirmar,
  onChangeData,
  onConfirmar,
}: {
  item: RepasseItem;
  confirmandoId: number | null;
  confirmandoData: string;
  salvando: boolean;
  onIniciarConfirmar: (id: number) => void;
  onCancelarConfirmar: () => void;
  onChangeData: (v: string) => void;
  onConfirmar: () => void;
}) {
  const isConfirmando = confirmandoId === item.id;
  const pago = item.status === "pago";
  const accentColor = pago ? "#3B6D11" : item.status === "em_atraso" ? "#A32D2D" : "#854F0B";

  return (
    <div className="mb-2 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{item.cliente_nome}</p>
          <p className="text-xs text-gray-500">
            Pedido #{item.pedido_id} · {item.tipo_pedido} · {item.percentual_repasse.toFixed(0)}% de repasse
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold" style={{ color: accentColor }}>
          {formatMoney(item.valor)}
        </p>
      </div>

      {!isConfirmando ? (
        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-500">
            {pago && item.data_pagamento
              ? `Pago em ${formatDataBR(item.data_pagamento)}`
              : `Pagar${item.data_vencimento ? ` até ${formatDataBR(item.data_vencimento)}` : ""}`}
          </p>
          {!pago && (
            <button
              onClick={() => onIniciarConfirmar(item.id)}
              className="rounded-full border px-3 py-1.5 text-xs"
              style={{ borderColor: accentColor, color: accentColor }}
            >
              Marcar pago
            </button>
          )}
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
          <p className="shrink-0 text-xs text-gray-500">Pago em</p>
          <Input
            type="date"
            value={confirmandoData}
            onChange={(e) => onChangeData(e.target.value)}
            className="h-8 flex-1 text-sm"
          />
          <button
            onClick={onConfirmar}
            disabled={salvando}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-700 text-white"
          >
            {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onCancelarConfirmar}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function FinanceiroPage() {
  const [mes, setMes] = useState(hojeStr);
  const [cobrancas, setCobrancas] = useState<CobrancasResponse | null>(null);
  const [repasses, setRepasses] = useState<RepassesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [searchTerm, setSearchTerm] = useState("");

  const [confirmandoId, setConfirmandoId] = useState<number | null>(null);
  const [confirmandoData, setConfirmandoData] = useState(hojeIso);
  const [descontoAdiantar, setDescontoAdiantar] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const [pagasExpandido, setPagasExpandido] = useState(false);

  const fetchCobrancas = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<CobrancasResponse>(`/api/v1/pagamentos/cobrancas?mes=${mes}`),
      api.get<RepassesResponse>(`/api/v1/pagamentos/repasses?mes=${mes}`),
    ])
      .then(([cobrancasData, repassesData]) => {
        setCobrancas(cobrancasData);
        setRepasses(repassesData);
      })
      .catch(() => {
        setCobrancas(null);
        setRepasses(null);
      })
      .finally(() => setLoading(false));
  }, [mes]);

  useEffect(() => { fetchCobrancas(); }, [fetchCobrancas]);

  const handleConfirmar = async () => {
    if (!confirmandoId || !confirmandoData) return;
    setSalvando(true);
    setErroAcao(null);
    try {
      await api.patch(`/api/v1/pagamentos/${confirmandoId}/confirmar`, {
        data_pagamento: confirmandoData,
      });
      setConfirmandoId(null);
      fetchCobrancas();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : "Não foi possível confirmar.");
    } finally {
      setSalvando(false);
    }
  };

  const handleAdiantar = async () => {
    if (!confirmandoId || !confirmandoData) return;
    setSalvando(true);
    setErroAcao(null);
    try {
      await api.patch(`/api/v1/pagamentos/${confirmandoId}/adiantar`, {
        data_recebimento: confirmandoData,
        desconto: parseFloat(descontoAdiantar.replace(",", ".")) || 0,
      });
      setConfirmandoId(null);
      setDescontoAdiantar("");
      fetchCobrancas();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : "Não foi possível adiantar.");
    } finally {
      setSalvando(false);
    }
  };

  const cardProps = {
    confirmandoId,
    confirmandoData,
    descontoAdiantar,
    salvando,
    onIniciarConfirmar: (id: number) => {
      setConfirmandoId(id);
      setConfirmandoData(hojeIso());
      setDescontoAdiantar("");
      setErroAcao(null);
    },
    onCancelarConfirmar: () => setConfirmandoId(null),
    onChangeData: setConfirmandoData,
    onChangeDesconto: setDescontoAdiantar,
    onConfirmar: handleConfirmar,
    onAdiantar: handleAdiantar,
  };

  const r = cobrancas?.resumo;

  const mostrarEmAtraso = filtro === "todas" || filtro === "em_atraso";
  const mostrarAVencer = filtro === "todas" || filtro === "a_vencer";
  const mostrarPagas = filtro === "todas" || filtro === "pagas";
  const mostrarCartao = filtro === "todas" || filtro === "cartao";
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const cobrancaMatchesSearch = (item: CobrancaItem) => {
    if (!normalizedSearch) return true;
    const texto = [
      item.cliente_nome,
      item.tipo_pedido,
      item.forma_pagamento,
      item.status,
      item.pedido_id ? `pedido ${item.pedido_id}` : "",
      item.pedido_id ? `#${item.pedido_id}` : "",
      parcelaLabel(item),
      item.valor != null ? String(item.valor) : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return texto.includes(normalizedSearch);
  };
  const repasseMatchesSearch = (item: RepasseItem) => {
    if (!normalizedSearch) return true;
    const texto = [
      item.cliente_nome,
      item.tipo_pedido,
      item.status,
      item.pedido_id ? `pedido ${item.pedido_id}` : "",
      item.pedido_id ? `#${item.pedido_id}` : "",
      `${item.percentual_repasse.toFixed(0)}%`,
      item.valor != null ? String(item.valor) : "",
      item.valor_pedido != null ? String(item.valor_pedido) : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return texto.includes(normalizedSearch);
  };
  const emAtrasoFiltradas = cobrancas?.em_atraso.filter(cobrancaMatchesSearch) ?? [];
  const venceHojeFiltradas = cobrancas?.vence_hoje.filter(cobrancaMatchesSearch) ?? [];
  const aVencerFiltradas = cobrancas?.a_vencer.filter(cobrancaMatchesSearch) ?? [];
  const pagasFiltradas = cobrancas?.pagas.filter(cobrancaMatchesSearch) ?? [];
  const previstasCartaoFiltradas = cobrancas?.previstas_cartao?.filter(cobrancaMatchesSearch) ?? [];
  const repassesPendentesFiltrados = repasses
    ? repasses.pendentes.filter((item) => {
        if (filtro === "pagas") return false;
        if (filtro === "em_atraso") return item.status === "em_atraso";
        if (filtro === "a_vencer") return item.status !== "em_atraso";
        return true;
      }).filter(repasseMatchesSearch)
    : [];
  const repassesPagosFiltrados = repasses && mostrarPagas ? repasses.pagos.filter(repasseMatchesSearch) : [];
  const repassesFiltradosTotal = repassesPendentesFiltrados.reduce((sum, item) => sum + item.valor, 0);
  const temRepassesFiltrados = repassesPendentesFiltrados.length > 0 || repassesPagosFiltrados.length > 0;
  const temCobrancasFiltradas = Boolean(
    (mostrarEmAtraso && emAtrasoFiltradas.length) ||
    (mostrarAVencer && venceHojeFiltradas.length) ||
    (mostrarAVencer && aVencerFiltradas.length) ||
    (mostrarCartao && previstasCartaoFiltradas.length) ||
    (mostrarPagas && pagasFiltradas.length)
  );

  return (
    <div className="pb-24">
      {/* Header sticky */}
      <div className="sticky top-14 z-40 bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Cobranças</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMes((m) => addMes(m, -1))}
              className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-gray-700 min-w-[80px] text-center">{labelMes(mes)}</span>
            <button
              onClick={() => setMes((m) => addMes(m, 1))}
              className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2">
          {(["todas", "em_atraso", "a_vencer", "cartao", "pagas"] as Filtro[]).map((f) => {
            const labels: Record<Filtro, string> = { todas: "Todas", em_atraso: "Em atraso", a_vencer: "A vencer", cartao: "Cartão", pagas: "Pagas" };
            const active = filtro === f;
            const isRed = f === "em_atraso" && active;
            return (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className="text-xs px-3 py-1.5 rounded-full border transition-colors"
                style={{
                  borderColor: isRed ? "#A32D2D" : active ? "#1D9E75" : "var(--color-border-secondary, #d1d5db)",
                  background: isRed ? "#FCEBEB" : active ? "#E1F5EE" : "transparent",
                  color: isRed ? "#A32D2D" : active ? "#0F6E56" : "var(--color-text-secondary)",
                  fontWeight: active ? 500 : 400,
                }}
              >
                {labels[f]}
              </button>
            );
          })}
        </div>

        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Buscar cliente, pedido, valor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            aria-label="Buscar cobranças"
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
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-gray-300" />
          </div>
        ) : !cobrancas ? (
          <p className="text-sm text-gray-400 text-center py-12">Não foi possível carregar.</p>
        ) : (
          <>
            {/* Chips de resumo */}
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div
                className="rounded-xl p-3 cursor-pointer"
                style={{ background: r && r.count_em_atraso > 0 ? "#FCEBEB" : "var(--color-background-secondary)" }}
                onClick={() => setFiltro(filtro === "em_atraso" ? "todas" : "em_atraso")}
              >
                <p className="text-xs mb-1" style={{ color: r && r.count_em_atraso > 0 ? "#A32D2D" : "var(--color-text-secondary)" }}>Em atraso</p>
                <p className="text-lg font-medium m-0" style={{ color: r && r.count_em_atraso > 0 ? "#791F1F" : "var(--color-text-primary)" }}>
                  {r ? formatMoney(r.total_em_atraso) : "—"}
                </p>
                <p className="text-xs mt-0.5" style={{ color: r && r.count_em_atraso > 0 ? "#A32D2D" : "var(--color-text-secondary)" }}>
                  {r?.count_em_atraso ?? 0} parcelas
                </p>
              </div>
              <div
                className="rounded-xl p-3 cursor-pointer"
                style={{ background: r && r.count_vence_7dias > 0 ? "#FAEEDA" : "var(--color-background-secondary)" }}
                onClick={() => setFiltro(filtro === "a_vencer" ? "todas" : "a_vencer")}
              >
                <p className="text-xs mb-1" style={{ color: r && r.count_vence_7dias > 0 ? "#854F0B" : "var(--color-text-secondary)" }}>Vence em 7 dias</p>
                <p className="text-lg font-medium m-0" style={{ color: r && r.count_vence_7dias > 0 ? "#633806" : "var(--color-text-primary)" }}>
                  {r ? formatMoney(r.total_vence_7dias) : "—"}
                </p>
                <p className="text-xs mt-0.5" style={{ color: r && r.count_vence_7dias > 0 ? "#854F0B" : "var(--color-text-secondary)" }}>
                  {r?.count_vence_7dias ?? 0} parcelas
                </p>
              </div>
              <div
                className="rounded-xl p-3 cursor-pointer"
                style={{ background: "var(--color-background-secondary)" }}
                onClick={() => setFiltro(filtro === "a_vencer" ? "todas" : "a_vencer")}
              >
                <p className="text-xs text-gray-500 mb-1">A vencer</p>
                <p className="text-lg font-medium text-gray-900 m-0">{r ? formatMoney(r.total_a_vencer) : "—"}</p>
                <p className="text-xs text-gray-400 mt-0.5">{r?.count_a_vencer ?? 0} parcelas</p>
              </div>
              <div
                className="rounded-xl p-3 cursor-pointer"
                style={{ background: r && r.count_pago > 0 ? "#EAF3DE" : "var(--color-background-secondary)" }}
                onClick={() => setFiltro(filtro === "pagas" ? "todas" : "pagas")}
              >
                <p className="text-xs mb-1" style={{ color: r && r.count_pago > 0 ? "#3B6D11" : "var(--color-text-secondary)" }}>Pago em {labelMes(mes)}</p>
                <p className="text-lg font-medium m-0" style={{ color: r && r.count_pago > 0 ? "#27500A" : "var(--color-text-primary)" }}>
                  {r ? formatMoney(r.total_pago) : "—"}
                </p>
                <p className="text-xs mt-0.5" style={{ color: r && r.count_pago > 0 ? "#3B6D11" : "var(--color-text-secondary)" }}>
                  {r?.count_pago ?? 0} parcelas
                </p>
              </div>
            </div>

            {/* Cartão a receber + custo de receber do mês */}
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div
                className="rounded-xl p-3 cursor-pointer"
                style={{ background: r && r.count_previsto_cartao > 0 ? "#E8F0F9" : "var(--color-background-secondary)" }}
                onClick={() => setFiltro(filtro === "cartao" ? "todas" : "cartao")}
              >
                <p className="text-xs mb-1" style={{ color: r && r.count_previsto_cartao > 0 ? "#1B4F86" : "var(--color-text-secondary)" }}>
                  Cartão a receber
                </p>
                <p className="text-lg font-medium m-0" style={{ color: r && r.count_previsto_cartao > 0 ? "#123A5E" : "var(--color-text-primary)" }}>
                  {r ? formatMoney(r.total_previsto_cartao) : "—"}
                </p>
                <p className="text-xs mt-0.5" style={{ color: r && r.count_previsto_cartao > 0 ? "#1B4F86" : "var(--color-text-secondary)" }}>
                  {r?.count_previsto_cartao ?? 0} parcelas
                </p>
              </div>
              {/* Responde "quanto estou pagando de taxa por mês" sem mexer no faturamento. */}
              <div className="rounded-xl p-3" style={{ background: "var(--color-background-secondary)" }}>
                <p className="text-xs text-gray-500 mb-1">Custo de receber</p>
                <p className="text-lg font-medium text-gray-900 m-0">
                  {r ? formatMoney((r.total_taxa_cartao ?? 0) + (r.total_desconto_pix ?? 0)) : "—"}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  cartão {formatMoney(r?.total_taxa_cartao ?? 0)} · pix {formatMoney(r?.total_desconto_pix ?? 0)}
                </p>
              </div>
            </div>

            {erroAcao && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2">
                {erroAcao}
              </p>
            )}

            {/* CARTÃO A RECEBER */}
            {mostrarCartao && previstasCartaoFiltradas.length > 0 && (
              <div>
                <SectionHeader
                  cor="#3B82F6"
                  label="CARTÃO A RECEBER"
                  count={previstasCartaoFiltradas.length}
                  total={previstasCartaoFiltradas.reduce((s, i) => s + i.valor, 0)}
                />
                {previstasCartaoFiltradas.map((item) => (
                  <CardCobranca key={item.id} item={item} {...cardProps} />
                ))}
              </div>
            )}

            {/* EM ATRASO */}
            {temRepassesFiltrados && (
              <div className="mb-5">
                <SectionHeader
                  cor="#7C3AED"
                  label="ACERTOS FUNCIONÁRIA"
                  count={repassesPendentesFiltrados.length}
                  total={repassesFiltradosTotal}
                />
                {repassesPendentesFiltrados.map((item) => (
                  <CardRepasse key={item.id} item={item} {...cardProps} />
                ))}
                {repassesPagosFiltrados.length > 0 && (
                  <div className="mt-2 rounded-xl bg-green-50 px-4 py-3">
                    <p className="text-xs font-medium text-green-800">
                      Pago em {labelMes(mes)}: {formatMoney(repassesPagosFiltrados.reduce((sum, item) => sum + item.valor, 0))}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* EM ATRASO */}
            {mostrarEmAtraso && emAtrasoFiltradas.length > 0 && (
              <div>
                <SectionHeader cor="#E24B4A" label="EM ATRASO" count={emAtrasoFiltradas.length} total={emAtrasoFiltradas.reduce((s, i) => s + i.valor, 0)} />
                {emAtrasoFiltradas.map((item) => (
                  <CardCobranca key={item.id} item={item} {...cardProps} />
                ))}
              </div>
            )}

            {/* VENCE HOJE */}
            {mostrarAVencer && venceHojeFiltradas.length > 0 && (
              <div>
                <SectionHeader cor="#EF9F27" label="VENCE HOJE" count={venceHojeFiltradas.length} total={venceHojeFiltradas.reduce((s, i) => s + i.valor, 0)} />
                {venceHojeFiltradas.map((item) => (
                  <CardCobranca key={item.id} item={item} {...cardProps} />
                ))}
              </div>
            )}

            {/* A VENCER */}
            {mostrarAVencer && aVencerFiltradas.length > 0 && (
              <div>
                <SectionHeader cor="#B4B2A9" label="A VENCER" count={aVencerFiltradas.length} total={aVencerFiltradas.reduce((s, i) => s + i.valor, 0)} />
                {aVencerFiltradas.map((item) => (
                  <CardCobranca key={item.id} item={item} {...cardProps} />
                ))}
              </div>
            )}

            {/* Nenhuma pendência */}
            {!temRepassesFiltrados && !temCobrancasFiltradas && filtro !== "pagas" && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-6 text-center mt-4">
                <p className="text-sm text-gray-500">
                  {filtro === "em_atraso"
                    ? normalizedSearch ? "Nenhuma cobrança em atraso encontrada" : "Nenhuma cobrança em atraso"
                    : filtro === "a_vencer"
                      ? normalizedSearch ? "Nenhuma cobrança a vencer encontrada" : "Nenhuma cobrança a vencer"
                      : normalizedSearch ? "Nenhuma cobrança encontrada" : "Nenhuma cobrança pendente"}
                </p>
              </div>
            )}

            {/* PAGAS */}
            {mostrarPagas && pagasFiltradas.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setPagasExpandido((v) => !v)}
                  className="w-full flex items-center justify-between py-3 border-t border-gray-100 text-left"
                >
                  <div className="flex items-center gap-2">
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#639922" }} />
                    <span className="text-xs font-medium tracking-wide" style={{ color: "#3B6D11" }}>
                      PAGAS EM {labelMes(mes).toUpperCase()}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#EAF3DE", color: "#3B6D11" }}>
                      {pagasFiltradas.length} · {formatMoney(pagasFiltradas.reduce((s, i) => s + i.valor, 0))}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{pagasExpandido ? "▲" : "▼"}</span>
                </button>
                {pagasExpandido && (
                  <div className="mt-1">
                    {pagasFiltradas.map((item) => (
                      <CardCobranca key={item.id} item={item} {...cardProps} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {mostrarPagas && pagasFiltradas.length === 0 && filtro === "pagas" && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-6 text-center mt-4">
                <p className="text-sm text-gray-500">
                  {normalizedSearch ? "Nenhuma parcela paga encontrada" : `Nenhuma parcela paga em ${labelMes(mes)}`}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
