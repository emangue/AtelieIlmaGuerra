"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import type { ClienteDetail } from "@/lib/types";

export default function NovaClientePage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [endereco, setEndereco] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const cliente = await api.post<ClienteDetail>("/api/v1/clientes", {
        nome: nome.trim(),
        telefone: telefone.trim() || null,
        email: email.trim() || null,
        endereco: endereco.trim() || null,
      });
      // Encadeia direto no registro do pedido: é o que a pessoa vai fazer em seguida.
      router.push(`/novo?clienteId=${cliente.id}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar");
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4">
      <Link href="/clientes" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" />
        Clientes
      </Link>
      <h1 className="text-lg font-semibold">Nova cliente</h1>

      <form onSubmit={enviar} className="space-y-4">
        {erro && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

        <div className="space-y-2">
          <Label htmlFor="nome">Nome *</Label>
          <Input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            placeholder="Nome completo"
          />
          <p className="text-xs text-muted-foreground">
            O nome é a chave de busca do ateliê e não pode repetir.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="telefone">Telefone</Label>
          <Input
            id="telefone"
            type="tel"
            inputMode="tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(16) 99999-0000"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemplo.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endereco">Endereço</Label>
          <Input
            id="endereco"
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            placeholder="Rua, número, bairro"
          />
        </div>

        <Button type="submit" className="w-full" disabled={salvando || !nome.trim()}>
          {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {salvando ? "Salvando..." : "Salvar e registrar pedido"}
        </Button>
      </form>
    </div>
  );
}
