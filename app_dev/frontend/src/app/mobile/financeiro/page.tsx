"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

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
}

interface CobrancasResponse {
  em_atraso: CobrancaItem[];
  vence_hoje: CobrancaItem[];
  a_vencer: CobrancaItem[];
  pagas: CobrancaItem[];
  resumo: CobrancasResumo;
}

type Filtro = "todas" | "em_atraso" | "a_vencer" | "pagas";

function parcelaLabel(item: CobrancaItem): string {
  if (item.parcela_numero && item.parcela_total) {
    if (item.parcela_numero === 1 && item.parcela_total > 1) return `Entrada (1 de ${item.parcela_total})`;
    return `Parcela ${item.parcela_numero} de ${item.parcela_total}`;
  }
  if (item.parcela_numero) return `Parcela ${item.parcela_numero}`;
  return "À vista";
}

function CardCobranca({
  item,
  confirmandoId,
  confirmandoData,
  salvando,
  onIniciarConfirmar,
  onCancelarConfirmar,
  onChangeData,
  onConfirmar,
}: {
  item: CobrancaItem;
  confirmandoId: number | null;
  confirmandoData: string;
  salvando: boolean;
  onIniciarConfirmar: (id: number) => void;
  onCancelarConfirmar: () => void;
  onChangeData: (v: string) => void;
  onConfirmar: () => void;
}) {
  const isConfirmando = confirmandoId === item.id;

  const borderColor =
    item.status === "em_atraso" ? "#F7C1C1"
    : item.status === "vence_hoje" ? "#FAC775"
    : "var(--color-border-tertiary, #e5e7eb)";

  const accentColor =
    item.status === "em_atraso" ? "#A32D2D"
    : item.status === "vence_hoje" ? "#854F0B"
    : item.status === "pago" ? "#3B6D11"
    : "var(--color-text-primary)";

  return (
    <div style={{ border: `0.5px solid ${borderColor}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
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
          <span style={{ fontSize: 11, background: "#C0DD97", color: "#27500A", padding: "2px 8px", borderRadius: 20, flexShrink: 0 }}>
            pago
          </span>
        )}
      </div>

      {/* Linha 3: parcela info + ação */}
      {!isConfirmando ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderTop: "0.5px solid var(--color-border-tertiary, #f0f0f0)", paddingTop: 10 }}>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0, minWidth: 0 }}>
            {parcelaLabel(item)}
            {item.status !== "pago" && item.data_vencimento ? ` · vence ${formatDataBR(item.data_vencimento)}` : ""}
            {item.status === "pago" && item.data_pagamento ? ` · ${formatDataBR(item.data_pagamento)}` : ""}
          </p>
          {item.status !== "pago" && (
            <button
              onClick={() => onIniciarConfirmar(item.id)}
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
          )}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "0.5px solid var(--color-border-tertiary, #f0f0f0)", paddingTop: 10 }}>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0, flexShrink: 0 }}>Recebido em</p>
          <Input
            type="date"
            value={confirmandoData}
            onChange={(e) => onChangeData(e.target.value)}
            className="h-8 text-sm flex-1"
          />
          <button
            onClick={onConfirmar}
            disabled={salvando}
            style={{ width: 32, height: 32, borderRadius: 8, background: "#639922", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            {salvando ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <Check style={{ width: 14, height: 14 }} />}
          </button>
          <button
            onClick={onCancelarConfirmar}
            style={{ width: 32, height: 32, borderRadius: 8, background: "transparent", border: "0.5px solid var(--color-border-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
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

export default function FinanceiroPage() {
  const [mes, setMes] = useState(hojeStr);
  const [cobrancas, setCobrancas] = useState<CobrancasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const [confirmandoId, setConfirmandoId] = useState<number | null>(null);
  const [confirmandoData, setConfirmandoData] = useState(hojeIso);
  const [salvando, setSalvando] = useState(false);

  const [pagasExpandido, setPagasExpandido] = useState(false);

  const fetchCobrancas = useCallback(() => {
    setLoading(true);
    fetch(`${API_URL}/api/v1/pagamentos/cobrancas?mes=${mes}`)
      .then((r) => r.json())
      .then((d) => setCobrancas(d))
      .catch(() => setCobrancas(null))
      .finally(() => setLoading(false));
  }, [mes]);

  useEffect(() => { fetchCobrancas(); }, [fetchCobrancas]);

  const handleConfirmar = async () => {
    if (!confirmandoId || !confirmandoData) return;
    setSalvando(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/pagamentos/${confirmandoId}/confirmar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data_pagamento: confirmandoData }),
      });
      if (res.ok) {
        setConfirmandoId(null);
        fetchCobrancas();
      }
    } finally {
      setSalvando(false);
    }
  };

  const cardProps = {
    confirmandoId,
    confirmandoData,
    salvando,
    onIniciarConfirmar: (id: number) => { setConfirmandoId(id); setConfirmandoData(hojeIso()); },
    onCancelarConfirmar: () => setConfirmandoId(null),
    onChangeData: setConfirmandoData,
    onConfirmar: handleConfirmar,
  };

  const r = cobrancas?.resumo;

  const mostrarEmAtraso = filtro === "todas" || filtro === "em_atraso";
  const mostrarAVencer = filtro === "todas" || filtro === "a_vencer";
  const mostrarPagas = filtro === "todas" || filtro === "pagas";

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
          {(["todas", "em_atraso", "a_vencer", "pagas"] as Filtro[]).map((f) => {
            const labels: Record<Filtro, string> = { todas: "Todas", em_atraso: "Em atraso", a_vencer: "A vencer", pagas: "Pagas" };
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

            {/* EM ATRASO */}
            {mostrarEmAtraso && cobrancas.em_atraso.length > 0 && (
              <div>
                <SectionHeader cor="#E24B4A" label="EM ATRASO" count={cobrancas.em_atraso.length} total={r?.total_em_atraso} />
                {cobrancas.em_atraso.map((item) => (
                  <CardCobranca key={item.id} item={item} {...cardProps} />
                ))}
              </div>
            )}

            {/* VENCE HOJE */}
            {mostrarAVencer && cobrancas.vence_hoje.length > 0 && (
              <div>
                <SectionHeader cor="#EF9F27" label="VENCE HOJE" count={cobrancas.vence_hoje.length} total={cobrancas.vence_hoje.reduce((s, i) => s + i.valor, 0)} />
                {cobrancas.vence_hoje.map((item) => (
                  <CardCobranca key={item.id} item={item} {...cardProps} />
                ))}
              </div>
            )}

            {/* A VENCER */}
            {mostrarAVencer && cobrancas.a_vencer.length > 0 && (
              <div>
                <SectionHeader cor="#B4B2A9" label="A VENCER" count={cobrancas.a_vencer.length} total={r?.total_a_vencer} />
                {cobrancas.a_vencer.map((item) => (
                  <CardCobranca key={item.id} item={item} {...cardProps} />
                ))}
              </div>
            )}

            {/* Nenhuma pendência */}
            {mostrarEmAtraso && mostrarAVencer &&
              cobrancas.em_atraso.length === 0 &&
              cobrancas.vence_hoje.length === 0 &&
              cobrancas.a_vencer.length === 0 && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-6 text-center mt-4">
                <p className="text-sm text-gray-500">Nenhuma cobrança pendente</p>
              </div>
            )}

            {/* PAGAS */}
            {mostrarPagas && cobrancas.pagas.length > 0 && (
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
                      {cobrancas.pagas.length} · {formatMoney(r?.total_pago ?? 0)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{pagasExpandido ? "▲" : "▼"}</span>
                </button>
                {pagasExpandido && (
                  <div className="mt-1">
                    {cobrancas.pagas.map((item) => (
                      <CardCobranca key={item.id} item={item} {...cardProps} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {mostrarPagas && cobrancas.pagas.length === 0 && filtro === "pagas" && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-6 text-center mt-4">
                <p className="text-sm text-gray-500">Nenhuma parcela paga em {labelMes(mes)}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
