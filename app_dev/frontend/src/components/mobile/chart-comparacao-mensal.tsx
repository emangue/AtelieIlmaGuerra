"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  useEffect(() => setMounted(true), []);

  if (data.length === 0) return null;
  if (!mounted) return <div className="h-[200px] w-full" />;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBarClick = (entry: any) => {
    const anomes = entry?.activePayload?.[0]?.payload?.anomes;
    if (anomes) router.push(`/mobile/pedidos/todos?mes=${anomes}`);
  };

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height={200} minWidth={0}>
        <BarChart data={data} margin={{ top: 24, right: 8, left: 8, bottom: 0 }} onClick={handleBarClick} style={{ cursor: "pointer" }}>
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
