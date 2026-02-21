"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, Plus, Loader2, Search, Pencil } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

interface ClienteItem {
  id: number;
  nome: string;
  telefone: string | null;
  email: string | null;
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = search ? `?q=${encodeURIComponent(search)}` : "";
    fetch(`${API_URL}/api/v1/clientes${params}`)
      .then((res) => res.json())
      .then((data) => setClientes(data))
      .catch(() => setClientes([]))
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-gray-900">Clientes</h2>
        <p className="text-sm text-gray-500">
          Cadastro e busca de clientes do ateliê.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Buscar por nome, telefone ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Link href="/mobile/clientes/novo" className="block">
        <Button className="w-full" size="lg">
          <Plus className="mr-2 h-5 w-5" />
          Novo Cliente
        </Button>
      </Link>

      <div>
        <h3 className="mb-3 text-sm font-medium text-gray-500">Lista</h3>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : clientes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center text-gray-500">
            <Users className="mx-auto mb-2 h-12 w-12 opacity-50" />
            <p className="text-sm">Nenhum cliente cadastrado</p>
            <p className="mt-1 text-xs">
              Clique em &quot;Novo Cliente&quot; ou rode o script de migração do Excel
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {clientes.map((c) => (
              <Link key={c.id} href={`/mobile/clientes/${c.id}`}>
                <Card className="transition-colors hover:bg-gray-50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{c.nome}</CardTitle>
                      <Pencil className="h-4 w-4 text-gray-400" />
                    </div>
                    <CardDescription>
                      {c.telefone && <span>{c.telefone}</span>}
                      {c.telefone && c.email && " • "}
                      {c.email && <span>{c.email}</span>}
                      {!c.telefone && !c.email && "—"}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
