"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Search, UserRound } from "lucide-react";

import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import type { ClienteListItem } from "@/lib/types";

export default function ClientesPage() {
  const [busca, setBusca] = useState("");
  const [clientes, setClientes] = useState<ClienteListItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (q: string) => {
    setCarregando(true);
    setErro(null);
    try {
      const query = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      setClientes(await api.get<ClienteListItem[]>(`/api/v1/clientes${query}`));
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível carregar as clientes");
    } finally {
      setCarregando(false);
    }
  }, []);

  // Debounce: a lista tem centenas de clientes, não vale bater a cada tecla.
  useEffect(() => {
    const t = setTimeout(() => carregar(busca), 300);
    return () => clearTimeout(t);
  }, [busca, carregar]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Clientes</h1>
        <Link
          href="/clientes/novo"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          Nova
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome, telefone ou email"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {erro && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

      {carregando ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : clientes.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {busca.trim() ? "Nenhuma cliente encontrada." : "Nenhuma cliente cadastrada ainda."}
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {clientes.map((c) => (
            <li key={c.id}>
              <Link href={`/clientes/${c.id}`} className="flex items-center gap-3 p-3 hover:bg-muted">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.nome}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {c.telefone || c.email || "sem contato cadastrado"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
