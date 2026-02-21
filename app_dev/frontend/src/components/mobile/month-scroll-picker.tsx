"use client";

/**
 * MonthScrollPicker - Scroll horizontal de meses
 * Adaptado do ProjetoFinancasV5
 */
import * as React from "react";
import { format, addMonths, subMonths, startOfMonth, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface MonthScrollPickerProps {
  selectedMonth: Date;
  onMonthChange: (month: Date) => void;
  monthsRange?: number;
  className?: string;
}

export function MonthScrollPicker({
  selectedMonth,
  onMonthChange,
  monthsRange = 6,
  className,
}: MonthScrollPickerProps) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const selectedMonthRef = React.useRef<HTMLButtonElement>(null);

  const months = React.useMemo(() => {
    const result: Date[] = [];
    const start = subMonths(startOfMonth(new Date()), monthsRange);
    for (let i = 0; i <= monthsRange * 2; i++) {
      result.push(addMonths(start, i));
    }
    return result;
  }, [monthsRange]);

  React.useEffect(() => {
    if (selectedMonthRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const button = selectedMonthRef.current;
      const containerWidth = container.offsetWidth;
      const buttonLeft = button.offsetLeft;
      const buttonWidth = button.offsetWidth;
      const scrollPosition = buttonLeft - containerWidth / 2 + buttonWidth / 2;
      container.scrollTo({ left: scrollPosition, behavior: "smooth" });
    }
  }, [selectedMonth]);

  return (
    <div
      className={cn("w-full overflow-x-auto scrollbar-hide", className)}
      ref={scrollContainerRef}
      style={{
        WebkitOverflowScrolling: "touch",
        msOverflowStyle: "none",
        scrollbarWidth: "none",
      }}
    >
      <div className="flex gap-2 px-5 py-4">
        {months.map((month) => {
          const isSelected = isSameMonth(month, selectedMonth);
          const isCurrentMonth = isSameMonth(month, new Date());
          const raw = format(month, "MMM", { locale: ptBR }).replace(".", "");
          const monthLabel = raw.charAt(0).toUpperCase() + raw.slice(1);
          const year = format(month, "yyyy");

          return (
            <button
              key={month.toISOString()}
              ref={isSelected ? selectedMonthRef : null}
              onClick={() => onMonthChange(month)}
              className={cn(
                "flex flex-col items-center justify-center shrink-0 min-w-[60px] min-h-[44px] px-4 py-2 rounded-lg transition-all duration-200",
                isSelected && "bg-black text-white shadow-md",
                !isSelected && "bg-gray-100 text-gray-600 hover:bg-gray-200 active:bg-gray-300",
                isCurrentMonth && !isSelected && "ring-2 ring-blue-400"
              )}
              aria-label={`${monthLabel} ${year}`}
              aria-pressed={isSelected}
            >
              <span className="font-semibold text-[15px] leading-5">
                {monthLabel}
              </span>
              <span
                className={cn(
                  "text-xs",
                  isSelected ? "text-gray-300" : "text-gray-400"
                )}
              >
                {year}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
