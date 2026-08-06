"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

import { MedidasForm, type Medidas } from "@/components/atendimento/medidas-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { MEDIDAS_CAMPOS } from "@/lib/medidas";
import type { ClienteDetail } from "@/lib/types";

export default function FichaClientePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const clienteId = Number(params.id);

  const [cliente, setCliente] = useState<ClienteDetail | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [endereco, setEndereco] = useState("");
  const [medidas, setMedidas] = useState<Medidas>({});

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    let ativo = true;
    api
      .get<ClienteDetail>(`/api/v1/clientes/${clienteId}`)
      .then((c) => {
        if (!ativo) return;
        setCliente(c);
        setNome(c.nome ?? "");
        setTelefone(c.telefone ?? "");
        setEmail(c.email ?? "");
        setEndereco((c.endereco as string) ?? "");
        const m: Medidas = {};
        MEDIDAS_CAMPOS.forEach(({ key }) => {
          const v = c[key];
          if (typeof v === "number" && v > 0) m[key] = v;
        });
        setMedidas(m);
      })
      .catch((err) => ativo && setErro(err instanceof Error ? err.message : "Erro ao carregar"))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [clienteId]);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSalvo(false);
    setSalvando(true);
    try {
      const temMedida = MEDIDAS_CAMPOS.some(({ key }) => (medidas[key] ?? 0) > 0);
      const payload: Record<string, unknown> = {
        nome: nome.trim(),
        telefone: telefone.trim() || null,
        email: email.trim() || null,
        endereco: endereco.trim() || null,
        flag_medidas: temMedida,
      };
      // Medida em branco vira null: "não tirei" é diferente de "mediu zero".
      MEDIDAS_CAMPOS.forEach(({ key }) => {
        payload[key] = medidas[key] ?? null;
      });
      await api.patch(`/api/v1/clientes/${clienteId}`, payload);
      setSalvo(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar");
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="space-y-4">
        <Link href="/clientes" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          Clientes
        </Link>
        <p className="text-sm text-red-700">{erro || "Cliente não encontrada."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/clientes" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" />
        Clientes
      </Link>
      <h1 className="text-lg font-semibold">{cliente.nome}</h1>

      <form onSubmit={salvar} className="space-y-5">
        {erro && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
        {salvo && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">Alterações salvas.</p>}

        <section className="space-y-3">
          <h2 className="text-sm font-medium">Contato</h2>
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input id="telefone" type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Input id="endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-medium">Medidas salvas (cm)</h2>
            <p className="text-xs text-muted-foreground">
              Ficam guardadas na ficha e já vêm preenchidas no próximo pedido.
            </p>
          </div>
          <MedidasForm medidas={medidas} onChange={setMedidas} />
        </section>

        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={salvando || !nome.trim()}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {salvando ? "Salvando..." : "Salvar alterações"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/novo?clienteId=${clienteId}`)}
          >
            Novo pedido
          </Button>
        </div>
      </form>
    </div>
  );
}
