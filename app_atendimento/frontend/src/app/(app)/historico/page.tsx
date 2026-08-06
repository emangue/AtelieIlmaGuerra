"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, PencilLine, PlusCircle, Trash2 } from "lucide-react";

import { api } from "@/lib/api-client";
import { formatarDataHora } from "@/lib/format";
import { LABEL_POR_MEDIDA } from "@/lib/medidas";
import type { HistoricoItem } from "@/lib/types";

const ACOES: Record<string, { rotulo: string; Icone: typeof PlusCircle; cor: string }> = {
  criou: { rotulo: "Criou", Icone: PlusCircle, cor: "text-emerald-600" },
  editou: { rotulo: "Editou", Icone: PencilLine, cor: "text-amber-600" },
  apagou: { rotulo: "Cancelou", Icone: Trash2, cor: "text-red-600" },
};

const ROTULOS_CAMPO: Record<string, string> = {
  ...LABEL_POR_MEDIDA,
  nome: "Nome",
  telefone: "Telefone",
  email: "Email",
  endereco: "Endereço",
  descricao_produto: "Descrição",
  data_entrega: "Data de entrega",
  quantidade_pecas: "Quantidade",
  valor_combinado: "Valor conversado",
  observacao_atendimento: "Observações",
  comentario_medidas: "Obs. das medidas",
  tipo: "Tipo",
  tipo_pedido_id: "Tipo de peça",
  forma_peca_id: "Forma da peça",
  medidas_disponiveis: "Tem medidas",
  fotos_disponiveis: "Tem fotos",
};

function formatarValor(v: unknown): string {
  if (v === null || v === undefined || v === "") return "vazio";
  if (typeof v === "boolean") return v ? "sim" : "não";
  return String(v);
}

function Diff({ json }: { json: string }) {
  let diff: Record<string, { de: unknown; para: unknown }>;
  try {
    diff = JSON.parse(json);
  } catch {
    return null;
  }
  const entradas = Object.entries(diff);
  if (entradas.length === 0) return null;

  return (
    <ul className="mt-1 space-y-0.5">
      {entradas.map(([campo, { de, para }]) => (
        <li key={campo} className="text-[11px] text-muted-foreground">
          <span className="font-medium">{ROTULOS_CAMPO[campo] ?? campo}:</span>{" "}
          <span className="line-through">{formatarValor(de)}</span> → {formatarValor(para)}
        </li>
      ))}
    </ul>
  );
}

export default function HistoricoPage() {
  const [itens, setItens] = useState<HistoricoItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    api
      .get<HistoricoItem[]>("/api/v1/historico?limit=100")
      .then((r) => ativo && setItens(r))
      .catch((err) => ativo && setErro(err instanceof Error ? err.message : "Erro ao carregar"))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, []);

  const linkDoItem = (h: HistoricoItem): string | null => {
    if (!h.entidade_id) return null;
    if (h.entidade === "cliente") return `/clientes/${h.entidade_id}`;
    if (h.entidade === "pedido_atendimento" && h.acao !== "apagou") return `/enviados/${h.entidade_id}`;
    return null;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Histórico</h1>
        <p className="text-xs text-muted-foreground">
          Tudo que foi feito neste site de atendimento, do mais recente para o mais antigo.
        </p>
      </div>

      {erro && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

      {carregando ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : itens.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma alteração registrada ainda.
        </p>
      ) : (
        <ul className="space-y-2">
          {itens.map((h) => {
            const acao = ACOES[h.acao] ?? { rotulo: h.acao, Icone: PencilLine, cor: "text-muted-foreground" };
            const href = linkDoItem(h);
            const conteudo = (
              <div className="flex gap-3 rounded-lg border border-border bg-card p-3">
                <acao.Icone className={`mt-0.5 h-4 w-4 shrink-0 ${acao.cor}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{h.resumo || `${acao.rotulo} ${h.entidade}`}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {h.user_nome} · {formatarDataHora(h.criado_em)}
                  </p>
                  {h.diff_json && <Diff json={h.diff_json} />}
                </div>
              </div>
            );
            return (
              <li key={h.id}>
                {href ? (
                  <Link href={href} className="block hover:opacity-80">
                    {conteudo}
                  </Link>
                ) : (
                  conteudo
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
