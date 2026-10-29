"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, ImagePlus, Loader2, PackageCheck, Plus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, buildUrl } from "@/lib/api-client";

interface Item { id: number; codigo: string; nome: string; categoria: string; tamanho?: string; cor?: string; valor_aluguel_padrao?: number; valor_reposicao?: number; foto_url?: string; status_item: string; ativo: boolean }
interface Aluguel { id: number; cliente_nome: string; data_retirada: string; data_devolucao_prevista: string; status: string; valor_total: number; valor_caucao: number; status_caucao: string; forma_pagamento?: string; alerta?: string; itens: { item_acervo_id: number; codigo: string; nome: string; foto_url?: string }[] }

const dinheiro = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const data = (v: string) => new Date(`${v}T12:00:00`).toLocaleDateString("pt-BR");

export default function AlugueisPage() {
  const [alugueis, setAlugueis] = useState<Aluguel[]>([]);
  const [acervo, setAcervo] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAcervo, setShowAcervo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [devolucao, setDevolucao] = useState<Aluguel | null>(null);
  const [observacaoDevolucao, setObservacaoDevolucao] = useState("");
  const [valorDano, setValorDano] = useState("");
  const [novo, setNovo] = useState({ codigo: "", nome: "", categoria: "Vestido", tamanho: "", cor: "", valor_aluguel_padrao: "", valor_reposicao: "", foto_url: "" });

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [a, i] = await Promise.all([api.get<Aluguel[]>("/api/v1/alugueis"), api.get<Item[]>("/api/v1/alugueis/acervo?incluir_inativos=true")]);
      setAlugueis(a); setAcervo(i);
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao carregar aluguéis"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { carregar(); setShowAcervo(new URLSearchParams(window.location.search).has("acervo")); }, [carregar]);

  async function mudarStatus(id: number, status: string) {
    setError("");
    try {
      if (status === "Devolvido") {
        const aluguel = alugueis.find(a => a.id === id);
        if (!aluguel) return;
        setDevolucao(aluguel); setObservacaoDevolucao(""); setValorDano(""); return;
      } else {
        await api.patch(`/api/v1/alugueis/${id}/status`, { status });
      }
      await carregar();
    }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível atualizar o aluguel."); }
  }

  async function confirmarDevolucao() {
    if (!devolucao) return;
    setSaving(true); setError("");
    try {
      const dano = Number(valorDano.replace(",", ".")) || 0;
      const statusCaucao = devolucao.valor_caucao <= 0 ? undefined : dano > 0 ? (dano >= devolucao.valor_caucao ? "retida" : "parcialmente_retida") : "devolvida";
      await api.post(`/api/v1/alugueis/${devolucao.id}/devolucao`, { status_caucao: statusCaucao, itens: devolucao.itens.map((item, index) => ({ item_acervo_id: item.item_acervo_id, observacao_devolucao: observacaoDevolucao || null, valor_dano: index === 0 ? dano : 0 })) });
      setDevolucao(null); await carregar();
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao registrar devolução"); } finally { setSaving(false); }
  }

  async function enviarFoto(file?: File) {
    if (!file) return;
    setSaving(true); setError("");
    try {
      const form = new FormData(); form.append("file", file);
      const response = await api.fetch("/api/v1/alugueis/acervo/upload-foto", { method: "POST", body: form });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || "Erro ao enviar foto");
      const result = await response.json(); setNovo(n => ({ ...n, foto_url: result.url }));
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao enviar foto"); } finally { setSaving(false); }
  }

  async function criarItem(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      await api.post("/api/v1/alugueis/acervo", { ...novo, tamanho: novo.tamanho || null, cor: novo.cor || null, foto_url: novo.foto_url || null, valor_aluguel_padrao: Number(novo.valor_aluguel_padrao.replace(",", ".")) || null, valor_reposicao: Number(novo.valor_reposicao.replace(",", ".")) || null });
      setNovo({ codigo: "", nome: "", categoria: "Vestido", tamanho: "", cor: "", valor_aluguel_padrao: "", valor_reposicao: "", foto_url: "" }); await carregar();
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao cadastrar item"); } finally { setSaving(false); }
  }

  return <div className="p-4 pb-24 space-y-5">
    <div><h2 className="text-xl font-semibold">Aluguéis</h2><p className="text-sm text-gray-500">Reservas, retiradas, devoluções e acervo</p></div>
    <div className="grid grid-cols-2 gap-3">
      <Link href="/mobile/pedidos/novo?tipo=aluguel"><Button className="w-full"><Plus className="w-4 h-4 mr-2"/>Novo pedido de aluguel</Button></Link>
      <Button variant="outline" onClick={() => setShowAcervo(v => !v)}>Acervo ({acervo.length})</Button>
    </div>
    {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {showAcervo && <section className="rounded-xl border p-4 space-y-4">
      <h3 className="font-semibold">Cadastrar vestido ou acessório</h3>
      <form onSubmit={criarItem} className="grid grid-cols-2 gap-3">
        <label className="col-span-2 flex min-h-28 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed bg-gray-50">
          {novo.foto_url ? <img src={buildUrl(novo.foto_url)} alt="Prévia do produto" className="h-32 w-full object-contain"/> : <span className="flex items-center gap-2 text-sm text-gray-500"><ImagePlus className="h-5 w-5"/>Adicionar foto do produto</span>}
          <input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => enviarFoto(e.target.files?.[0])}/>
        </label>
        <div><Label>Código</Label><Input required value={novo.codigo} onChange={e => setNovo({...novo, codigo:e.target.value})}/></div>
        <div><Label>Categoria</Label><select className="h-10 w-full rounded-md border px-3" value={novo.categoria} onChange={e => setNovo({...novo, categoria:e.target.value})}><option>Vestido</option><option>Acessório</option></select></div>
        <div className="col-span-2"><Label>Nome/descrição</Label><Input required value={novo.nome} onChange={e => setNovo({...novo, nome:e.target.value})}/></div>
        <div><Label>Tamanho</Label><Input value={novo.tamanho} onChange={e => setNovo({...novo, tamanho:e.target.value})}/></div>
        <div><Label>Cor</Label><Input value={novo.cor} onChange={e => setNovo({...novo, cor:e.target.value})}/></div>
        <div><Label>Valor padrão do aluguel</Label><Input inputMode="decimal" value={novo.valor_aluguel_padrao} onChange={e => setNovo({...novo, valor_aluguel_padrao:e.target.value})}/></div>
        <div><Label>Valor de reposição</Label><Input inputMode="decimal" value={novo.valor_reposicao} onChange={e => setNovo({...novo, valor_reposicao:e.target.value})}/></div>
        <Button className="self-end" disabled={saving}>{saving ? <Loader2 className="animate-spin"/> : "Adicionar"}</Button>
      </form>
      <div className="divide-y text-sm">{acervo.map(i => <div key={i.id} className={`flex items-center gap-3 py-3 ${i.ativo ? "" : "opacity-50"}`}>{i.foto_url ? <img src={buildUrl(i.foto_url)} alt="" className="h-14 w-14 rounded-lg object-cover"/> : <div className="h-14 w-14 rounded-lg bg-gray-100"/>}<span className="flex-1"><b>{i.codigo}</b> · {i.nome}<span className="block text-gray-500">{i.categoria}{i.tamanho ? ` · ${i.tamanho}` : ""}{i.cor ? ` · ${i.cor}` : ""} · {i.status_item}{i.valor_aluguel_padrao != null ? ` · ${dinheiro(i.valor_aluguel_padrao)}` : ""}</span></span><button type="button" className={`text-xs ${i.ativo ? "text-red-600" : "text-green-700"}`} onClick={async()=>{await api.patch(`/api/v1/alugueis/acervo/${i.id}`,{ativo:!i.ativo});carregar();}}>{i.ativo ? "Inativar" : "Reativar"}</button></div>)}</div>
    </section>}
    {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin"/></div> : alugueis.length === 0 ? <div className="rounded-xl border bg-gray-50 p-8 text-center text-gray-500">Nenhum aluguel ativo.</div> :
      <div className="space-y-3">{alugueis.map(a => <article key={a.id} className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
        <div className="flex justify-between gap-3"><div><p className="font-semibold">{a.cliente_nome}</p><p className="text-sm text-gray-500">{a.itens.map(i => `${i.codigo} — ${i.nome}`).join(", ")}</p></div><span className="h-fit rounded-full bg-gray-100 px-2.5 py-1 text-xs">{a.status}</span></div>
        {a.alerta && <p className="flex items-center gap-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-800"><AlertTriangle className="h-4 w-4"/>{a.alerta}</p>}
        <div className="flex justify-between text-sm"><span>{data(a.data_retirada)} → {data(a.data_devolucao_prevista)}</span><b>{dinheiro(a.valor_total)}</b></div>
        <div className="text-xs text-gray-500">Pagamento: {a.forma_pagamento || "não definido"}{a.valor_caucao > 0 ? ` · Caução ${dinheiro(a.valor_caucao)} (${a.status_caucao})` : ""} · <Link className="underline" href={`/mobile/pedidos/${a.id}`}>ver pedido</Link></div>
        <div className="flex gap-2">
          {a.status === "Reservado" && <><Button size="sm" onClick={() => mudarStatus(a.id, "Retirado")}><PackageCheck className="w-4 h-4 mr-1"/>Retirado</Button><Button size="sm" variant="outline" onClick={() => mudarStatus(a.id, "Cancelado")}><X className="w-4 h-4 mr-1"/>Cancelar</Button></>}
          {a.status === "Retirado" && <Button size="sm" onClick={() => mudarStatus(a.id, "Devolvido")}><RotateCcw className="w-4 h-4 mr-1"/>Devolvido</Button>}
          {a.status === "Devolvido" && <span className="text-sm text-green-700 flex items-center"><Check className="w-4 h-4 mr-1"/>Concluído</span>}
        </div>
      </article>)}</div>}
    {devolucao && <div className="fixed inset-0 z-[90] flex items-end bg-black/40" onClick={() => setDevolucao(null)}><div className="w-full space-y-4 rounded-t-2xl bg-white p-5 pb-8" onClick={e => e.stopPropagation()}>
      <div><h3 className="text-lg font-semibold">Conferir devolução</h3><p className="text-sm text-gray-500">{devolucao.cliente_nome} · {devolucao.itens.map(i => i.codigo).join(", ")}</p></div>
      <div><Label>Observação sobre o estado dos itens</Label><Input value={observacaoDevolucao} onChange={e => setObservacaoDevolucao(e.target.value)} placeholder="Ex.: devolvido sem avarias"/></div>
      <div><Label>Valor dos danos (R$)</Label><Input inputMode="decimal" value={valorDano} onChange={e => setValorDano(e.target.value)} placeholder="0,00"/></div>
      <p className="rounded-lg bg-gray-50 p-3 text-sm">Caução: {dinheiro(devolucao.valor_caucao)}. Sem danos, será marcada como devolvida; com danos, como retida total ou parcialmente.</p>
      <div className="grid grid-cols-2 gap-3"><Button type="button" variant="outline" onClick={() => setDevolucao(null)}>Cancelar</Button><Button type="button" disabled={saving} onClick={confirmarDevolucao}>{saving ? <Loader2 className="animate-spin"/> : "Confirmar devolução"}</Button></div>
    </div></div>}
  </div>;
}
