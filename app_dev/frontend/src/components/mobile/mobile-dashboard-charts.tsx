"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";

function formatMoney(val: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

const MESES_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const CORES_ANOS: Record<number, string> = {
  2026: "#6366f1",
  2025: "#3b82f6",
  2024: "#94a3b8",
  2023: "#64748b",
  2022: "#475569",
};

interface LucroMensal {
  mes: string;
  label: string;
  valor: number;
}

interface MixPieItem {
  name: string;
  value: number;
  fill: string;
}

export interface MobileDashboardChartsProps {
  period: "month" | "ytd" | "year" | "ytd-closed";
  lucroMensal: LucroMensal[];
  chartDataYTD: Record<string, string | number>[];
  chartDataYTDClosed: { ano: string; label: string; valor: number }[];
  chartDataAno: { ano: string; label: string; valor: number }[];
  lucroPorAnoOrdenado: { ano: number }[];
  mixParaPie: MixPieItem[];
}

export function MobileDashboardCharts({
  period,
  lucroMensal,
  chartDataYTD,
  chartDataYTDClosed,
  chartDataAno,
  lucroPorAnoOrdenado,
  mixParaPie,
}: MobileDashboardChartsProps) {
  const router = useRouter();
  const mesAtual = new Date().getMonth();

  return (
    <>
      {/* Gráfico Mix Status (donut) */}
      {mixParaPie.length > 0 && (() => {
        const total = mixParaPie.reduce((s, i) => s + i.value, 0);
        const sorted = [...mixParaPie].sort((a, b) => b.value - a.value);
        return (
          <div className="rounded-xl border border-gray-200 bg-white p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              {period === "month" ? "Mix de status (pedidos do mês)" : "Mix de status (pedidos do ano)"}
            </h3>
            <div className="flex items-center gap-4">
              {/* Donut */}
              <div className="relative flex-shrink-0 w-[120px] h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mixParaPie}
                      cx="50%"
                      cy="50%"
                      innerRadius={38}
                      outerRadius={56}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      startAngle={90}
                      endAngle={-270}
                    >
                      {mixParaPie.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Centro */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-bold text-gray-900 leading-none">{total}</span>
                  <span className="text-[10px] text-gray-500 mt-0.5">peças</span>
                </div>
              </div>
              {/* Lista lateral */}
              <div className="flex-1 space-y-2">
                {sorted.map((s) => {
                  const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
                  return (
                    <div key={s.name} className="flex items-center gap-2">
                      <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: s.fill }} />
                      <span className="text-xs text-gray-700 flex-1 truncate">{s.name}</span>
                      <span className="text-xs font-medium text-gray-900">{s.value} un.</span>
                      <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Gráfico Lucro / Faturamento (barras) */}
      {(lucroMensal.length > 0 || chartDataYTD.length > 0 || chartDataYTDClosed.length > 0 || chartDataAno.length > 0) && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">
            {period === "month" && "Lucro mensal (últimos 12 meses)"}
            {period === "ytd" && "Faturamento por mês (ano completo)"}
            {period === "ytd-closed" && `Faturamento até ${MESES_LABELS[mesAtual]} (por ano)`}
            {period === "year" && "Faturamento por ano (anos fechados)"}
          </h3>
          <div className="h-[220px] min-h-[220px] w-full min-w-0">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minHeight={220}
              initialDimension={{ width: 300, height: 220 }}
            >
              {period === "month" && lucroMensal.length > 0 && (
                <BarChart data={lucroMensal} margin={{ top: 20, right: 5, left: 5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} tickFormatter={(v) => v.split("/")[0]} />
                  <YAxis hide />
                  <Tooltip
                    formatter={(val: number | undefined) => [val != null ? formatMoney(val) : "", "Lucro"]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                    labelFormatter={(l) => `Mês: ${l}`}
                  />
                  <Bar
                    dataKey="valor"
                    fill="#6366f1"
                    radius={[4, 4, 0, 0]}
                    name="Lucro"
                    cursor="pointer"
                    onClick={(data: { payload?: { mes?: string } }) => {
                      const mes = data?.payload?.mes;
                      if (mes) router.push(`/mobile/pedidos/todos?mes=${mes}`);
                    }}
                  >
                    <LabelList
                      position="insideTop"
                      formatter={(val: unknown) =>
                        typeof val === "number" && val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val ?? "")
                      }
                      style={{ fontSize: 10, fill: "white", fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              )}
              {period === "ytd" && chartDataYTD.length > 0 && (
                <BarChart data={chartDataYTD} margin={{ top: 20, right: 5, left: 5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis hide />
                  <Tooltip
                    formatter={(val: number | undefined) => [val != null ? formatMoney(val) : "", ""]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                    labelFormatter={(l) => `Mês: ${l}`}
                  />
                  {lucroPorAnoOrdenado.map(({ ano }) => (
                    <Bar
                      key={ano}
                      dataKey={String(ano)}
                      fill={CORES_ANOS[ano] ?? "#94a3b8"}
                      radius={[4, 4, 0, 0]}
                      name={String(ano)}
                    >
                      <LabelList
                        position="insideTop"
                        formatter={(val: unknown) =>
                          typeof val === "number"
                            ? val >= 1000
                              ? `${(val / 1000).toFixed(0)}k`
                              : val > 0
                                ? String(val)
                                : ""
                            : ""
                        }
                        style={{ fontSize: 9, fill: "white", fontWeight: 600 }}
                      />
                    </Bar>
                  ))}
                </BarChart>
              )}
              {(period === "year" || period === "ytd-closed") &&
                (period === "year" ? chartDataAno : chartDataYTDClosed).length > 0 && (
                  <BarChart
                    data={period === "year" ? chartDataAno : chartDataYTDClosed}
                    margin={{ top: 20, right: 5, left: 5, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis hide />
                    <Tooltip
                      formatter={(val: number | undefined) =>
                        [val != null ? formatMoney(val) : "", "Faturamento"]
                      }
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                      labelFormatter={(l) => `Ano: ${l}`}
                    />
                    <Bar
                      dataKey="valor"
                      fill="#6366f1"
                      radius={[4, 4, 0, 0]}
                      name="Faturamento"
                      cursor="pointer"
                      onClick={(data: { payload?: { ano?: string } }) => {
                        const ano = data?.payload?.ano;
                        if (ano) router.push(`/mobile/pedidos/todos?mes=${ano}01`);
                      }}
                    >
                      <LabelList
                        position="insideTop"
                        formatter={(val: unknown) =>
                          typeof val === "number" && val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val ?? "")
                        }
                        style={{ fontSize: 10, fill: "white", fontWeight: 600 }}
                      />
                    </Bar>
                  </BarChart>
                )}
            </ResponsiveContainer>
          </div>
          {period === "ytd" && lucroPorAnoOrdenado.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-3 justify-center">
              {lucroPorAnoOrdenado.map(({ ano }) => (
                <span key={ano} className="inline-flex items-center gap-1.5 text-xs">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: CORES_ANOS[ano] ?? "#94a3b8" }}
                  />
                  {ano}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
