"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";
interface Cliente { id: number; nome: string }
interface Item { id: number; codigo: string; nome: string; categoria: string; tamanho?: string; disponivel?: boolean }

export default function NovoAluguelPage() {
  const router = useRouter();
  const hoje = new Date().toISOString().slice(0,10);
  const [clientes, setClientes] = useState<Cliente[]>([]); const [itens, setItens] = useState<Item[]>([]);
  const [clienteId, setClienteId] = useState(""); const [busca, setBusca] = useState("");
  const [retirada, setRetirada] = useState(hoje); const [devolucao, setDevolucao] = useState(hoje);
  const [selecionados, setSelecionados] = useState<Record<number,string>>({});
  const [caucao, setCaucao] = useState(""); const [pagamento, setPagamento] = useState(""); const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");

  useEffect(() => { fetch(`${API_URL}/api/v1/clientes`).then(r=>r.json()).then(setClientes); }, []);
  useEffect(() => {
    if (!retirada || !devolucao || devolucao < retirada) { setItens([]); return; }
    fetch(`${API_URL}/api/v1/alugueis/acervo?data_retirada=${retirada}&data_devolucao=${devolucao}`).then(r=>r.json()).then(setItens).catch(()=>setItens([]));
  }, [retirada, devolucao]);
  const filtrados = useMemo(() => clientes.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase())).slice(0,12), [clientes,busca]);
  const total = Object.values(selecionados).reduce((s,v)=>s+(parseFloat(v.replace(",","."))||0),0);

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (!clienteId || Object.keys(selecionados).length === 0) { setError("Selecione o cliente e pelo menos um item disponível."); return; }
    setLoading(true);
    const body = { cliente_id:Number(clienteId), data_reserva:hoje, data_retirada:retirada, data_devolucao_prevista:devolucao, valor_caucao:parseFloat(caucao.replace(",","."))||0, forma_pagamento:pagamento||null, observacao:observacao||null, itens:Object.entries(selecionados).map(([id,v])=>({item_acervo_id:Number(id),valor_aluguel:parseFloat(v.replace(",","."))||0})) };
    try { const res=await fetch(`${API_URL}/api/v1/alugueis`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}); if(!res.ok){const x=await res.json().catch(()=>({}));throw new Error(x.detail||"Erro ao salvar aluguel");} router.push("/mobile/alugueis"); }
    catch(e){setError(e instanceof Error?e.message:"Erro ao salvar aluguel");} finally{setLoading(false);}
  }
  return <form onSubmit={salvar} className="p-4 pb-24 space-y-5">
    <div className="flex items-center gap-3"><Link href="/mobile/alugueis"><ArrowLeft/></Link><div><h2 className="text-xl font-semibold">Novo aluguel</h2><p className="text-sm text-gray-500">A disponibilidade é validada ao salvar</p></div></div>
    {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <section className="rounded-xl border p-4 space-y-3"><h3 className="font-semibold">Cliente e período</h3>
      <div><Label>Buscar cliente</Label><Input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Nome da cliente"/><select required className="mt-2 h-10 w-full rounded-md border px-3" value={clienteId} onChange={e=>setClienteId(e.target.value)}><option value="">Selecione...</option>{filtrados.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
      <div className="grid grid-cols-2 gap-3"><div><Label>Retirada</Label><Input type="date" required value={retirada} onChange={e=>setRetirada(e.target.value)}/></div><div><Label>Devolução</Label><Input type="date" required min={retirada} value={devolucao} onChange={e=>setDevolucao(e.target.value)}/></div></div>
    </section>
    <section className="rounded-xl border p-4 space-y-3"><h3 className="font-semibold">Itens do acervo</h3>{itens.length===0?<p className="text-sm text-gray-500">Nenhum item cadastrado. Cadastre no Acervo antes de reservar.</p>:itens.map(i=><label key={i.id} className={`flex items-center gap-3 rounded-lg border p-3 ${i.disponivel?"":"opacity-45 bg-gray-50"}`}><input type="checkbox" disabled={!i.disponivel} checked={selecionados[i.id]!==undefined} onChange={e=>{const n={...selecionados};if(e.target.checked)n[i.id]="";else delete n[i.id];setSelecionados(n);}}/><span className="flex-1 text-sm"><b>{i.codigo}</b> · {i.nome}<br/><span className="text-gray-500">{i.categoria}{i.tamanho?` · ${i.tamanho}`:""}{!i.disponivel?" · indisponível":""}</span></span>{selecionados[i.id]!==undefined&&<Input aria-label={`Valor de ${i.nome}`} className="w-28" inputMode="decimal" placeholder="R$" value={selecionados[i.id]} onChange={e=>setSelecionados({...selecionados,[i.id]:e.target.value})}/>}</label>)}</section>
    <section className="rounded-xl border p-4 space-y-3"><h3 className="font-semibold">Pagamento</h3><div className="grid grid-cols-2 gap-3"><div><Label>Caução</Label><Input inputMode="decimal" value={caucao} onChange={e=>setCaucao(e.target.value)}/></div><div><Label>Forma</Label><select className="h-10 w-full rounded-md border px-3" value={pagamento} onChange={e=>setPagamento(e.target.value)}><option value="">Selecione</option><option>Pix</option><option>Cartão de Crédito</option><option>Dinheiro</option><option>Parcelado</option></select></div></div><div><Label>Observações</Label><Input value={observacao} onChange={e=>setObservacao(e.target.value)}/></div><p className="text-right font-semibold">Total: {new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(total)}</p></section>
    <Button className="w-full" size="lg" disabled={loading}>{loading?<Loader2 className="animate-spin"/>:"Salvar reserva"}</Button>
  </form>;
}
