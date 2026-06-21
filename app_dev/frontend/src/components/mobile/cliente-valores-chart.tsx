"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function formatMoney(val: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

export interface ValoresPorMesItem {
  mes: string;
  label: string;
  valor: number;
}

export function ClienteValoresChart({ data }: { data: ValoresPorMesItem[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (data.length === 0) return null;
  if (!mounted) return <div className="h-[200px] w-full" />;

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height={200} minWidth={0}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} tickFormatter={(v) => v.split("/")[0]} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
          <Tooltip
            formatter={(val: number | undefined) => [val != null ? formatMoney(val) : "", "Valor"]}
            contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
            labelFormatter={(l) => `Mês: ${l}`}
          />
          <Bar dataKey="valor" fill="#dc2626" radius={[4, 4, 0, 0]} name="Valor" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
