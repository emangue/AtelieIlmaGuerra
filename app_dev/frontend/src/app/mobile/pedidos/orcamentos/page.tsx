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
import { Receipt, Plus, Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

interface OrcamentoItem {
  id: number;
  cliente_nome: string;
  data: string;
  descricao: string | null;
  valor: number | null;
  status: string;
  margem_20: number | null;
  margem_30: number | null;
  margem_40: number | null;
}

export default function PedidosOrcamentosPage() {
  const [orcamentos, setOrcamentos] = useState<OrcamentoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/orcamentos`)
      .then((res) => res.json())
      .then(setOrcamentos)
      .catch(() => setOrcamentos([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pb-24">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-gray-900">Orçamentos ativos</h2>
        <p className="text-sm text-gray-500">
          Cotações com cálculo de Margem 20%, 30%, 40%
        </p>
      </div>

      <Link href="/mobile/orcamentos/novo" className="block">
        <Button className="w-full" size="lg">
          <Plus className="mr-2 h-5 w-5" />
          Novo Orçamento
        </Button>
      </Link>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : orcamentos.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 flex flex-col items-center justify-center min-h-[200px]">
          <Receipt className="w-12 h-12 text-gray-300 mb-4" />
          <p className="text-gray-500 text-center">
            Nenhum orçamento cadastrado
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Clique em &quot;Novo Orçamento&quot; para começar
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orcamentos.map((o) => (
            <Link key={o.id} href={`/mobile/orcamentos/${o.id}`}>
              <Card className="transition-colors hover:bg-gray-50">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{o.cliente_nome}</CardTitle>
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                      {o.status}
                    </span>
                  </div>
                  <CardDescription>
                    {new Date(o.data).toLocaleDateString("pt-BR")} •{" "}
                    {o.descricao || "—"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex gap-4 text-sm">
                    {o.valor != null && (
                      <span className="font-medium">
                        R$ {o.valor.toLocaleString("pt-BR")}
                      </span>
                    )}
                    {o.margem_20 != null && (
                      <span className="text-gray-500">
                        Margem 20%: R$ {o.margem_20.toLocaleString("pt-BR")}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
