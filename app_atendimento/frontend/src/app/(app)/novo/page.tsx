"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import {
  AtendimentoForm,
  formularioValido,
  montarPayload,
  valoresIniciaisVazios,
  type AtendimentoFormValores,
} from "@/components/atendimento/atendimento-form";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { MEDIDAS_CAMPOS } from "@/lib/medidas";
import type { AtendimentoDetail } from "@/lib/types";

function NovoAtendimentoConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clienteIdParam = searchParams.get("clienteId");

  const [valores, setValores] = useState<AtendimentoFormValores>(() =>
    valoresIniciaisVazios(clienteIdParam ? Number(clienteIdParam) : null)
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Veio de "nova cliente" ou da ficha: puxa as medidas já salvas.
  useEffect(() => {
    if (!clienteIdParam) return;
    let ativo = true;
    api
      .get<Record<string, unknown>>(`/api/v1/clientes/${clienteIdParam}`)
      .then((c) => {
        if (!ativo) return;
        const medidas: Record<string, number> = {};
        MEDIDAS_CAMPOS.forEach(({ key }) => {
          const v = c[key];
          if (typeof v === "number" && v > 0) medidas[key] = v;
        });
        if (Object.keys(medidas).length > 0) {
          setValores((atual) => ({ ...atual, medidas, medidas_disponiveis: true }));
        }
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [clienteIdParam]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const criado = await api.post<AtendimentoDetail>("/api/v1/atendimentos", montarPayload(valores));
      router.push(`/enviados?novo=${criado.id}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar");
      setSalvando(false);
    }
  };

  const rotulo = valores.tipo === "orcamento" ? "orçamento" : "pedido";

  return (
    <form onSubmit={enviar} className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold">Novo atendimento</h1>
        <p className="text-xs text-muted-foreground">
          O {rotulo} fica aguardando a aprovação da Ilma antes de entrar na produção.
        </p>
      </div>

      {erro && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

      <AtendimentoForm valores={valores} onChange={setValores} disabled={salvando} />

      <Button type="submit" className="w-full" disabled={salvando || !formularioValido(valores)}>
        {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {salvando ? "Enviando..." : "Enviar para aprovação"}
      </Button>
      {!formularioValido(valores) && (
        <p className="text-center text-xs text-muted-foreground">
          Preencha a cliente, a data e o que ela pediu para poder enviar.
        </p>
      )}
    </form>
  );
}

export default function NovoAtendimentoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <NovoAtendimentoConteudo />
    </Suspense>
  );
}
