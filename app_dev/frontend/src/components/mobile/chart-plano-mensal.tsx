"use client";

import React, { useEffect, useState } from "react";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LabelList,
} from "recharts";

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(v));
}

function abbrev(v: number): string {
  const a = Math.abs(v);
  if (a >= 1000) return `${(a / 1000).toFixed(0)}k`;
  if (a === 0) return "0";
  return String(Math.round(a));
}

export interface PlanoMensalItem {
  anomes: string;
  label: string;
  receita_planejada: number;
  despesas_planejadas: number;
  lucro_planejado: number;
  receita_realizada: number;
  despesas_realizadas: number;
  lucro_realizado: number;
}

interface ChartRow {
  label: string;
  custo_plan: number;
  lucro_plan_pos: number;
  prejuizo_plan: number;
  custo_real: number;
  lucro_real_pos: number;
  prejuizo_real: number;
  fat_plan: number;
  fat_real: number;
}

function toChartRow(d: PlanoMensalItem): ChartRow {
  const temPlano = d.receita_planejada > 0 || d.despesas_planejadas > 0;
  // Prejuízo vem PRIMEIRO no stack (valor negativo vai abaixo do zero).
  // Custo empilha a partir do prejuízo, subindo até fat_real.
  // Lucro empilha em cima do custo até fat_real + lucro.
  return {
    label: d.label,
    prejuizo_real: Math.min(0, d.lucro_realizado),   // negativo ou 0 — renderiza abaixo do zero
    custo_real: d.despesas_realizadas,                // sobe a partir do prejuízo até fat_real
    lucro_real_pos: Math.max(0, d.lucro_realizado),  // sobe em cima do custo
    fat_real: d.receita_realizada,
    prejuizo_plan: temPlano ? Math.min(0, d.lucro_planejado) : null as unknown as number,
    custo_plan: temPlano ? d.despesas_planejadas : null as unknown as number,
    lucro_plan_pos: temPlano ? Math.max(0, d.lucro_planejado) : null as unknown as number,
    fat_plan: temPlano ? d.receita_planejada : 0,
  };
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; payload: ChartRow }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const lucroReal = row.lucro_real_pos + row.prejuizo_real;
  const lucroPlano = row.lucro_plan_pos + row.prejuizo_plan;
  return (
    <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "10px 12px", fontSize: 12, minWidth: 180, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
      <p style={{ fontWeight: 500, marginBottom: 8, color: "#111" }}>{label}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span style={{ color: "#6b7280" }}>Faturamento real</span>
          <span style={{ fontWeight: 500, color: "#111" }}>{fmt(row.fat_real)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span style={{ color: "#6b7280" }}>Custo real</span>
          <span style={{ color: "#D85A30" }}>{fmt(row.custo_real)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span style={{ color: "#6b7280" }}>{lucroReal < 0 ? "Prejuízo real" : "Lucro real"}</span>
          <span style={{ color: lucroReal < 0 ? "#E24B4A" : "#1D9E75" }}>{lucroReal < 0 ? "-" : ""}{fmt(lucroReal)}</span>
        </div>
        <div style={{ borderTop: "0.5px solid #e5e7eb", margin: "4px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span style={{ color: "#6b7280" }}>Faturamento plano</span>
          <span style={{ color: "#9ca3af" }}>{fmt(row.fat_plan)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span style={{ color: "#6b7280" }}>Custo plano</span>
          <span style={{ color: "#F0997B" }}>{fmt(row.custo_plan)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span style={{ color: "#6b7280" }}>{lucroPlano < 0 ? "Prejuízo plano" : "Lucro plano"}</span>
          <span style={{ color: lucroPlano < 0 ? "#F09595" : "#9FE1CB", fontWeight: 500 }}>{lucroPlano < 0 ? "-" : ""}{fmt(lucroPlano)}</span>
        </div>
      </div>
    </div>
  );
};

type LP = { x?: number; y?: number; width?: number; height?: number; index?: number };

/**
 * Cria um renderizador de label para um segmento da barra empilhada.
 * - segKey: chave do dado que este segmento representa (para leitura direta em rows)
 * - fillText: cor do texto interno
 * - showFatOnTop: se true, também renderiza o faturamento acima da barra
 * - fatKey: qual faturamento mostrar no topo
 * - lucroKey: usado para decidir se este bar é o topo do stack (quando lucro > 0)
 * - isTopWhenNoLucro: se true, é o custo bar e mostra fat no topo quando lucro = 0
 */
function makeBarLabel(
  rows: ChartRow[],
  segKey: keyof ChartRow,
  fillText: string,
  fatKey?: "fat_real" | "fat_plan",
  lucroKey?: "lucro_real_pos" | "lucro_plan_pos",
  isTopWhenNoLucro?: boolean,
) {
  return function BarLabel({ x = 0, y = 0, width = 0, height = 0, index = 0 }: LP) {
    const row = rows[index];
    if (!row) return null;

    const segVal = row[segKey] as number;
    const absH = Math.abs(height);

    const elems: React.ReactNode[] = [];

    // Label dentro do segmento
    if (segVal && absH >= 12) {
      const isNeg = segVal < 0;
      const label = (isNeg ? "-" : "") + abbrev(segVal);
      // Para barras negativas (prejuizo), y é a linha zero e height é positivo indo para baixo
      const cy = y + absH / 2 + 4;
      elems.push(
        <text key="seg" x={x + width / 2} y={cy} textAnchor="middle" fontSize={8} fill={fillText} fontWeight={500}>
          {label}
        </text>
      );
    }

    // Label de faturamento no topo do stack
    if (fatKey && lucroKey) {
      const fat = row[fatKey] as number;
      const lucro = row[lucroKey] as number;
      const shouldShow = isTopWhenNoLucro ? lucro <= 0 : lucro > 0;
      if (fat > 0 && shouldShow) {
        elems.push(
          <text key="fat" x={x + width / 2} y={y - 5} textAnchor="middle" fontSize={9} fill="#374151" fontWeight={700}>
            {abbrev(fat)}
          </text>
        );
      }
    }

    if (elems.length === 0) return null;
    return <g>{elems}</g>;
  };
}

export function ChartPlanoMensal({ data }: { data: PlanoMensalItem[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (data.length === 0) return null;
  if (!mounted) return <div style={{ height: 260 }} />;

  const rows = data.map(toChartRow);

  // Etiquetas — lê rows[index] diretamente, nunca p.value
  // Nota: custo mostra fat no topo QUANDO lucro <= 0 (custo é o topo do stack positivo)
  const LabelPrejuizoReal = makeBarLabel(rows, "prejuizo_real", "rgba(255,255,255,0.9)");
  const LabelCustoReal    = makeBarLabel(rows, "custo_real",    "rgba(255,255,255,0.9)", "fat_real",  "lucro_real_pos", true);
  const LabelLucroReal    = makeBarLabel(rows, "lucro_real_pos","rgba(255,255,255,0.9)", "fat_real",  "lucro_real_pos", false);
  const LabelPrejuizoPlan = makeBarLabel(rows, "prejuizo_plan", "rgba(255,255,255,0.9)");
  const LabelCustoPlan    = makeBarLabel(rows, "custo_plan",    "#c47a5f",               "fat_plan",  "lucro_plan_pos", true);
  const LabelLucroPlan    = makeBarLabel(rows, "lucro_plan_pos","#2d7a60",               "fat_plan",  "lucro_plan_pos", false);

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 10 }}>
        {[
          { label: "Lucro real", color: "#1D9E75" },
          { label: "Custo real", color: "#D85A30" },
          { label: "Lucro plano", color: "#9FE1CB" },
          { label: "Custo plano", color: "#F5C4B3" },
          { label: "Prejuízo", color: "#B91C1C" },
        ].map((l) => (
          <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6b7280" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: l.color, flexShrink: 0 }} />
            {l.label}
          </span>
        ))}
      </div>

      {/* Scroll horizontal — largura fixa por mês para caber o ano inteiro */}
      <div style={{ overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch" }}>
      <div style={{ height: 250, width: Math.max(rows.length * 64, 300) }}>
        <ResponsiveContainer width="100%" height={250} minWidth={0}>
          <ComposedChart data={rows} margin={{ top: 22, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} horizontalValues={[0]} />
            <ReferenceLine y={0} stroke="#9ca3af" strokeWidth={1.5} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} />

            {/* ── Realizado: prejuízo primeiro (abaixo do zero) → custo → lucro ── */}
            <Bar dataKey="prejuizo_real" stackId="real" fill="#B91C1C" barSize={22} radius={[0, 0, 4, 4]}>
              <LabelList content={LabelPrejuizoReal as any} />
            </Bar>
            <Bar dataKey="custo_real" stackId="real" fill="#D85A30" barSize={22}>
              <LabelList content={LabelCustoReal as any} />
            </Bar>
            <Bar dataKey="lucro_real_pos" stackId="real" fill="#1D9E75" barSize={22} radius={[4, 4, 0, 0]}>
              <LabelList content={LabelLucroReal as any} />
            </Bar>

            {/* ── Plano: mesmo padrão ── */}
            <Bar dataKey="prejuizo_plan" stackId="plano" fill="#FCA5A5" barSize={22} radius={[0, 0, 4, 4]}>
              <LabelList content={LabelPrejuizoPlan as any} />
            </Bar>
            <Bar dataKey="custo_plan" stackId="plano" fill="#F5C4B3" barSize={22}>
              <LabelList content={LabelCustoPlan as any} />
            </Bar>
            <Bar dataKey="lucro_plan_pos" stackId="plano" fill="#9FE1CB" barSize={22} radius={[4, 4, 0, 0]}>
              <LabelList content={LabelLucroPlan as any} />
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      </div>
      <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
        Coluna escura = realizado · Coluna clara = plano · Abaixo do zero = prejuízo
      </p>
    </div>
  );
}
