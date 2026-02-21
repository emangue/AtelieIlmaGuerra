"use client";

import { Calendar } from "lucide-react";

export default function CalendarioPage() {
  return (
    <div className="px-4 py-6">
      <h2 className="text-xl font-semibold text-gray-900">Calendário</h2>
      <p className="text-sm text-gray-500 mt-1">Datas de entrega e provas (em breve)</p>
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 flex flex-col items-center justify-center min-h-[200px] mt-6">
        <Calendar className="w-12 h-12 text-gray-300 mb-4" />
        <p className="text-gray-500 text-center">Calendário em desenvolvimento</p>
      </div>
    </div>
  );
}
