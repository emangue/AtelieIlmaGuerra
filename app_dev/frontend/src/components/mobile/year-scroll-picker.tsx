"use client";

/**
 * YearScrollPicker - Scroll horizontal de anos
 * Usado na visão YTD do painel
 */
import * as React from "react";
import { cn } from "@/lib/utils";

interface YearScrollPickerProps {
  selectedYear: number;
  onYearChange: (year: number) => void;
  yearsRange?: number;
  className?: string;
}

export function YearScrollPicker({
  selectedYear,
  onYearChange,
  yearsRange = 5,
  className,
}: YearScrollPickerProps) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const selectedYearRef = React.useRef<HTMLButtonElement>(null);

  const currentYear = new Date().getFullYear();
  const years = React.useMemo(() => {
    const result: number[] = [];
    for (let y = currentYear - yearsRange; y <= currentYear + 1; y++) {
      result.push(y);
    }
    return result;
  }, [currentYear, yearsRange]);

  React.useEffect(() => {
    if (selectedYearRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const button = selectedYearRef.current;
      const containerWidth = container.offsetWidth;
      const buttonLeft = button.offsetLeft;
      const buttonWidth = button.offsetWidth;
      const scrollPosition = buttonLeft - containerWidth / 2 + buttonWidth / 2;
      container.scrollTo({ left: scrollPosition, behavior: "smooth" });
    }
  }, [selectedYear]);

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
        {years.map((year) => {
          const isSelected = year === selectedYear;
          const isCurrentYear = year === currentYear;

          return (
            <button
              key={year}
              ref={isSelected ? selectedYearRef : null}
              onClick={() => onYearChange(year)}
              className={cn(
                "flex flex-col items-center justify-center shrink-0 min-w-[64px] min-h-[44px] px-4 py-2 rounded-lg transition-all duration-200",
                isSelected && "bg-black text-white shadow-md",
                !isSelected && "bg-gray-100 text-gray-600 hover:bg-gray-200 active:bg-gray-300",
                isCurrentYear && !isSelected && "ring-2 ring-blue-400"
              )}
              aria-label={`Ano ${year}`}
              aria-pressed={isSelected}
            >
              <span className="font-semibold text-[15px] leading-5">
                {year}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
