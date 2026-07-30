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

import { getToken } from "@/lib/api-client";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

function authFetch(url: string, init?: RequestInit) {
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

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

type FieldErrors = Partial<Record<keyof FormData, string>>;

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

async function readApiError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const body = JSON.parse(text) as { detail?: unknown };
    if (!body.detail) return "Erro ao salvar";
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) {
      return body.detail
        .map((e: { loc?: string[]; msg?: string }) => {
          const campo = e.loc ? e.loc.slice(1).join(" -> ") : "";
          return campo ? `${campo}: ${e.msg}` : e.msg || "erro";
        })
        .join(" | ");
    }
    return JSON.stringify(body.detail);
  } catch {
    return text || `Erro ${res.status} ao salvar`;
  }
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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (isNaN(id)) {
      setError("ID inválido");
      setLoading(false);
      return;
    }
    authFetch(`${API_URL}/api/v1/contracts/${id}`)
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
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
    setError(null);
  };

  const validate = (current: FormData): boolean => {
    const errs: FieldErrors = {};
    if (!current.nome_completo.trim() || current.nome_completo.trim().length < 3)
      errs.nome_completo = "Nome completo é obrigatório (mín. 3 caracteres)";
    const cpfDigits = current.cpf.replace(/\D/g, "");
    if (cpfDigits.length < 11)
      errs.cpf = "CPF inválido — informe os 11 dígitos";
    if (!current.endereco.trim() || current.endereco.trim().length < 5)
      errs.endereco = "Endereço é obrigatório";
    if (!current.telefone.trim() || current.telefone.replace(/\D/g, "").length < 10)
      errs.telefone = "Telefone inválido — informe DDD + número";
    if (!current.especificacoes.trim())
      errs.especificacoes = "Especificações são obrigatórias";
    if (!current.tecidos.trim())
      errs.tecidos = "Tecidos são obrigatórios";
    if (!current.valor_total || parseFloat(current.valor_total) <= 0)
      errs.valor_total = "Informe um valor total válido";
    if (!current.data_contrato)
      errs.data_contrato = "Data do contrato é obrigatória";
    if (!current.prova_final_data)
      errs.prova_final_data = "Data da prova final é obrigatória";
    if (!current.semana_revisao_inicio)
      errs.semana_revisao_inicio = "Data de início da semana de revisão é obrigatória";
    if (!current.semana_revisao_fim)
      errs.semana_revisao_fim = "Data de fim da semana de revisão é obrigatória";
    if (
      current.semana_revisao_inicio &&
      current.semana_revisao_fim &&
      current.semana_revisao_fim < current.semana_revisao_inicio
    )
      errs.semana_revisao_fim = "Fim da revisão não pode ser antes do início";

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setError(null);
    if (!validate(form)) return;
    setSaving(true);
    try {
      const res = await authFetch(`${API_URL}/api/v1/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(form)),
      });
      if (!res.ok) {
        throw new Error(await readApiError(res));
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

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
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
                className={fieldErrors.nome_completo ? "border-red-500" : ""}
                required
              />
              {fieldErrors.nome_completo && <p className="text-xs text-red-500">{fieldErrors.nome_completo}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input
                  value={form.cpf}
                  onChange={(e) => update("cpf", e.target.value)}
                  className={fieldErrors.cpf ? "border-red-500" : ""}
                  required
                />
                {fieldErrors.cpf && <p className="text-xs text-red-500">{fieldErrors.cpf}</p>}
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
                className={fieldErrors.endereco ? "border-red-500" : ""}
                required
              />
              {fieldErrors.endereco && <p className="text-xs text-red-500">{fieldErrors.endereco}</p>}
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={form.telefone}
                onChange={(e) => update("telefone", e.target.value)}
                className={fieldErrors.telefone ? "border-red-500" : ""}
                required
              />
              {fieldErrors.telefone && <p className="text-xs text-red-500">{fieldErrors.telefone}</p>}
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
                className={fieldErrors.especificacoes ? "border-red-500" : ""}
                rows={5}
                required
              />
              {fieldErrors.especificacoes && <p className="text-xs text-red-500">{fieldErrors.especificacoes}</p>}
            </div>
            <div className="space-y-2">
              <Label>Tecidos</Label>
              <Textarea
                value={form.tecidos}
                onChange={(e) => update("tecidos", e.target.value)}
                className={fieldErrors.tecidos ? "border-red-500" : ""}
                rows={3}
                required
              />
              {fieldErrors.tecidos && <p className="text-xs text-red-500">{fieldErrors.tecidos}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor total (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.valor_total}
                  onChange={(e) => update("valor_total", e.target.value)}
                  className={fieldErrors.valor_total ? "border-red-500" : ""}
                  required
                />
                {fieldErrors.valor_total && <p className="text-xs text-red-500">{fieldErrors.valor_total}</p>}
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
                  className={fieldErrors.data_contrato ? "border-red-500" : ""}
                  required
                />
                {fieldErrors.data_contrato && <p className="text-xs text-red-500">{fieldErrors.data_contrato}</p>}
              </div>
              <div className="space-y-2">
                <Label>Prova final</Label>
                <Input
                  type="date"
                  value={form.prova_final_data}
                  onChange={(e) => update("prova_final_data", e.target.value)}
                  className={fieldErrors.prova_final_data ? "border-red-500" : ""}
                  required
                />
                {fieldErrors.prova_final_data && <p className="text-xs text-red-500">{fieldErrors.prova_final_data}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Revisão início</Label>
                <Input
                  type="date"
                  value={form.semana_revisao_inicio}
                  onChange={(e) => update("semana_revisao_inicio", e.target.value)}
                  className={fieldErrors.semana_revisao_inicio ? "border-red-500" : ""}
                  required
                />
                {fieldErrors.semana_revisao_inicio && <p className="text-xs text-red-500">{fieldErrors.semana_revisao_inicio}</p>}
              </div>
              <div className="space-y-2">
                <Label>Revisão fim</Label>
                <Input
                  type="date"
                  value={form.semana_revisao_fim}
                  onChange={(e) => update("semana_revisao_fim", e.target.value)}
                  className={fieldErrors.semana_revisao_fim ? "border-red-500" : ""}
                  required
                />
                {fieldErrors.semana_revisao_fim && <p className="text-xs text-red-500">{fieldErrors.semana_revisao_fim}</p>}
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
