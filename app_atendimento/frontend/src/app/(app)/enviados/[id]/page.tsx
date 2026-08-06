"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";

import {
  AtendimentoForm,
  formularioValido,
  montarPayload,
  valoresDoDetalhe,
  type AtendimentoFormValores,
} from "@/components/atendimento/atendimento-form";
import { StatusBadge } from "@/components/atendimento/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { formatarDataHora } from "@/lib/format";
import type { AtendimentoDetail } from "@/lib/types";

export default function DetalheEnviadoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const atendimentoId = Number(params.id);

  const [detalhe, setDetalhe] = useState<AtendimentoDetail | null>(null);
  const [valores, setValores] = useState<AtendimentoFormValores | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    let ativo = true;
    api
      .get<AtendimentoDetail>(`/api/v1/atendimentos/${atendimentoId}`)
      .then((d) => {
        if (!ativo) return;
        setDetalhe(d);
        setValores(valoresDoDetalhe(d as unknown as Record<string, unknown>));
      })
      .catch((err) => ativo && setErro(err instanceof Error ? err.message : "Erro ao carregar"))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [atendimentoId]);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valores) return;
    setErro(null);
    setSalvo(false);
    setSalvando(true);
    try {
      const payload = montarPayload(valores);
      // cliente e data do atendimento não mudam depois de enviado.
      delete payload.cliente_id;
      delete payload.data_pedido;
      const atualizado = await api.patch<AtendimentoDetail>(
        `/api/v1/atendimentos/${atendimentoId}`,
        payload
      );
      setDetalhe(atualizado);
      setSalvo(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar");
    } finally {
      setSalvando(false);
    }
  };

  const cancelarEnvio = async () => {
    try {
      await api.delete(`/api/v1/atendimentos/${atendimentoId}`);
      router.push("/enviados");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível cancelar");
    }
  };

  if (carregando) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!detalhe || !valores) {
    return (
      <div className="space-y-4">
        <Link href="/enviados" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          Enviados
        </Link>
        <p className="text-sm text-red-700">{erro || "Registro não encontrado."}</p>
      </div>
    );
  }

  const editavel = detalhe.editavel;

  return (
    <div className="space-y-4">
      <Link href="/enviados" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" />
        Enviados
      </Link>

      <div className="space-y-2">
        <h1 className="text-lg font-semibold">{detalhe.cliente_nome}</h1>
        <StatusBadge status={detalhe.status_aprovacao} />
        <p className="text-xs text-muted-foreground">
          Registrado por {detalhe.criado_por_nome} em {formatarDataHora(detalhe.criado_em)}
        </p>
      </div>

      {detalhe.status_aprovacao === "recusado" && detalhe.motivo_recusa && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-medium text-red-800">Motivo da recusa</p>
          <p className="text-sm text-red-700">{detalhe.motivo_recusa}</p>
        </div>
      )}

      {detalhe.status_aprovacao === "aprovado" && (
        <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
          Aprovado pela Ilma em {formatarDataHora(detalhe.revisado_em)} e já está na produção.
        </p>
      )}

      {!editavel && (
        <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
          Este registro já foi revisado e não pode mais ser alterado.
        </p>
      )}

      <form onSubmit={salvar} className="space-y-5">
        {erro && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
        {salvo && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">Alterações salvas.</p>}

        <AtendimentoForm
          valores={valores}
          onChange={setValores}
          clienteFixo={{ id: detalhe.cliente_id, nome: detalhe.cliente_nome }}
          disabled={!editavel || salvando}
        />

        {editavel && (
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={salvando || !formularioValido(valores)}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {salvando ? "Salvando..." : "Salvar alterações"}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" size="icon" aria-label="Cancelar envio">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar este envio?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O registro some da fila de aprovação da Ilma. A cliente continua cadastrada.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction onClick={cancelarEnvio}>Cancelar envio</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </form>
    </div>
  );
}
