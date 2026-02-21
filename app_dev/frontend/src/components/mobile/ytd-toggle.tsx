"use client";

/**
 * YTDToggle - Toggle entre Mês e Ano
 * Adaptado do ProjetoFinancasV5
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export type YTDToggleValue = "month" | "ytd";

interface YTDToggleProps {
  value: YTDToggleValue;
  onChange: (value: YTDToggleValue) => void;
  labels?: { month: string; ytd: string };
  className?: string;
}

export function YTDToggle({
  value,
  onChange,
  labels = { month: "Mês", ytd: "Ano" },
  className,
}: YTDToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center bg-gray-100 rounded-lg p-1 min-h-[44px]",
        className
      )}
      role="tablist"
      aria-label="Período de visualização"
    >
      <button
        role="tab"
        aria-selected={value === "month"}
        aria-controls="dashboard-content"
        onClick={() => onChange("month")}
        className={cn(
          "px-4 py-2 rounded-md font-semibold text-sm transition-all duration-200 min-w-[60px] min-h-[36px]",
          value === "month"
            ? "bg-white text-black shadow-sm"
            : "bg-transparent text-gray-500 hover:text-gray-700"
        )}
      >
        {labels.month}
      </button>
      <button
        role="tab"
        aria-selected={value === "ytd"}
        aria-controls="dashboard-content"
        onClick={() => onChange("ytd")}
        className={cn(
          "px-4 py-2 rounded-md font-semibold text-sm transition-all duration-200 min-w-[60px] min-h-[36px]",
          value === "ytd"
            ? "bg-white text-black shadow-sm"
            : "bg-transparent text-gray-500 hover:text-gray-700"
        )}
      >
        {labels.ytd}
      </button>
    </div>
  );
}
