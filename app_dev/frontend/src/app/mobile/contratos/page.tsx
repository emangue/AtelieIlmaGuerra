"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileText, FileDown, Plus, Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

interface ContractItem {
  id: number;
  nome_completo: string;
  data_contrato: string;
  created_at: string;
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDataContrato(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

export default function ContratosPage() {
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/contracts`)
      .then((res) => res.json())
      .then((data) => setContracts(data))
      .catch(() => setContracts([]))
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = async (c: ContractItem) => {
    setDownloadingId(c.id);
    try {
      const res = await fetch(`${API_URL}/api/v1/contracts/${c.id}/pdf`);
      if (!res.ok) throw new Error("Erro ao baixar");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Contrato_${c.nome_completo.replace(/\s+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Contratos</h2>
        <p className="text-sm text-muted-foreground">
          Gere novos contratos ou regenere PDFs do histórico.
        </p>
      </div>

      <Link href="/mobile/contratos/novo" className="block">
        <Button className="w-full" size="lg">
          <Plus className="mr-2 h-5 w-5" />
          Novo Contrato
        </Button>
      </Link>

      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">
          Histórico
        </h3>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : contracts.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            <FileText className="mx-auto mb-2 h-12 w-12 opacity-50" />
            <p className="text-sm">Nenhum contrato gerado ainda</p>
            <p className="mt-1 text-xs">
              Clique em &quot;Novo Contrato&quot; para começar
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {contracts.map((c) => (
              <Link key={c.id} href={`/mobile/contratos/${c.id}`}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{c.nome_completo}</CardTitle>
                    <CardDescription>
                      Contrato de {formatDataContrato(c.data_contrato)} • Gerado em{" "}
                      {formatDate(c.created_at)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={downloadingId === c.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDownload(c);
                      }}
                    >
                      {downloadingId === c.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileDown className="mr-2 h-4 w-4" />
                      )}
                      Baixar PDF
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
