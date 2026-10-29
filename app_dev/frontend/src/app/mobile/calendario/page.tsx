"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, Loader2, PackageCheck, RotateCcw } from "lucide-react";
import { api } from "@/lib/api-client";

interface AluguelAgenda { id: number; cliente_nome: string; data_retirada: string; data_devolucao_prevista: string; status: string; alerta?: string; itens: { codigo: string; nome: string }[] }
const formatar = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });

export default function CalendarioPage() {
  const [itens, setItens] = useState<AluguelAgenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    api.get<AluguelAgenda[]>("/api/v1/alugueis?ativos=true").then(setItens).catch(e => setErro(e.message)).finally(() => setLoading(false));
  }, []);

  return <div className="px-4 py-6 pb-24">
    <h2 className="text-xl font-semibold text-gray-900">Agenda operacional</h2>
    <p className="mt-1 text-sm text-gray-500">Próximas retiradas, devoluções e alertas do acervo</p>
    {erro && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
    {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin"/></div> : itens.length === 0 ?
      <div className="mt-6 flex min-h-[200px] flex-col items-center justify-center rounded-xl border bg-gray-50 p-8"><CalendarDays className="mb-4 h-12 w-12 text-gray-300"/><p className="text-gray-500">Nenhum aluguel ativo na agenda.</p></div> :
      <div className="mt-6 space-y-3">{itens.map(item => <Link href={`/mobile/pedidos/${item.id}`} key={item.id} className="block rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div><b>{item.cliente_nome}</b><p className="text-sm text-gray-500">{item.itens.map(i => `${i.codigo} · ${i.nome}`).join(", ")}</p></div><span className="rounded-full bg-gray-100 px-2 py-1 text-xs">{item.status}</span></div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm"><span className="flex items-center gap-2"><PackageCheck className="h-4 w-4"/>Retirada: {formatar(item.data_retirada)}</span><span className="flex items-center gap-2"><RotateCcw className="h-4 w-4"/>Devolução: {formatar(item.data_devolucao_prevista)}</span></div>
        {item.alerta && <p className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-800"><AlertTriangle className="h-4 w-4"/>{item.alerta}</p>}
      </Link>)}</div>}
  </div>;
}
