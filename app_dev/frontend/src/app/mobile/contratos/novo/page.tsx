"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { ArrowLeft, Eye, FileDown, Loader2 } from "lucide-react";

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

const defaultForm: FormData = {
  nome_completo: "",
  cpf: "",
  rg: "",
  endereco: "",
  telefone: "",
  nacionalidade: "brasileira",
  especificacoes:
    "• Vestido estilo alfaiataria com o corpo mais acinturado e a saia com leveza, fechamento com botões nas costas;\n• Decote V nas costas até a altura da cintura com detalhe de renda no decote;\n• Saia mais reta, sem fenda e com uma nesga no centro das costas para formar uma leve calda;\n• Véu de tule simples sem aplicação;\n• Forro crepe leve (dispensa uso de saiote).",
  tecidos:
    "• West chic da empresa Otimotex estruturado com entretela colante da VLO entretelas;\n• crepe leve para o forro do vestido.",
  valor_total: "2800",
  valor_servico_vestir: "150",
  primeira_prova_mes: "março",
  prova_final_data: "",
  semana_revisao_inicio: "",
  semana_revisao_fim: "",
  data_contrato: new Date().toISOString().slice(0, 10),
  cidade_contrato: "Araraquara",
  autoriza_imagem_completa: false,
  testemunha1_nome: "",
  testemunha1_cpf: "",
  testemunha2_nome: "",
  testemunha2_cpf: "",
};

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Erro desconhecido";
}

function parseApiError(body: { detail?: unknown }): string {
  if (!body.detail) return "Erro ao processar a requisição";
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail)) {
    return body.detail
      .map((e: { loc?: string[]; msg?: string }) => {
        const campo = e.loc ? e.loc.slice(1).join(" → ") : "";
        return campo ? `${campo}: ${e.msg}` : e.msg || "erro";
      })
      .join(" | ");
  }
  return JSON.stringify(body.detail);
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

function NovoContratoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clienteId = searchParams.get("cliente_id");
  const [form, setForm] = useState<FormData>(defaultForm);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  useEffect(() => {
    if (!clienteId) return;
    fetch(`${API_URL}/api/v1/clientes/${clienteId}`)
      .then((res) => res.json())
      .then((c: { nome?: string; cpf?: string; rg?: string; endereco?: string; telefone?: string }) => {
        setForm((prev) => ({
          ...prev,
          nome_completo: c.nome || prev.nome_completo,
          cpf: c.cpf || prev.cpf,
          rg: c.rg || prev.rg,
          endereco: c.endereco || prev.endereco,
          telefone: c.telefone || prev.telefone,
        }));
      })
      .catch(() => {});
  }, [clienteId]);

  const update = (k: keyof FormData, v: string | boolean) => {
    setForm((p) => ({ ...p, [k]: v }));
    setFieldErrors((prev) => { const next = { ...prev }; delete next[k]; return next; });
    setApiError(null);
  };

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!form.nome_completo.trim() || form.nome_completo.trim().length < 3)
      errs.nome_completo = "Nome completo é obrigatório (mín. 3 caracteres)";
    const cpfDigits = form.cpf.replace(/\D/g, "");
    if (cpfDigits.length < 11)
      errs.cpf = "CPF inválido — informe os 11 dígitos";
    if (!form.endereco.trim() || form.endereco.trim().length < 5)
      errs.endereco = "Endereço é obrigatório";
    if (!form.telefone.trim() || form.telefone.replace(/\D/g, "").length < 10)
      errs.telefone = "Telefone inválido — informe DDD + número";
    if (!form.especificacoes.trim())
      errs.especificacoes = "Especificações são obrigatórias";
    if (!form.tecidos.trim())
      errs.tecidos = "Tecidos são obrigatórios";
    if (!form.valor_total || parseFloat(form.valor_total) <= 0)
      errs.valor_total = "Informe um valor total válido";
    if (!form.data_contrato)
      errs.data_contrato = "Data do contrato é obrigatória";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await executePreview();
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await executeGenerate();
  };

  const executePreview = async () => {
    setApiError(null);
    setPreviewLoading(true);
    try {
      const payload = buildPayload(form);
      const res = await fetch(`${API_URL}/api/v1/contracts/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(parseApiError(body));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err: unknown) {
      setApiError(extractErrorMessage(err));
    } finally {
      setPreviewLoading(false);
    }
  };

  const executeGenerate = async () => {
    setApiError(null);
    setLoading(true);
    try {
      const payload = buildPayload(form);
      const res = await fetch(`${API_URL}/api/v1/contracts/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(parseApiError(body));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Contrato_${form.nome_completo.replace(/\s+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      router.push("/mobile/contratos");
    } catch (err: unknown) {
      setApiError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const isLoading = loading || previewLoading;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pb-8">
      <div className="flex items-center gap-2">
        <Link href="/mobile/contratos">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h2 className="text-lg font-semibold">Novo Contrato</h2>
      </div>

      <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
        {apiError && (
          <Alert variant="destructive">
            <AlertDescription>{apiError}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Dados do Cliente</CardTitle>
            <CardDescription>Informações do contratante</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo</Label>
              <Input
                id="nome"
                value={form.nome_completo}
                onChange={(e) => update("nome_completo", e.target.value)}
                placeholder="Ex: Maria Silva"
                className={fieldErrors.nome_completo ? "border-red-500" : ""}
              />
              {fieldErrors.nome_completo && <p className="text-xs text-red-500">{fieldErrors.nome_completo}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  value={form.cpf}
                  onChange={(e) => update("cpf", e.target.value)}
                  placeholder="000.000.000-00"
                  className={fieldErrors.cpf ? "border-red-500" : ""}
                />
                {fieldErrors.cpf && <p className="text-xs text-red-500">{fieldErrors.cpf}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="rg">RG</Label>
                <Input
                  id="rg"
                  value={form.rg}
                  onChange={(e) => update("rg", e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="endereco">Endereço completo</Label>
              <Input
                id="endereco"
                value={form.endereco}
                onChange={(e) => update("endereco", e.target.value)}
                placeholder="Rua, número, bairro"
                className={fieldErrors.endereco ? "border-red-500" : ""}
              />
              {fieldErrors.endereco && <p className="text-xs text-red-500">{fieldErrors.endereco}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={form.telefone}
                onChange={(e) => update("telefone", e.target.value)}
                placeholder="(16) 99999-9999"
                className={fieldErrors.telefone ? "border-red-500" : ""}
              />
              {fieldErrors.telefone && <p className="text-xs text-red-500">{fieldErrors.telefone}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Especificações do Vestido</CardTitle>
            <CardDescription>Descrição e tecidos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="especificacoes">Especificações (uma por linha ou com •)</Label>
              <Textarea
                id="especificacoes"
                value={form.especificacoes}
                onChange={(e) => update("especificacoes", e.target.value)}
                rows={6}
                className={fieldErrors.especificacoes ? "border-red-500" : ""}
              />
              {fieldErrors.especificacoes && <p className="text-xs text-red-500">{fieldErrors.especificacoes}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tecidos">Tecidos</Label>
              <Textarea
                id="tecidos"
                value={form.tecidos}
                onChange={(e) => update("tecidos", e.target.value)}
                rows={3}
                className={fieldErrors.tecidos ? "border-red-500" : ""}
              />
              {fieldErrors.tecidos && <p className="text-xs text-red-500">{fieldErrors.tecidos}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Valores e Datas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor_total">Valor total (R$)</Label>
                <Input
                  id="valor_total"
                  type="number"
                  step="0.01"
                  value={form.valor_total}
                  onChange={(e) => update("valor_total", e.target.value)}
                  className={fieldErrors.valor_total ? "border-red-500" : ""}
                />
                {fieldErrors.valor_total && <p className="text-xs text-red-500">{fieldErrors.valor_total}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor_vestir">Serviço vestir (R$/h)</Label>
                <Input
                  id="valor_vestir"
                  type="number"
                  step="0.01"
                  value={form.valor_servico_vestir}
                  onChange={(e) => update("valor_servico_vestir", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="primeira_prova">Mês da primeira prova</Label>
              <Input
                id="primeira_prova"
                value={form.primeira_prova_mes}
                onChange={(e) => update("primeira_prova_mes", e.target.value)}
                placeholder="Ex: março"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prova_final">Data prova final</Label>
                <Input
                  id="prova_final"
                  type="date"
                  value={form.prova_final_data}
                  onChange={(e) => update("prova_final_data", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_contrato">Data do contrato</Label>
                <Input
                  id="data_contrato"
                  type="date"
                  value={form.data_contrato}
                  onChange={(e) => update("data_contrato", e.target.value)}
                  className={fieldErrors.data_contrato ? "border-red-500" : ""}
                />
                {fieldErrors.data_contrato && <p className="text-xs text-red-500">{fieldErrors.data_contrato}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="revisao_inicio">Semana revisão início</Label>
                <Input
                  id="revisao_inicio"
                  type="date"
                  value={form.semana_revisao_inicio}
                  onChange={(e) => update("semana_revisao_inicio", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revisao_fim">Semana revisão fim</Label>
                <Input
                  id="revisao_fim"
                  type="date"
                  value={form.semana_revisao_fim}
                  onChange={(e) => update("semana_revisao_fim", e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade do contrato</Label>
              <Input
                id="cidade"
                value={form.cidade_contrato}
                onChange={(e) => update("cidade_contrato", e.target.value)}
                placeholder="Araraquara"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Direito de Imagem</CardTitle>
            <CardDescription>Autorização para uso de fotos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="imagem"
                checked={form.autoriza_imagem_completa}
                onCheckedChange={(c) => update("autoriza_imagem_completa", !!c)}
              />
              <Label htmlFor="imagem" className="font-normal cursor-pointer">
                Autorizo divulgação com rosto visível
              </Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Testemunhas (opcional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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

        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            disabled={isLoading}
            onClick={handlePreview}
          >
            {previewLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Eye className="mr-2 h-4 w-4" />
            {previewLoading ? "Gerando preview..." : "Pré-visualizar contrato"}
          </Button>
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={isLoading}
            onClick={handleGenerate}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <FileDown className="mr-2 h-4 w-4" />
            {loading ? "Gerando..." : "Gerar e baixar PDF"}
          </Button>
        </div>
      </form>

    </div>
  );
}

export default function NovoContratoPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>}>
      <NovoContratoContent />
    </Suspense>
  );
}
