"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, X } from "lucide-react";

import { PedidoConfirmacaoAtipica } from "@/components/mobile/pedido-confirmacao-atipica";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { calcularMargem, type AvisoPedido } from "@/lib/margem-pedido";

const MEDIDAS_CAMPOS: { key: string; label: string }[] = [
  { key: "medida_ombro", label: "Ombro" },
  { key: "medida_busto", label: "Busto" },
  { key: "medida_cinto", label: "Cinto" },
  { key: "medida_quadril", label: "Quadril" },
  { key: "medida_comprimento_corpo", label: "Compr. corpo" },
  { key: "medida_comprimento_vestido", label: "Compr. vestido" },
  { key: "medida_distancia_busto", label: "Distância de busto" },
  { key: "medida_raio_busto", label: "Raio busto" },
  { key: "medida_altura_busto", label: "Altura busto" },
  { key: "medida_frente", label: "Frente" },
  { key: "medida_costado", label: "Costado" },
  { key: "medida_comprimento_calca", label: "Compr. calça" },
  { key: "medida_comprimento_blusa", label: "Compr. blusa" },
  { key: "medida_largura_manga", label: "Larg. manga" },
  { key: "medida_comprimento_manga", label: "Compr. manga" },
  { key: "medida_punho", label: "Punho" },
  { key: "medida_comprimento_saia", label: "Compr. saia" },
  { key: "medida_comprimento_bermuda", label: "Compr. bermuda" },
];

const STATUS_OPCOES = ["Orçamento", "Encomenda", "Cortado", "Provado", "Pronto", "Entregue"];

interface AtendimentoDetail {
  id: number;
  tipo: "pedido" | "orcamento";
  cliente_id: number;
  cliente_nome: string;
  tipo_pedido_id: number | null;
  tipo_pedido_nome: string | null;
  forma_peca_id: number | null;
  forma_peca_nome: string | null;
  descricao_produto: string;
  data_pedido: string;
  data_entrega: string | null;
  quantidade_pecas: number | null;
  valor_combinado: number | null;
  status_aprovacao: "pendente" | "aprovado" | "recusado";
  motivo_recusa: string | null;
  pedido_id: number | null;
  criado_por_nome: string;
  criado_em: string | null;
  revisado_por_nome: string | null;
  observacao_atendimento: string | null;
  medidas_disponiveis: boolean | null;
  comentario_medidas: string | null;
  foto_url: string | null;
  foto_url_2: string | null;
  foto_url_3: string | null;
  comentario_foto_1: string | null;
  comentario_foto_2: string | null;
  comentario_foto_3: string | null;
  [medida: string]: unknown;
}

interface Parametros {
  preco_hora: number;
  impostos: number;
  cartao_credito: number;
}

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : "—";
}

function formatarMoeda(v: number | null | undefined): string {
  return v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-gray-500">{rotulo}</p>
      <p className="text-sm text-gray-900">{valor || "—"}</p>
    </div>
  );
}

export default function RevisarAtendimentoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const atendimentoId = Number(params.id);

  const [detalhe, setDetalhe] = useState<AtendimentoDetail | null>(null);
  const [parametros, setParametros] = useState<Parametros | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Campos que só a Ilma preenche.
  const [valorPecas, setValorPecas] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [horas, setHoras] = useState("");
  const [custoMateriais, setCustoMateriais] = useState("");
  const [custosVariaveis, setCustosVariaveis] = useState("");
  const [status, setStatus] = useState("Encomenda");
  const [dataEntrega, setDataEntrega] = useState("");

  const [avisos, setAvisos] = useState<AvisoPedido[]>([]);
  const [confirmadoAtipico, setConfirmadoAtipico] = useState(false);
  const [aprovando, setAprovando] = useState(false);

  const [mostrarRecusa, setMostrarRecusa] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [recusando, setRecusando] = useState(false);

  useEffect(() => {
    let ativo = true;
    Promise.all([
      api.get<AtendimentoDetail>(`/api/v1/atendimentos/${atendimentoId}`),
      // Sem parâmetros a margem não é calculável; caímos nos defaults do ateliê.
      api.get<Partial<Parametros>>("/api/v1/parametros").catch(() => ({}) as Partial<Parametros>),
    ])
      .then(([d, p]) => {
        if (!ativo) return;
        setDetalhe(d);
        setValorPecas(d.valor_combinado != null ? String(d.valor_combinado) : "");
        setQuantidade(d.quantidade_pecas != null ? String(d.quantidade_pecas) : "1");
        setDataEntrega(d.data_entrega ?? "");
        setStatus(d.tipo === "orcamento" ? "Orçamento" : "Encomenda");
        setParametros({
          preco_hora: p.preco_hora ?? 50,
          impostos: p.impostos ?? 0.06,
          cartao_credito: p.cartao_credito ?? 0.03,
        });
      })
      .catch((err) => ativo && setErro(err instanceof Error ? err.message : "Erro ao carregar"))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [atendimentoId]);

  const num = (s: string) => Number(s.replace(",", ".")) || 0;

  const margem = useMemo(() => {
    if (!parametros) return null;
    return calcularMargem(
      num(valorPecas),
      num(horas),
      num(custoMateriais),
      num(custosVariaveis),
      parametros
    );
  }, [parametros, valorPecas, horas, custoMateriais, custosVariaveis]);

  const medidasPreenchidas = useMemo(
    () =>
      detalhe
        ? MEDIDAS_CAMPOS.filter(({ key }) => typeof detalhe[key] === "number" && (detalhe[key] as number) > 0)
        : [],
    [detalhe]
  );

  const fotos = useMemo(() => {
    if (!detalhe) return [];
    return [
      { url: detalhe.foto_url, comentario: detalhe.comentario_foto_1 },
      { url: detalhe.foto_url_2, comentario: detalhe.comentario_foto_2 },
      { url: detalhe.foto_url_3, comentario: detalhe.comentario_foto_3 },
    ].filter((f) => f.url);
  }, [detalhe]);

  const aprovar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detalhe) return;
    setErro(null);
    setAprovando(true);

    const payload: Record<string, unknown> = {
      cliente_id: detalhe.cliente_id, // o backend sobrescreve com o do registro
      tipo_pedido_id: detalhe.tipo_pedido_id,
      forma_peca_id: detalhe.forma_peca_id,
      data_pedido: detalhe.data_pedido,
      data_entrega: dataEntrega || null,
      descricao_produto: detalhe.descricao_produto,
      status,
      valor_pecas: valorPecas ? num(valorPecas) : null,
      quantidade_pecas: quantidade ? Number(quantidade) : null,
      horas_trabalho: horas ? num(horas) : null,
      custo_materiais: custoMateriais ? num(custoMateriais) : null,
      custos_variaveis: custosVariaveis ? num(custosVariaveis) : null,
      confirmado_atipico: confirmadoAtipico,
      medidas_disponiveis: detalhe.medidas_disponiveis,
      comentario_medidas: detalhe.comentario_medidas,
      fotos_disponiveis: fotos.length > 0,
      foto_url: detalhe.foto_url,
      foto_url_2: detalhe.foto_url_2,
      foto_url_3: detalhe.foto_url_3,
      comentario_foto_1: detalhe.comentario_foto_1,
      comentario_foto_2: detalhe.comentario_foto_2,
      comentario_foto_3: detalhe.comentario_foto_3,
      observacao_pedido: detalhe.observacao_atendimento,
    };
    MEDIDAS_CAMPOS.forEach(({ key }) => {
      const v = detalhe[key];
      if (typeof v === "number" && v > 0) payload[key] = v;
    });

    try {
      const res = await api.fetch(`/api/v1/atendimentos/${atendimentoId}/aprovar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 422) {
        // Valores fora do padrão: o backend pede confirmação explícita.
        const body = await res.json().catch(() => null);
        const detail = body?.detail;
        if (detail?.code === "pedido_atipico") {
          setAvisos(detail.avisos ?? []);
          setConfirmadoAtipico(true);
          setAprovando(false);
          return;
        }
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Não foi possível aprovar (HTTP ${res.status})`
        );
      }
      const { pedido_id } = (await res.json()) as { pedido_id: number };
      router.push(`/mobile/pedidos/${pedido_id}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível aprovar");
      setAprovando(false);
    }
  };

  const recusar = async () => {
    setErro(null);
    setRecusando(true);
    try {
      await api.post(`/api/v1/atendimentos/${atendimentoId}/recusar`, { motivo: motivo.trim() });
      router.push("/mobile/atendimento");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível recusar");
      setRecusando(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!detalhe) {
    return (
      <div className="space-y-4 p-4">
        <Link href="/mobile/atendimento" className="inline-flex items-center gap-1 text-sm text-gray-500">
          <ArrowLeft className="h-4 w-4" />
          Atendimento
        </Link>
        <p className="text-sm text-red-700">{erro || "Registro não encontrado."}</p>
      </div>
    );
  }

  const pendente = detalhe.status_aprovacao === "pendente";

  return (
    <div className="space-y-5 p-4">
      <Link href="/mobile/atendimento" className="inline-flex items-center gap-1 text-sm text-gray-500">
        <ArrowLeft className="h-4 w-4" />
        Atendimento
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-gray-900">{detalhe.cliente_nome}</h1>
        <p className="text-xs text-gray-500">
          {detalhe.tipo === "orcamento" ? "Orçamento" : "Pedido"} registrado por {detalhe.criado_por_nome}
        </p>
      </div>

      {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

      {detalhe.status_aprovacao === "aprovado" && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          Já aprovado{detalhe.pedido_id ? ` — virou o pedido #${detalhe.pedido_id}` : ""}.{" "}
          {detalhe.pedido_id && (
            <Link href={`/mobile/pedidos/${detalhe.pedido_id}`} className="underline">
              Abrir pedido
            </Link>
          )}
        </p>
      )}
      {detalhe.status_aprovacao === "recusado" && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Recusado por {detalhe.revisado_por_nome || "você"}: {detalhe.motivo_recusa}
        </p>
      )}

      {/* O que veio do balcão */}
      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-medium text-gray-900">O que veio do atendimento</h2>
        <Campo rotulo="Pedido da cliente" valor={detalhe.descricao_produto} />
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Tipo de peça" valor={detalhe.tipo_pedido_nome} />
          <Campo rotulo="Forma da peça" valor={detalhe.forma_peca_nome} />
          <Campo rotulo="Data do atendimento" valor={formatarData(detalhe.data_pedido)} />
          <Campo rotulo="Entrega combinada" valor={formatarData(detalhe.data_entrega)} />
          <Campo rotulo="Quantidade" valor={detalhe.quantidade_pecas} />
          <Campo rotulo="Valor conversado" valor={formatarMoeda(detalhe.valor_combinado)} />
        </div>
        {detalhe.observacao_atendimento && (
          <Campo rotulo="Observações" valor={detalhe.observacao_atendimento} />
        )}

        {medidasPreenchidas.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] text-gray-500">Medidas (cm)</p>
            <div className="grid grid-cols-3 gap-2">
              {medidasPreenchidas.map(({ key, label }) => (
                <div key={key} className="rounded-lg bg-gray-50 px-2 py-1.5">
                  <p className="text-[10px] text-gray-500">{label}</p>
                  <p className="text-sm text-gray-900">{detalhe[key] as number}</p>
                </div>
              ))}
            </div>
            {detalhe.comentario_medidas && (
              <p className="text-xs text-gray-600">{detalhe.comentario_medidas}</p>
            )}
          </div>
        )}

        {fotos.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] text-gray-500">Fotos</p>
            <div className="grid grid-cols-3 gap-2">
              {fotos.map((f, i) => (
                <div key={i} className="space-y-1">
                  <div className="relative aspect-square overflow-hidden rounded-lg border border-gray-200">
                    <Image
                      src={f.url as string}
                      alt={`Foto ${i + 1}`}
                      fill
                      sizes="33vw"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  {f.comentario && <p className="text-[10px] text-gray-500">{f.comentario}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Completar e aprovar */}
      {pendente && (
        <form onSubmit={aprovar} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
          <div>
            <h2 className="text-sm font-medium text-gray-900">Complete para aprovar</h2>
            <p className="text-xs text-gray-500">
              Ao aprovar, nasce um pedido novo com estes valores e a margem calculada.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="valor">Valor final (R$)</Label>
              <Input
                id="valor"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={valorPecas}
                onChange={(e) => setValorPecas(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="quantidade">Quantidade</Label>
              <Input
                id="quantidade"
                type="number"
                inputMode="numeric"
                min="0"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="horas">Horas de trabalho</Label>
              <Input
                id="horas"
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                value={horas}
                onChange={(e) => setHoras(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="materiais">Custo materiais (R$)</Label>
              <Input
                id="materiais"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={custoMateriais}
                onChange={(e) => setCustoMateriais(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="variaveis">Custos variáveis (R$)</Label>
              <Input
                id="variaveis"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={custosVariaveis}
                onChange={(e) => setCustosVariaveis(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="entrega">Entrega</Label>
              <Input
                id="entrega"
                type="date"
                value={dataEntrega}
                onChange={(e) => setDataEntrega(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="status">Status inicial</Label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
            >
              {STATUS_OPCOES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {margem && (
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-gray-500">Margem real</span>
                <span
                  className={`text-lg font-semibold ${
                    margem.margemReal < 20 ? "text-red-600" : "text-emerald-700"
                  }`}
                >
                  {margem.margemReal.toFixed(1)}%
                </span>
              </div>
              <p className="mt-1 text-[11px] text-gray-500">
                Custo total {formatarMoeda(margem.custoTotal)} · sugeridos:{" "}
                {formatarMoeda(margem.valorMargem20)} (20%) ·{" "}
                {formatarMoeda(margem.valorMargem30)} (30%) ·{" "}
                {formatarMoeda(margem.valorMargem40)} (40%)
              </p>
            </div>
          )}

          <PedidoConfirmacaoAtipica avisos={avisos} />

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={aprovando}>
              {aprovando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              {avisos.length > 0 ? "Confirmar e aprovar" : "Aprovar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMostrarRecusa((v) => !v)}
              disabled={aprovando}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </form>
      )}

      {pendente && mostrarRecusa && (
        <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="space-y-1">
            <Label htmlFor="motivo">Por que está recusando?</Label>
            <Input
              id="motivo"
              placeholder="Ex.: prazo não cabe na agenda"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
            <p className="text-[11px] text-red-700">
              O motivo aparece para quem registrou, no site de atendimento.
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            className="w-full"
            onClick={recusar}
            disabled={recusando || motivo.trim().length < 3}
          >
            {recusando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Recusar
          </Button>
        </div>
      )}
    </div>
  );
}
