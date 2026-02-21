"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

interface FormData {
  nome_completo: string;
  cpf: string;
  rg: string;
  endereco: string;
  telefone: string;
  nacionalidade: string;
  especificacoes: string;
  tecidos: string;
  valor_total: string;
  valor_servico_vestir: string;
  primeira_prova_mes: string;
  prova_final_data: string;
  semana_revisao_inicio: string;
  semana_revisao_fim: string;
  data_contrato: string;
  cidade_contrato: string;
  autoriza_imagem_completa: boolean;
  testemunha1_nome: string;
  testemunha1_cpf: string;
  testemunha2_nome: string;
  testemunha2_cpf: string;
}

function contractToForm(c: Record<string, unknown>): FormData {
  const toStr = (v: unknown) => (v != null ? String(v) : "");
  const toDate = (v: unknown) => {
    if (v && typeof v === "string" && v.length >= 10) return v.slice(0, 10);
    return "";
  };
  return {
    nome_completo: toStr(c.nome_completo),
    cpf: toStr(c.cpf),
    rg: toStr(c.rg),
    endereco: toStr(c.endereco),
    telefone: toStr(c.telefone),
    nacionalidade: toStr(c.nacionalidade) || "brasileira",
    especificacoes: toStr(c.especificacoes),
    tecidos: toStr(c.tecidos),
    valor_total: toStr(c.valor_total),
    valor_servico_vestir: toStr(c.valor_servico_vestir) || "150",
    primeira_prova_mes: toStr(c.primeira_prova_mes) || "março",
    prova_final_data: toDate(c.prova_final_data),
    semana_revisao_inicio: toDate(c.semana_revisao_inicio),
    semana_revisao_fim: toDate(c.semana_revisao_fim),
    data_contrato: toDate(c.data_contrato),
    cidade_contrato: toStr(c.cidade_contrato) || "Araraquara",
    autoriza_imagem_completa: Boolean(c.autoriza_imagem_completa),
    testemunha1_nome: toStr(c.testemunha1_nome),
    testemunha1_cpf: toStr(c.testemunha1_cpf),
    testemunha2_nome: toStr(c.testemunha2_nome),
    testemunha2_cpf: toStr(c.testemunha2_cpf),
  };
}

function buildPayload(form: FormData) {
  return {
    nome_completo: form.nome_completo.trim(),
    cpf: form.cpf.replace(/\D/g, ""),
    rg: form.rg.trim(),
    endereco: form.endereco.trim(),
    telefone: form.telefone.trim(),
    nacionalidade: form.nacionalidade.trim() || "brasileira",
    especificacoes: form.especificacoes.trim(),
    tecidos: form.tecidos.trim(),
    valor_total: parseFloat(form.valor_total) || 0,
    valor_servico_vestir: parseFloat(form.valor_servico_vestir) || 150,
    primeira_prova_mes: form.primeira_prova_mes.trim() || "março",
    prova_final_data: form.prova_final_data,
    semana_revisao_inicio: form.semana_revisao_inicio,
    semana_revisao_fim: form.semana_revisao_fim,
    data_contrato: form.data_contrato,
    cidade_contrato: form.cidade_contrato.trim() || "Araraquara",
    autoriza_imagem_completa: form.autoriza_imagem_completa,
    testemunha1_nome: form.testemunha1_nome.trim(),
    testemunha1_cpf: form.testemunha1_cpf.trim(),
    testemunha2_nome: form.testemunha2_nome.trim(),
    testemunha2_cpf: form.testemunha2_cpf.trim(),
  };
}

export default function EditarContratoPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNaN(id)) {
      setError("ID inválido");
      setLoading(false);
      return;
    }
    fetch(`${API_URL}/api/v1/contracts/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Contrato não encontrado");
        return res.json();
      })
      .then((data) => setForm(contractToForm(data)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const update = (k: keyof FormData, v: string | boolean) => {
    setForm((p) => (p ? { ...p, [k]: v } : null));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(form)),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Erro ao salvar");
      }
      router.push(`/mobile/contratos/${id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Link href="/mobile/contratos">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pb-8">
      <div className="flex items-center gap-2">
        <Link href={`/mobile/contratos/${id}`}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h2 className="text-lg font-semibold">Editar contrato</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Dados do Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input
                value={form.nome_completo}
                onChange={(e) => update("nome_completo", e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input
                  value={form.cpf}
                  onChange={(e) => update("cpf", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>RG</Label>
                <Input
                  value={form.rg}
                  onChange={(e) => update("rg", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input
                value={form.endereco}
                onChange={(e) => update("endereco", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={form.telefone}
                onChange={(e) => update("telefone", e.target.value)}
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Especificações e Valores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Especificações</Label>
              <Textarea
                value={form.especificacoes}
                onChange={(e) => update("especificacoes", e.target.value)}
                rows={5}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tecidos</Label>
              <Textarea
                value={form.tecidos}
                onChange={(e) => update("tecidos", e.target.value)}
                rows={3}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor total (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.valor_total}
                  onChange={(e) => update("valor_total", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Serviço vestir (R$/h)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.valor_servico_vestir}
                  onChange={(e) => update("valor_servico_vestir", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Datas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data contrato</Label>
                <Input
                  type="date"
                  value={form.data_contrato}
                  onChange={(e) => update("data_contrato", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Prova final</Label>
                <Input
                  type="date"
                  value={form.prova_final_data}
                  onChange={(e) => update("prova_final_data", e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Revisão início</Label>
                <Input
                  type="date"
                  value={form.semana_revisao_inicio}
                  onChange={(e) => update("semana_revisao_inicio", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Revisão fim</Label>
                <Input
                  type="date"
                  value={form.semana_revisao_fim}
                  onChange={(e) => update("semana_revisao_fim", e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mês primeira prova</Label>
              <Input
                value={form.primeira_prova_mes}
                onChange={(e) => update("primeira_prova_mes", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input
                value={form.cidade_contrato}
                onChange={(e) => update("cidade_contrato", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Direito de imagem e testemunhas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={form.autoriza_imagem_completa}
                onCheckedChange={(c) => update("autoriza_imagem_completa", !!c)}
              />
              <Label className="font-normal">Autorizo divulgação com rosto visível</Label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Testemunha 1 - Nome</Label>
                <Input
                  value={form.testemunha1_nome}
                  onChange={(e) => update("testemunha1_nome", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Testemunha 1 - CPF</Label>
                <Input
                  value={form.testemunha1_cpf}
                  onChange={(e) => update("testemunha1_cpf", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Testemunha 2 - Nome</Label>
                <Input
                  value={form.testemunha2_nome}
                  onChange={(e) => update("testemunha2_nome", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Testemunha 2 - CPF</Label>
                <Input
                  value={form.testemunha2_cpf}
                  onChange={(e) => update("testemunha2_cpf", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" size="lg" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar alterações
        </Button>
      </form>
    </div>
  );
}
