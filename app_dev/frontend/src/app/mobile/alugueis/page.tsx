"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2, PackageCheck, Plus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

interface Item { id: number; codigo: string; nome: string; categoria: string; tamanho?: string; ativo: boolean }
interface Aluguel { id: number; cliente_nome: string; data_retirada: string; data_devolucao_prevista: string; status: string; valor_total: number; itens: { codigo: string; nome: string }[] }

const dinheiro = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const data = (v: string) => new Date(`${v}T12:00:00`).toLocaleDateString("pt-BR");

export default function AlugueisPage() {
  const [alugueis, setAlugueis] = useState<Aluguel[]>([]);
  const [acervo, setAcervo] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAcervo, setShowAcervo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [novo, setNovo] = useState({ codigo: "", nome: "", categoria: "Vestido", tamanho: "" });

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [a, i] = await Promise.all([
        fetch(`${API_URL}/api/v1/alugueis`).then(r => r.json()),
        fetch(`${API_URL}/api/v1/alugueis/acervo?incluir_inativos=true`).then(r => r.json()),
      ]);
      setAlugueis(Array.isArray(a) ? a : []); setAcervo(Array.isArray(i) ? i : []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function mudarStatus(id: number, status: string) {
    setError("");
    const res = await fetch(`${API_URL}/api/v1/alugueis/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.detail || "Não foi possível atualizar o aluguel."); return; }
    carregar();
  }

  async function criarItem(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const res = await fetch(`${API_URL}/api/v1/alugueis/acervo`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...novo, tamanho: novo.tamanho || null }) });
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.detail || "Erro ao cadastrar item"); }
      setNovo({ codigo: "", nome: "", categoria: "Vestido", tamanho: "" }); await carregar();
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao cadastrar item"); } finally { setSaving(false); }
  }

  return <div className="p-4 pb-24 space-y-5">
    <div><h2 className="text-xl font-semibold">Aluguéis</h2><p className="text-sm text-gray-500">Reservas, retiradas, devoluções e acervo</p></div>
    <div className="grid grid-cols-2 gap-3">
      <Link href="/mobile/alugueis/novo"><Button className="w-full"><Plus className="w-4 h-4 mr-2"/>Novo aluguel</Button></Link>
      <Button variant="outline" onClick={() => setShowAcervo(v => !v)}>Acervo ({acervo.length})</Button>
    </div>
    {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {showAcervo && <section className="rounded-xl border p-4 space-y-4">
      <h3 className="font-semibold">Cadastrar vestido ou acessório</h3>
      <form onSubmit={criarItem} className="grid grid-cols-2 gap-3">
        <div><Label>Código</Label><Input required value={novo.codigo} onChange={e => setNovo({...novo, codigo:e.target.value})}/></div>
        <div><Label>Categoria</Label><select className="h-10 w-full rounded-md border px-3" value={novo.categoria} onChange={e => setNovo({...novo, categoria:e.target.value})}><option>Vestido</option><option>Acessório</option></select></div>
        <div className="col-span-2"><Label>Nome/descrição</Label><Input required value={novo.nome} onChange={e => setNovo({...novo, nome:e.target.value})}/></div>
        <div><Label>Tamanho</Label><Input value={novo.tamanho} onChange={e => setNovo({...novo, tamanho:e.target.value})}/></div>
        <Button className="self-end" disabled={saving}>{saving ? <Loader2 className="animate-spin"/> : "Adicionar"}</Button>
      </form>
      <div className="divide-y text-sm">{acervo.map(i => <div key={i.id} className={`flex items-center gap-2 py-2 ${i.ativo ? "" : "opacity-50"}`}><span className="flex-1"><b>{i.codigo}</b> · {i.nome}<span className="text-gray-500"> · {i.categoria}{i.tamanho ? ` · ${i.tamanho}` : ""}{i.ativo ? "" : " · inativo"}</span></span><button type="button" className={`text-xs ${i.ativo ? "text-red-600" : "text-green-700"}`} onClick={async()=>{await fetch(`${API_URL}/api/v1/alugueis/acervo/${i.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({ativo:!i.ativo})});carregar();}}>{i.ativo ? "Inativar" : "Reativar"}</button></div>)}</div>
    </section>}
    {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin"/></div> : alugueis.length === 0 ? <div className="rounded-xl border bg-gray-50 p-8 text-center text-gray-500">Nenhum aluguel ativo.</div> :
      <div className="space-y-3">{alugueis.map(a => <article key={a.id} className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
        <div className="flex justify-between gap-3"><div><p className="font-semibold">{a.cliente_nome}</p><p className="text-sm text-gray-500">{a.itens.map(i => `${i.codigo} — ${i.nome}`).join(", ")}</p></div><span className="h-fit rounded-full bg-gray-100 px-2.5 py-1 text-xs">{a.status}</span></div>
        <div className="flex justify-between text-sm"><span>{data(a.data_retirada)} → {data(a.data_devolucao_prevista)}</span><b>{dinheiro(a.valor_total)}</b></div>
        <div className="flex gap-2">
          {a.status === "Reservado" && <><Button size="sm" onClick={() => mudarStatus(a.id, "Retirado")}><PackageCheck className="w-4 h-4 mr-1"/>Retirado</Button><Button size="sm" variant="outline" onClick={() => mudarStatus(a.id, "Cancelado")}><X className="w-4 h-4 mr-1"/>Cancelar</Button></>}
          {a.status === "Retirado" && <Button size="sm" onClick={() => mudarStatus(a.id, "Devolvido")}><RotateCcw className="w-4 h-4 mr-1"/>Devolvido</Button>}
          {a.status === "Devolvido" && <span className="text-sm text-green-700 flex items-center"><Check className="w-4 h-4 mr-1"/>Concluído</span>}
        </div>
      </article>)}</div>}
  </div>;
}
