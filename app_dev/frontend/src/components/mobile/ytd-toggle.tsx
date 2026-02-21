"use client";

/**
 * PeriodToggle - Toggle entre Mês, YTD, Ano e YTD Fechado
 * 4 opções: Mês | YTD | Ano | YTD Fech.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export type PeriodView = "month" | "ytd" | "year" | "ytd-closed";

// Compatibilidade com código que usa YTDToggleValue
export type YTDToggleValue = PeriodView;

interface PeriodToggleProps {
  value: PeriodView;
  onChange: (value: PeriodView) => void;
  labels?: { month: string; ytd: string; year: string; ytdClosed: string };
  className?: string;
}

const DEFAULT_LABELS = {
  month: "Mês",
  ytd: "YTD",
  year: "Ano",
  ytdClosed: "YTD Fech.",
};

export function YTDToggle({
  value,
  onChange,
  labels = DEFAULT_LABELS,
  className,
}: PeriodToggleProps) {
  const opts: { id: PeriodView; label: string }[] = [
    { id: "month", label: labels.month },
    { id: "ytd", label: labels.ytd },
    { id: "year", label: labels.year },
    { id: "ytd-closed", label: labels.ytdClosed },
  ];

  return (
    <div
      className={cn(
        "inline-flex flex-wrap items-center justify-center gap-1 bg-gray-100 rounded-lg p-1 min-h-[44px]",
        className
      )}
      role="tablist"
      aria-label="Período de visualização"
    >
      {opts.map((opt) => (
        <button
          key={opt.id}
          role="tab"
          aria-selected={value === opt.id}
          aria-controls="dashboard-content"
          onClick={() => onChange(opt.id)}
          className={cn(
            "px-3 py-2 rounded-md font-semibold text-xs transition-all duration-200 min-h-[36px]",
            value === opt.id
              ? "bg-white text-black shadow-sm"
              : "bg-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
