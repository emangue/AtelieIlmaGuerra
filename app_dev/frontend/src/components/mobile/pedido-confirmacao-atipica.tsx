"use client";

import type { AvisoPedido } from "@/lib/margem-pedido";

interface Props {
  avisos: AvisoPedido[];
}

export function PedidoConfirmacaoAtipica({ avisos }: Props) {
  if (avisos.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-2">
      <p className="text-sm font-medium text-amber-800">
        Este pedido tem valores fora do padrão. Confirme se está correto:
      </p>
      <ul className="text-xs text-amber-700 list-disc pl-4 space-y-1">
        {avisos.map((a) => (
          <li key={a.codigo}>{a.mensagem}</li>
        ))}
      </ul>
      <p className="text-xs text-amber-700">
        Se estiver certo, clique em Salvar novamente para confirmar.
      </p>
    </div>
  );
}
