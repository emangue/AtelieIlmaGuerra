"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

interface OrcamentoDetail {
  id: number;
  cliente_nome: string;
  data: string;
  descricao: string | null;
  valor: number | null;
  status: string;
  margem_20: number | null;
  margem_30: number | null;
  margem_40: number | null;
  horas_trabalho: number | null;
  custo_materiais: number | null;
  custos_variaveis: number | null;
}

export default function OrcamentoDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const [orc, setOrc] = useState<OrcamentoDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/orcamentos/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Não encontrado");
        return res.json();
      })
      .then(setOrc)
      .catch(() => setOrc(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!orc) {
    return (
      <div className="p-4">
        <p className="text-gray-500">Orçamento não encontrado.</p>
        <Link href="/mobile/orcamentos">
          <Button variant="link" className="mt-2">
            Voltar
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div className="flex items-center gap-2">
        <Link href="/mobile/orcamentos">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-gray-900">
            {orc.cliente_nome}
          </h2>
          <p className="text-sm text-gray-500">
            {new Date(orc.data).toLocaleDateString("pt-BR")} • {orc.status}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Descrição</CardTitle>
          <CardDescription>{orc.descricao || "—"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {orc.valor != null && (
            <p>
              <span className="text-gray-500">Valor:</span>{" "}
              <span className="font-semibold">
                R$ {orc.valor.toLocaleString("pt-BR")}
              </span>
            </p>
          )}
          {(orc.margem_20 != null || orc.margem_30 != null || orc.margem_40 != null) && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Preço sugerido por margem:
              </p>
              <div className="space-y-1 text-sm">
                {orc.margem_20 != null && (
                  <p>
                    <span className="text-gray-500">20%:</span> R${" "}
                    {orc.margem_20.toLocaleString("pt-BR")}
                  </p>
                )}
                {orc.margem_30 != null && (
                  <p>
                    <span className="text-gray-500">30%:</span> R${" "}
                    {orc.margem_30.toLocaleString("pt-BR")}
                  </p>
                )}
                {orc.margem_40 != null && (
                  <p>
                    <span className="text-gray-500">40%:</span> R${" "}
                    {orc.margem_40.toLocaleString("pt-BR")}
                  </p>
                )}
              </div>
            </div>
          )}
          {(orc.horas_trabalho != null || orc.custo_materiais != null) && (
            <div className="text-sm text-gray-500 pt-2 border-t">
              <p>Horas: {orc.horas_trabalho ?? 0}</p>
              <p>Custo materiais: R$ {(orc.custo_materiais ?? 0).toLocaleString("pt-BR")}</p>
              <p>Custos variáveis: R$ {(orc.custos_variaveis ?? 0).toLocaleString("pt-BR")}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
