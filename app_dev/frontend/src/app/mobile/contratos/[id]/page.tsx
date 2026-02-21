"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Edit,
  FileDown,
  ExternalLink,
  Loader2,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

interface ContractDetail {
  id: number;
  nome_completo: string;
  cpf: string;
  rg: string;
  endereco: string;
  telefone: string;
  nacionalidade: string;
  especificacoes: string;
  tecidos: string;
  valor_total: number;
  valor_servico_vestir: number;
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
  created_at: string;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function ContratoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

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
      .then(setContract)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/contracts/${id}/pdf`);
      if (!res.ok) throw new Error("Erro ao baixar");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Contrato_${contract?.nome_completo.replace(/\s+/g, "_") || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Erro ao baixar PDF");
    } finally {
      setDownloading(false);
    }
  };

  const previewUrl = `${API_URL}/api/v1/contracts/${id}/preview`;

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Link href="/mobile/contratos">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <Alert variant="destructive">
          <AlertDescription>{error || "Contrato não encontrado"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pb-8">
      <div className="flex items-center justify-between gap-2">
        <Link href="/mobile/contratos">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h2 className="flex-1 text-lg font-semibold truncate">
          {contract.nome_completo}
        </h2>
        <Link href={`/mobile/contratos/${id}/editar`}>
          <Button variant="outline" size="sm">
            <Edit className="mr-1 h-4 w-4" />
            Editar
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          disabled={downloading}
          onClick={handleDownload}
        >
          {downloading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="mr-2 h-4 w-4" />
          )}
          Baixar PDF
        </Button>
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <Button variant="outline" size="lg" className="w-full">
            <ExternalLink className="mr-2 h-4 w-4" />
            Abrir preview em nova aba
          </Button>
        </a>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do contrato</CardTitle>
          <CardDescription>
            Gerado em {formatDate(contract.created_at)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="font-medium text-muted-foreground">Cliente</p>
            <p>{contract.nome_completo}</p>
            <p>{contract.cpf}</p>
            {contract.rg && <p>RG: {contract.rg}</p>}
            <p>{contract.endereco}</p>
            <p>{contract.telefone}</p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground">Valores</p>
            <p>Total: R$ {contract.valor_total.toLocaleString("pt-BR")}</p>
            <p>Serviço vestir: R$ {contract.valor_servico_vestir}/h</p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground">Datas</p>
            <p>Contrato: {formatDate(contract.data_contrato)}</p>
            <p>Prova final: {formatDate(contract.prova_final_data)}</p>
            <p>
              Revisão: {formatDate(contract.semana_revisao_inicio)} a{" "}
              {formatDate(contract.semana_revisao_fim)}
            </p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground">Especificações</p>
            <p className="whitespace-pre-wrap">{contract.especificacoes}</p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground">Tecidos</p>
            <p className="whitespace-pre-wrap">{contract.tecidos}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview do contrato</CardTitle>
          <CardDescription>
            Visualize o PDF abaixo ou abra em nova aba
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-muted/30 overflow-hidden">
            <iframe
              src={previewUrl}
              title="Preview do contrato"
              className="w-full h-[400px] min-h-[300px]"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
