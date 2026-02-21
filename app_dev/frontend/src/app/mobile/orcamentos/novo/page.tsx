"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

interface ClienteItem {
  id: number;
  nome: string;
}

export default function NovoOrcamentoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<ClienteItem[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [descricao, setDescricao] = useState("");
  const [horasTrabalho, setHorasTrabalho] = useState("0");
  const [custoMateriais, setCustoMateriais] = useState("0");
  const [custosVariaveis, setCustosVariaveis] = useState("0");
  const [valor, setValor] = useState("");
  const [margens, setMargens] = useState<{
    margem_20: number;
    margem_30: number;
    margem_40: number;
    custo_total: number;
  } | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/clientes`)
      .then((res) => res.json())
      .then(setClientes)
      .catch(() => setClientes([]));
  }, []);

  useEffect(() => {
    const h = parseFloat(horasTrabalho) || 0;
    const m = parseFloat(custoMateriais) || 0;
    const v = parseFloat(custosVariaveis) || 0;
    if (h === 0 && m === 0 && v === 0) {
      setMargens(null);
      return;
    }
    fetch(`${API_URL}/api/v1/parametros/calcular-margens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        horas_trabalho: h,
        custo_materiais: m,
        custos_variaveis: v,
      }),
    })
      .then((res) => res.json())
      .then(setMargens)
      .catch(() => setMargens(null));
  }, [horasTrabalho, custoMateriais, custosVariaveis]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId || !data) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/orcamentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: Number(clienteId),
          data,
          descricao: descricao || null,
          valor: valor ? parseFloat(valor) : null,
          status: "Ativo",
          horas_trabalho: parseFloat(horasTrabalho) || 0,
          custo_materiais: parseFloat(custoMateriais) || 0,
          custos_variaveis: parseFloat(custosVariaveis) || 0,
        }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      router.push("/mobile/orcamentos");
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div className="flex items-center gap-2">
        <Link href="/mobile/orcamentos">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Novo Orçamento
          </h2>
          <p className="text-sm text-gray-500">
            Preencha os dados e veja as margens em tempo real
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="cliente">Cliente *</Label>
          <select
            id="cliente"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Selecione...</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="data">Data *</Label>
          <Input
            id="data"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            required
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="descricao">Descrição</Label>
          <Input
            id="descricao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Vestido de noiva..."
            className="mt-1"
          />
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Custos (para cálculo de margens)
          </h3>
          <div className="space-y-3">
            <div>
              <Label htmlFor="horas">Horas de Trabalho</Label>
              <Input
                id="horas"
                type="number"
                step="0.25"
                min="0"
                value={horasTrabalho}
                onChange={(e) => setHorasTrabalho(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="custoMateriais">Custo Materiais (R$)</Label>
              <Input
                id="custoMateriais"
                type="number"
                step="0.01"
                min="0"
                value={custoMateriais}
                onChange={(e) => setCustoMateriais(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="custosVariaveis">Custos Variáveis (R$)</Label>
              <Input
                id="custosVariaveis"
                type="number"
                step="0.01"
                min="0"
                value={custosVariaveis}
                onChange={(e) => setCustosVariaveis(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {margens && (
          <div className="rounded-lg bg-gray-50 p-4 space-y-2">
            <p className="text-sm font-medium text-gray-700">
              Preço sugerido (para margem de lucro):
            </p>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <span className="text-gray-500">20%:</span>{" "}
                <span className="font-medium">
                  R$ {margens.margem_20.toLocaleString("pt-BR")}
                </span>
              </div>
              <div>
                <span className="text-gray-500">30%:</span>{" "}
                <span className="font-medium">
                  R$ {margens.margem_30.toLocaleString("pt-BR")}
                </span>
              </div>
              <div>
                <span className="text-gray-500">40%:</span>{" "}
                <span className="font-medium">
                  R$ {margens.margem_40.toLocaleString("pt-BR")}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Custo total: R$ {margens.custo_total.toLocaleString("pt-BR")}
            </p>
          </div>
        )}

        <div>
          <Label htmlFor="valor">Valor do Orçamento (R$)</Label>
          <Input
            id="valor"
            type="number"
            step="0.01"
            min="0"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Valor final acordado"
            className="mt-1"
          />
        </div>

        <div className="flex gap-2 pt-4">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
          <Link href="/mobile/orcamentos">
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
