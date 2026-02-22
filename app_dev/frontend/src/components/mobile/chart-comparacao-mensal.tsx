"use client";

import React from "react";
import {
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

export interface EvolucaoMensalItem {
  anomes: string;
  label: string;
  receita_planejada: number;
  receita_realizada: number;
}

export function ChartComparacaoMensal({ data }: { data: EvolucaoMensalItem[] }) {
  if (data.length === 0) return null;

  return (
    <div className="h-[200px] min-h-[200px] w-full min-w-[280px]">
      <ResponsiveContainer
        width="100%"
        height="100%"
        minHeight={200}
        initialDimension={{ width: 300, height: 200 }}
      >
        <BarChart data={data} margin={{ top: 24, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis hide />
          <Tooltip
            formatter={(val: number | undefined) => [val != null ? formatMoney(val) : "", ""]}
            contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
            labelFormatter={(l) => `Mês: ${l}`}
          />
          <Bar
            dataKey="receita_planejada"
            fill="#d1d5db"
            radius={[4, 4, 0, 0]}
            name="Planejado"
          >
            <LabelList
              position="top"
              formatter={(val: unknown) =>
                typeof val === "number" && val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val ? String(val) : ""
              }
              style={{ fontSize: 9, fill: "#6b7280", fontWeight: 500 }}
            />
          </Bar>
          <Bar
            dataKey="receita_realizada"
            fill="#1f2937"
            radius={[4, 4, 0, 0]}
            name="Realizado"
          >
            <LabelList
              position="top"
              formatter={(val: unknown) =>
                typeof val === "number" && val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val ? String(val) : ""
              }
              style={{ fontSize: 9, fill: "#374151", fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
