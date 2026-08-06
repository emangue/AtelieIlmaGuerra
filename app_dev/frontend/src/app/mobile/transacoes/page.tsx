"use client";

/**
 * Transações — conferência do faturamento e do lucro do mês.
 *
 * Lista a base de pagamentos com totais que fecham exatamente com a tela de
 * Plano. Duas situações quebram essa igualdade e por isso ganham grupo próprio
 * em vez de sumirem: itens do plano sem lançamento (vieram da planilha) e
 * lançamentos que existem mas o plano não soma (pedido sem tipo, por exemplo).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Receipt, Search, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { addMes, hojeAnomes, labelMes, todayLocalISO } from "@/lib/date-utils";
import { formatMoney } from "@/lib/money";

// ── Contratos do backend ────────────────────────────────────────────────────

interface PagamentoItem {
  id: number;
  tipo: "receita" | "despesa";
  origem: string;
  natureza: string;
  subtipo_financeiro: string | null;
  descricao: string;
  categoria: string;
  tipo_item: string | null;
  detalhe: string | null;
  cat_raw: string | null;
  valor: number;
  data: string;
  icon_key: string;
  pedido_id: number | null;
  plano_item_id: number | null;
  status: string | null;
  conta_no_plano: boolean | null;
  motivo_fora: string | null;
  tipo_pedido: string | null;
  parcela_numero: number | null;
  parcela_total: number | null;
  forma_pagamento: string | null;
  data_pagamento: string | null;
  data_vencimento: string | null;
}

interface LinhaSemLancamento {
  plano_item_id: number;
  anomes: string;
  tipo: "receita" | "despesa";
  categoria: string;
  tipo_item: string;
  detalhe: string | null;
  valor: number;
  valor_planejado: number;
  icon_key: string;
}

interface Totais {
  receitas: number;
  receitas_lancadas: number;
  receitas_sem_lancamento: number;
  despesas_operacionais: number;
  despesas_operacionais_lancadas: number;
  despesas_operacionais_sem_lancamento: number;
  despesas_financeiras: number;
  despesas_financeiras_credito: number;
  despesas_financeiras_debito: number;
  despesas_financeiras_pix: number;
  despesas: number;
  lucro: number;
  fora_do_plano_receitas: number;
  fora_do_plano_despesas: number;
  count_fora_do_plano: number;
}

interface PagamentosResponse {
  mes: string;
  itens: PagamentoItem[];
  sem_lancamento: LinhaSemLancamento[];
  totais: Totais | null;
}

type Filtro = "tudo" | "receitas" | "despesas";

const MOTIVO_LABEL: Record<string, string> = {
  pedido_sem_tipo: "Pedido sem tipo definido",
  sem_pedido: "Receita sem pedido vinculado",
  pedido_inexistente: "Pedido não encontrado",
  sem_plano_item: "Despesa sem item do plano",
  plano_item_outro_mes: "Item do plano de outro mês",
  financeira_sem_classificacao: "Custo financeiro sem classificação",
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  previsto: { label: "previsto", cls: "bg-sky-50 text-sky-700" },
  em_atraso: { label: "em atraso", cls: "bg-rose-50 text-rose-700" },
  aguardando: { label: "aguardando", cls: "bg-gray-100 text-gray-600" },
};

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function labelDia(iso: string): string {
  if (!iso) return "SEM DATA";
  const hoje = todayLocalISO();
  const ontem = new Date(Date.now() - 86400000);
  const ontemIso = `${ontem.getFullYear()}-${String(ontem.getMonth() + 1).padStart(2, "0")}-${String(ontem.getDate()).padStart(2, "0")}`;
  if (iso === hoje) return "HOJE";
  if (iso === ontemIso) return "ONTEM";
  // Meio-dia evita o escorregão de fuso que jogaria a data para o dia anterior.
  const d = new Date(`${iso}T12:00:00`);
  return `${String(d.getDate()).padStart(2, "0")} ${DIAS[d.getDay()]}`.toUpperCase();
}

function corDaLinha(item: PagamentoItem): string {
  if (item.tipo === "receita") return "#059669";
  if (item.natureza === "despesa_financeira") return "#d97706";
  return "#e11d48";
}

function subtitulo(item: PagamentoItem): string {
  const partes = [
    item.tipo_pedido,
    item.forma_pagamento,
    item.parcela_numero && item.parcela_total ? `p.${item.parcela_numero}/${item.parcela_total}` : null,
    item.tipo === "despesa" ? item.cat_raw : null,
  ].filter(Boolean);
  return partes.join(" · ");
}

// ── Blocos ──────────────────────────────────────────────────────────────────

function LinhaResumo({
  label,
  valor,
  cor,
  onClick,
  ativo,
}: {
  label: string;
  valor: number;
  cor: string;
  onClick?: () => void;
  ativo?: boolean;
}) {
  const conteudo = (
    <>
      <span className="text-[13px] text-gray-600">{label}</span>
      <span className={`font-mono text-sm font-medium tabular-nums ${cor}`}>{formatMoney(valor)}</span>
    </>
  );
  if (!onClick) {
    return <div className="flex items-center justify-between px-4 py-3">{conteudo}</div>;
  }
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors ${
        ativo ? "bg-gray-50" : "hover:bg-gray-50"
      }`}
      aria-pressed={ativo}
    >
      {conteudo}
    </button>
  );
}

function Subresumo({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="flex items-center justify-between py-1 pl-8 pr-4">
      <span className="text-[11px] text-gray-400">↳ {label}</span>
      <span className="font-mono text-[11px] tabular-nums text-gray-500">{formatMoney(valor)}</span>
    </div>
  );
}

function GrupoAviso({
  cor,
  titulo,
  explicacao,
  count,
  subtotal,
  aberto,
  onToggle,
  children,
}: {
  cor: "amber" | "rose";
  titulo: string;
  explicacao: string;
  count: number;
  subtotal: number;
  aberto: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const c =
    cor === "amber"
      ? { borda: "border-amber-200", fundo: "bg-amber-50/60", texto: "text-amber-800", fraco: "text-amber-700" }
      : { borda: "border-rose-200", fundo: "bg-rose-50/60", texto: "text-rose-800", fraco: "text-rose-700" };

  return (
    <div className={`mb-4 overflow-hidden rounded-2xl border ${c.borda} ${c.fundo}`}>
      <button onClick={onToggle} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <AlertTriangle className={`h-4 w-4 shrink-0 ${c.fraco}`} />
        <span className={`text-[11px] font-semibold uppercase tracking-wider ${c.texto}`}>{titulo}</span>
        <span className={`rounded-full bg-white/70 px-2 py-0.5 text-[11px] ${c.fraco}`}>{count}</span>
        <span className={`ml-auto font-mono text-sm font-medium tabular-nums ${c.texto}`}>
          {formatMoney(subtotal)}
        </span>
        <span className={`text-[11px] ${c.fraco}`}>{aberto ? "▲" : "▼"}</span>
      </button>
      {aberto && (
        <div className="px-2 pb-2">
          {children}
          <p className={`px-2 pb-1 pt-2 text-[11px] leading-relaxed ${c.fraco}`}>{explicacao}</p>
        </div>
      )}
    </div>
  );
}

function CardPagamento({ item, onClick }: { item: PagamentoItem; onClick: () => void }) {
  const badge = item.status ? STATUS_BADGE[item.status] : undefined;
  const sub = subtitulo(item);
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
    >
      <span className="h-10 w-[3px] shrink-0 rounded-full" style={{ backgroundColor: corDaLinha(item) }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[15px] font-medium text-gray-900">
            {item.descricao || item.categoria}
          </p>
          {badge && (
            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${badge.cls}`}>{badge.label}</span>
          )}
        </div>
        {sub && <p className="truncate font-mono text-[12px] text-gray-500">{sub}</p>}
      </div>
      <span
        className={`shrink-0 font-mono text-sm font-medium tabular-nums ${
          item.tipo === "receita" ? "text-emerald-700" : "text-gray-900"
        }`}
      >
        {formatMoney(item.valor)}
      </span>
    </button>
  );
}

function SheetDetalhe({
  item,
  plano,
  onClose,
}: {
  item: PagamentoItem | null;
  plano: LinhaSemLancamento | null;
  onClose: () => void;
}) {
  if (!item && !plano) return null;

  const linhas: Array<[string, string | null]> = item
    ? [
        ["Tipo", item.tipo === "receita" ? "Receita" : "Despesa"],
        ["Natureza", item.natureza?.replace(/_/g, " ") ?? null],
        ["Origem", item.origem?.replace(/_/g, " ") ?? null],
        ["Categoria", item.categoria],
        ["Item do plano", item.tipo_item],
        ["Forma", item.forma_pagamento],
        [
          "Parcela",
          item.parcela_numero && item.parcela_total
            ? `${item.parcela_numero} de ${item.parcela_total}`
            : null,
        ],
        ["Vencimento", item.data_vencimento],
        ["Pagamento", item.data_pagamento],
        [
          "Conta no Plano",
          item.conta_no_plano === false
            ? `Não — ${MOTIVO_LABEL[item.motivo_fora ?? ""] ?? item.motivo_fora}`
            : "Sim",
        ],
        ["ID", String(item.id)],
      ]
    : [
        ["Tipo", plano!.tipo === "receita" ? "Receita" : "Despesa"],
        ["Categoria", plano!.categoria],
        ["Item do plano", plano!.tipo_item],
        ["Detalhe", plano!.detalhe],
        ["Planejado", formatMoney(plano!.valor_planejado)],
        ["Lançamento", "Nenhum — valor veio da planilha do plano"],
      ];

  const titulo = item ? item.descricao || item.categoria : `${plano!.tipo_item}${plano!.detalhe ? ` · ${plano!.detalhe}` : ""}`;
  const valor = item ? item.valor : plano!.valor;
  const data = item ? item.data : null;
  const badge = item?.status ? STATUS_BADGE[item.status] : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-2xl bg-white p-6 pb-safe"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "80vh", overflowY: "auto" }}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[17px] font-semibold text-gray-900">{titulo}</p>
            <div className="mt-1 flex items-center gap-2">
              {data && <span className="font-mono text-[12px] text-gray-500">{labelDia(data)}</span>}
              {badge && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${badge.cls}`}>{badge.label}</span>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-mono text-lg font-semibold tabular-nums text-gray-900">
              {formatMoney(valor)}
            </span>
            <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100" aria-label="Fechar">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
          {linhas
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt className="text-gray-400">{k}</dt>
                <dd className="text-gray-900">{v}</dd>
              </div>
            ))}
        </dl>

        <div className="mt-6">
          {item?.pedido_id ? (
            <Link
              href={`/mobile/pedidos/${item.pedido_id}?from=transacoes`}
              className="block w-full rounded-xl border border-gray-300 py-2.5 text-center text-sm font-medium text-gray-700"
            >
              Abrir pedido
            </Link>
          ) : (
            <Link
              href="/mobile/plano"
              className="block w-full rounded-xl border border-gray-300 py-2.5 text-center text-sm font-medium text-gray-700"
            >
              Abrir no Plano
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tela ────────────────────────────────────────────────────────────────────

export default function TransacoesPage() {
  const [mes, setMes] = useState(hojeAnomes);
  const [data, setData] = useState<PagamentosResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("tudo");
  const [busca, setBusca] = useState("");
  const [detalhe, setDetalhe] = useState<PagamentoItem | null>(null);
  const [detalhePlano, setDetalhePlano] = useState<LinhaSemLancamento | null>(null);
  const [semLancamentoAberto, setSemLancamentoAberto] = useState(true);
  const [foraDoPlanoAberto, setForaDoPlanoAberto] = useState(true);

  const carregar = useCallback(() => {
    setLoading(true);
    setErro(null);
    api
      .get<PagamentosResponse>(`/api/v1/pagamentos?mes=${mes}`)
      .then(setData)
      .catch((e) => {
        setData(null);
        setErro(e instanceof Error ? e.message : "Não foi possível carregar.");
      })
      .finally(() => setLoading(false));
  }, [mes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const t = data?.totais ?? null;
  const termo = busca.trim().toLowerCase();

  const casaFiltro = useCallback(
    (tipo: "receita" | "despesa") =>
      filtro === "tudo" || (filtro === "receitas" ? tipo === "receita" : tipo === "despesa"),
    [filtro],
  );

  const casaBusca = useCallback(
    (...partes: Array<string | number | null>) =>
      !termo || partes.filter(Boolean).join(" ").toLowerCase().includes(termo),
    [termo],
  );

  const visiveis = useMemo(
    () =>
      (data?.itens ?? []).filter(
        (i) =>
          casaFiltro(i.tipo) &&
          casaBusca(i.descricao, i.categoria, i.tipo_item, i.tipo_pedido, i.valor),
      ),
    [data, casaFiltro, casaBusca],
  );

  const foraDoPlano = useMemo(() => visiveis.filter((i) => i.conta_no_plano === false), [visiveis]);
  const naLista = useMemo(() => visiveis.filter((i) => i.conta_no_plano !== false), [visiveis]);

  const semLancamento = useMemo(
    () =>
      (data?.sem_lancamento ?? []).filter(
        (s) => casaFiltro(s.tipo) && casaBusca(s.categoria, s.tipo_item, s.detalhe, s.valor),
      ),
    [data, casaFiltro, casaBusca],
  );

  // Agrupamento por dia. Linhas sem data ou de outro mês vão para um grupo fixo
  // no topo — senão sumiriam no fim da lista e ninguém as conferiria.
  const grupos = useMemo(() => {
    const mapa = new Map<string, PagamentoItem[]>();
    for (const item of naLista) {
      const doMes = item.data && item.data.slice(0, 4) + item.data.slice(5, 7) === mes;
      const chave = doMes ? item.data : "";
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(item);
    }
    const comData = [...mapa.entries()].filter(([k]) => k).sort((a, b) => b[0].localeCompare(a[0]));
    const semData = mapa.get("");
    return semData ? [["", semData] as [string, PagamentoItem[]], ...comData] : comData;
  }, [naLista, mes]);

  const somaSemLancamento = semLancamento.reduce((s, i) => s + i.valor, 0);
  const somaForaDoPlano = foraDoPlano.reduce((s, i) => s + i.valor, 0);
  const vazio = !loading && !erro && grupos.length === 0 && !semLancamento.length && !foraDoPlano.length;

  return (
    <div className="pb-24">
      {/* Cabeçalho fixo abaixo do header global (h-14) */}
      <div className="sticky top-14 z-40 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Transações</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMes((m) => addMes(m, -1))}
              aria-label="Mês anterior"
              className="rounded-lg border border-gray-200 bg-gray-50 p-1.5 text-gray-500 hover:bg-gray-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[80px] text-center text-sm font-medium text-gray-700">{labelMes(mes)}</span>
            <button
              onClick={() => setMes((m) => addMes(m, 1))}
              aria-label="Próximo mês"
              className="rounded-lg border border-gray-200 bg-gray-50 p-1.5 text-gray-500 hover:bg-gray-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          {(["tudo", "receitas", "despesas"] as Filtro[]).map((f) => {
            const labels: Record<Filtro, string> = { tudo: "Tudo", receitas: "Receitas", despesas: "Despesas" };
            const ativo = filtro === f;
            return (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  ativo
                    ? "border-emerald-600 bg-emerald-50 font-medium text-emerald-800"
                    : "border-gray-300 text-gray-600"
                }`}
              >
                {labels[f]}
              </button>
            );
          })}
        </div>

        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Buscar descrição, item, valor..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar transações"
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca("")}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-gray-300" />
          </div>
        ) : erro ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm text-rose-700">{erro}</p>
            <button
              onClick={carregar}
              className="mt-3 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700"
            >
              Tentar de novo
            </button>
          </div>
        ) : (
          <>
            {/* Resumo — os números que têm que bater com a tela de Plano */}
            <div className="mb-4 divide-y divide-gray-100 rounded-2xl border border-gray-200">
              <LinhaResumo
                label="Entradas"
                valor={t?.receitas ?? 0}
                cor="text-emerald-700"
                ativo={filtro === "receitas"}
                onClick={() => setFiltro((f) => (f === "receitas" ? "tudo" : "receitas"))}
              />
              <div>
                <LinhaResumo
                  label="Saídas"
                  valor={t?.despesas ?? 0}
                  cor="text-rose-700"
                  ativo={filtro === "despesas"}
                  onClick={() => setFiltro((f) => (f === "despesas" ? "tudo" : "despesas"))}
                />
                {!!t?.despesas_operacionais_sem_lancamento && (
                  <Subresumo label="Sem lançamento (do plano)" valor={t.despesas_operacionais_sem_lancamento} />
                )}
                {!!t?.despesas_financeiras && (
                  <Subresumo label="Custos financeiros" valor={t.despesas_financeiras} />
                )}
                <div className="h-2" />
              </div>
              <LinhaResumo
                label="Lucro"
                valor={t?.lucro ?? 0}
                cor={(t?.lucro ?? 0) < 0 ? "text-rose-700" : "text-gray-900"}
              />
            </div>

            {!!semLancamento.length && (
              <GrupoAviso
                cor="amber"
                titulo="Sem lançamento (do plano)"
                explicacao="Valores que vieram da planilha do plano e ainda não têm um lançamento correspondente. Entram no total do mês."
                count={semLancamento.length}
                subtotal={somaSemLancamento}
                aberto={semLancamentoAberto}
                onToggle={() => setSemLancamentoAberto((v) => !v)}
              >
                {semLancamento.map((s) => (
                  <button
                    key={s.plano_item_id}
                    onClick={() => {
                      setDetalhePlano(s);
                      setDetalhe(null);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/60"
                  >
                    <span className="h-8 w-[3px] shrink-0 rounded-full bg-amber-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-gray-900">{s.tipo_item}</p>
                      {s.detalhe && <p className="truncate text-[12px] text-gray-500">{s.detalhe}</p>}
                    </div>
                    <span className="shrink-0 font-mono text-sm tabular-nums text-gray-900">
                      {formatMoney(s.valor)}
                    </span>
                  </button>
                ))}
              </GrupoAviso>
            )}

            {!!foraDoPlano.length && (
              <GrupoAviso
                cor="rose"
                titulo="Não entra no plano"
                explicacao="Lançamentos que existem em pagamentos mas o Plano não soma. Verificar o cadastro."
                count={foraDoPlano.length}
                subtotal={somaForaDoPlano}
                aberto={foraDoPlanoAberto}
                onToggle={() => setForaDoPlanoAberto((v) => !v)}
              >
                {foraDoPlano.map((i) => (
                  <button
                    key={i.id}
                    onClick={() => {
                      setDetalhe(i);
                      setDetalhePlano(null);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/60"
                  >
                    <span className="h-8 w-[3px] shrink-0 rounded-full bg-rose-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-gray-900">{i.descricao || i.categoria}</p>
                      <p className="truncate text-[12px] text-gray-500">
                        {MOTIVO_LABEL[i.motivo_fora ?? ""] ?? i.motivo_fora}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-sm tabular-nums text-gray-900">
                      {formatMoney(i.valor)}
                    </span>
                  </button>
                ))}
              </GrupoAviso>
            )}

            {vazio ? (
              <div className="rounded-xl border border-gray-100 bg-gray-50 py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <Receipt className="h-5 w-5 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700">Nenhuma transação neste mês</p>
                <p className="mt-1 text-xs text-gray-500">Troque o mês ou limpe os filtros.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-gray-200">
                {grupos.map(([dia, itens], idx) => (
                  <div key={dia || "sem-data"} className={idx > 0 ? "border-t border-gray-200" : ""}>
                    <div className="flex items-baseline justify-between bg-gray-50 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-gray-500">
                      <span>{dia ? labelDia(dia) : "Sem data / fora do mês"}</span>
                      <span className="font-mono tabular-nums text-gray-700">
                        {formatMoney(itens.reduce((s, i) => s + (i.tipo === "receita" ? i.valor : -i.valor), 0))}
                      </span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {itens.map((i) => (
                        <CardPagamento
                          key={i.id}
                          item={i}
                          onClick={() => {
                            setDetalhe(i);
                            setDetalhePlano(null);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <SheetDetalhe
        item={detalhe}
        plano={detalhePlano}
        onClose={() => {
          setDetalhe(null);
          setDetalhePlano(null);
        }}
      />
    </div>
  );
}
