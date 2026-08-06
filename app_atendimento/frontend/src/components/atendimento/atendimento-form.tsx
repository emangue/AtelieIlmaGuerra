"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";

import { MedidasForm, type Medidas } from "@/components/atendimento/medidas-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { hojeISO } from "@/lib/format";
import { MEDIDAS_CAMPOS } from "@/lib/medidas";
import type { ClienteListItem, FormaPecaItem, TipoAtendimento, TipoPedidoItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface AtendimentoFormValores {
  tipo: TipoAtendimento;
  cliente_id: number | null;
  tipo_pedido_id: number | null;
  forma_peca_id: number | null;
  descricao_produto: string;
  data_pedido: string;
  data_entrega: string;
  quantidade_pecas: string;
  valor_combinado: string;
  medidas_disponiveis: boolean;
  medidas: Medidas;
  comentario_medidas: string;
  fotos: (string | null)[];
  comentarios_foto: string[];
  observacao_atendimento: string;
}

export function valoresIniciaisVazios(clienteId?: number | null): AtendimentoFormValores {
  return {
    tipo: "pedido",
    cliente_id: clienteId ?? null,
    tipo_pedido_id: null,
    forma_peca_id: null,
    descricao_produto: "",
    data_pedido: hojeISO(),
    data_entrega: "",
    quantidade_pecas: "1",
    valor_combinado: "",
    medidas_disponiveis: false,
    medidas: {},
    comentario_medidas: "",
    fotos: [null, null, null],
    comentarios_foto: ["", "", ""],
    observacao_atendimento: "",
  };
}

/** Converte o estado do formulário no corpo que o backend espera. */
export function montarPayload(v: AtendimentoFormValores): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    tipo: v.tipo,
    cliente_id: v.cliente_id,
    tipo_pedido_id: v.tipo_pedido_id,
    forma_peca_id: v.forma_peca_id,
    descricao_produto: v.descricao_produto.trim(),
    data_pedido: v.data_pedido,
    data_entrega: v.data_entrega || null,
    quantidade_pecas: v.quantidade_pecas ? Number(v.quantidade_pecas) : null,
    valor_combinado: v.valor_combinado ? Number(v.valor_combinado.replace(",", ".")) : null,
    medidas_disponiveis: v.medidas_disponiveis,
    comentario_medidas: v.comentario_medidas.trim() || null,
    fotos_disponiveis: v.fotos.some(Boolean),
    foto_url: v.fotos[0],
    foto_url_2: v.fotos[1],
    foto_url_3: v.fotos[2],
    comentario_foto_1: v.comentarios_foto[0]?.trim() || null,
    comentario_foto_2: v.comentarios_foto[1]?.trim() || null,
    comentario_foto_3: v.comentarios_foto[2]?.trim() || null,
    observacao_atendimento: v.observacao_atendimento.trim() || null,
  };
  // Medida em branco vira null: "não tirei" é diferente de "mediu zero".
  MEDIDAS_CAMPOS.forEach(({ key }) => {
    payload[key] = v.medidas_disponiveis ? v.medidas[key] ?? null : null;
  });
  return payload;
}

interface Props {
  valores: AtendimentoFormValores;
  onChange: (valores: AtendimentoFormValores) => void;
  /** Na edição a cliente não muda — trocar de cliente seria outro pedido. */
  clienteFixo?: { id: number; nome: string };
  disabled?: boolean;
}

export function AtendimentoForm({ valores, onChange, clienteFixo, disabled }: Props) {
  const [clientes, setClientes] = useState<ClienteListItem[]>([]);
  const [tipos, setTipos] = useState<TipoPedidoItem[]>([]);
  const [formas, setFormas] = useState<FormaPecaItem[]>([]);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [mostrarLista, setMostrarLista] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState<number | null>(null);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const containerBusca = useRef<HTMLDivElement>(null);

  const set = <K extends keyof AtendimentoFormValores>(campo: K, valor: AtendimentoFormValores[K]) =>
    onChange({ ...valores, [campo]: valor });

  useEffect(() => {
    api.get<TipoPedidoItem[]>("/api/v1/catalogo/tipos").then(setTipos).catch(() => setTipos([]));
  }, []);

  // Clientes só são buscados quando não há cliente fixo (modo criação).
  useEffect(() => {
    if (clienteFixo) return;
    const t = setTimeout(() => {
      const q = buscaCliente.trim() ? `?q=${encodeURIComponent(buscaCliente.trim())}` : "";
      api.get<ClienteListItem[]>(`/api/v1/clientes${q}`).then(setClientes).catch(() => setClientes([]));
    }, 300);
    return () => clearTimeout(t);
  }, [buscaCliente, clienteFixo]);

  useEffect(() => {
    if (!valores.tipo_pedido_id) {
      setFormas([]);
      return;
    }
    api
      .get<FormaPecaItem[]>(`/api/v1/catalogo/formas-peca?tipo_pedido_id=${valores.tipo_pedido_id}`)
      .then(setFormas)
      .catch(() => setFormas([]));
  }, [valores.tipo_pedido_id]);

  // Fecha o dropdown ao clicar fora.
  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (containerBusca.current && !containerBusca.current.contains(e.target as Node)) {
        setMostrarLista(false);
      }
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  const clienteSelecionado = useMemo(
    () => clientes.find((c) => c.id === valores.cliente_id) ?? null,
    [clientes, valores.cliente_id]
  );

  // A forma da peça define quais medidas fazem sentido pedir.
  const medidasDaForma = useMemo(
    () => formas.find((f) => f.id === valores.forma_peca_id)?.medidas ?? [],
    [formas, valores.forma_peca_id]
  );

  const escolherCliente = async (c: ClienteListItem) => {
    setMostrarLista(false);
    setBuscaCliente(c.nome);
    // Traz as medidas já salvas na ficha — evita remedir a cliente a cada pedido.
    try {
      const detalhe = await api.get<Record<string, unknown>>(`/api/v1/clientes/${c.id}`);
      const m: Medidas = {};
      MEDIDAS_CAMPOS.forEach(({ key }) => {
        const v = detalhe[key];
        if (typeof v === "number" && v > 0) m[key] = v;
      });
      const temMedidas = Object.keys(m).length > 0;
      onChange({
        ...valores,
        cliente_id: c.id,
        medidas: temMedidas ? m : valores.medidas,
        medidas_disponiveis: temMedidas || valores.medidas_disponiveis,
      });
    } catch {
      set("cliente_id", c.id);
    }
  };

  const enviarFoto = async (indice: number, arquivo: File) => {
    setErroFoto(null);
    setEnviandoFoto(indice);
    try {
      const { url } = await api.upload<{ url: string }>("/api/v1/atendimentos/upload-foto", arquivo);
      const fotos = [...valores.fotos];
      fotos[indice] = url;
      set("fotos", fotos);
    } catch (err) {
      setErroFoto(err instanceof Error ? err.message : "Não foi possível enviar a foto");
    } finally {
      setEnviandoFoto(null);
    }
  };

  const removerFoto = (indice: number) => {
    const fotos = [...valores.fotos];
    fotos[indice] = null;
    set("fotos", fotos);
  };

  return (
    <div className="space-y-6">
      {/* Pedido ou orçamento */}
      <div className="grid grid-cols-2 gap-2">
        {(["pedido", "orcamento"] as TipoAtendimento[]).map((t) => (
          <button
            key={t}
            type="button"
            disabled={disabled}
            onClick={() => set("tipo", t)}
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
              valores.tipo === t
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground"
            )}
          >
            {t === "pedido" ? "Pedido" : "Orçamento"}
          </button>
        ))}
      </div>

      {/* Cliente */}
      <div className="space-y-2">
        <Label htmlFor="cliente">Cliente *</Label>
        {clienteFixo ? (
          <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
            {clienteFixo.nome}
          </div>
        ) : (
          <div className="relative" ref={containerBusca}>
            <Input
              id="cliente"
              placeholder="Digite o nome da cliente"
              value={clienteSelecionado ? clienteSelecionado.nome : buscaCliente}
              onChange={(e) => {
                setBuscaCliente(e.target.value);
                setMostrarLista(true);
                if (valores.cliente_id) set("cliente_id", null);
              }}
              onFocus={() => setMostrarLista(true)}
              disabled={disabled}
            />
            {mostrarLista && clientes.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                {clientes.slice(0, 30).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => escolherCliente(c)}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <span className="block truncate">{c.nome}</span>
                      {c.telefone && (
                        <span className="block truncate text-xs text-muted-foreground">{c.telefone}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Tipo e forma da peça */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="tipo_pedido">Tipo de peça</Label>
          <select
            id="tipo_pedido"
            value={valores.tipo_pedido_id ?? ""}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                ...valores,
                tipo_pedido_id: e.target.value ? Number(e.target.value) : null,
                forma_peca_id: null,
              })
            }
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
          >
            <option value="">Selecione</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="forma_peca">Forma da peça</Label>
          <select
            id="forma_peca"
            value={valores.forma_peca_id ?? ""}
            disabled={disabled || formas.length === 0}
            onChange={(e) => set("forma_peca_id", e.target.value ? Number(e.target.value) : null)}
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm disabled:opacity-50"
          >
            <option value="">{formas.length ? "Selecione" : "Escolha o tipo antes"}</option>
            {formas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Descrição */}
      <div className="space-y-2">
        <Label htmlFor="descricao">O que a cliente pediu *</Label>
        <Textarea
          id="descricao"
          rows={3}
          placeholder="Ex.: vestido longo azul-marinho, alça fina, fenda lateral"
          value={valores.descricao_produto}
          onChange={(e) => set("descricao_produto", e.target.value)}
          disabled={disabled}
        />
      </div>

      {/* Datas e quantidade */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="data_pedido">Data do atendimento *</Label>
          <Input
            id="data_pedido"
            type="date"
            value={valores.data_pedido}
            onChange={(e) => set("data_pedido", e.target.value)}
            disabled={disabled}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="data_entrega">Entrega combinada</Label>
          <Input
            id="data_entrega"
            type="date"
            value={valores.data_entrega}
            onChange={(e) => set("data_entrega", e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantidade">Quantidade de peças</Label>
          <Input
            id="quantidade"
            type="number"
            inputMode="numeric"
            min="1"
            value={valores.quantidade_pecas}
            onChange={(e) => set("quantidade_pecas", e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="valor">Valor conversado (R$)</Label>
          <Input
            id="valor"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="opcional"
            value={valores.valor_combinado}
            onChange={(e) => set("valor_combinado", e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        O valor aqui é só o que foi conversado no balcão. O preço final é fechado pela Ilma na aprovação.
      </p>

      {/* Medidas */}
      <section className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--primary)]"
            checked={valores.medidas_disponiveis}
            onChange={(e) => set("medidas_disponiveis", e.target.checked)}
            disabled={disabled}
          />
          Tirei as medidas
        </label>

        {valores.medidas_disponiveis && (
          <>
            <MedidasForm
              medidas={valores.medidas}
              onChange={(m) => set("medidas", m)}
              camposVisiveis={medidasDaForma}
              disabled={disabled}
            />
            {medidasDaForma.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Mostrando as medidas que essa forma de peça pede.
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="comentario_medidas">Observação sobre as medidas</Label>
              <Textarea
                id="comentario_medidas"
                rows={2}
                value={valores.comentario_medidas}
                onChange={(e) => set("comentario_medidas", e.target.value)}
                disabled={disabled}
              />
            </div>
          </>
        )}
      </section>

      {/* Fotos */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Fotos de referência</h2>
        {erroFoto && <p className="rounded-md bg-red-50 p-2 text-xs text-red-700">{erroFoto}</p>}
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1">
              {valores.fotos[i] ? (
                <div className="relative aspect-square overflow-hidden rounded-md border border-border">
                  <Image
                    src={valores.fotos[i] as string}
                    alt={`Foto ${i + 1}`}
                    fill
                    sizes="33vw"
                    className="object-cover"
                    unoptimized
                  />
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => removerFoto(i)}
                      aria-label={`Remover foto ${i + 1}`}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ) : (
                <label
                  className={cn(
                    "flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-muted-foreground",
                    disabled && "pointer-events-none opacity-50"
                  )}
                >
                  {enviandoFoto === i ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <ImagePlus className="h-5 w-5" />
                      <span className="text-[10px]">Foto {i + 1}</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={disabled || enviandoFoto !== null}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) enviarFoto(i, f);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
              {valores.fotos[i] && (
                <Input
                  placeholder="Legenda"
                  className="h-8 text-xs"
                  value={valores.comentarios_foto[i] ?? ""}
                  onChange={(e) => {
                    const cs = [...valores.comentarios_foto];
                    cs[i] = e.target.value;
                    set("comentarios_foto", cs);
                  }}
                  disabled={disabled}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Observações */}
      <div className="space-y-2">
        <Label htmlFor="observacao">Observações do atendimento</Label>
        <Textarea
          id="observacao"
          rows={3}
          placeholder="Combinados, preferências, o que a Ilma precisa saber"
          value={valores.observacao_atendimento}
          onChange={(e) => set("observacao_atendimento", e.target.value)}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export function formularioValido(v: AtendimentoFormValores): boolean {
  return Boolean(v.cliente_id && v.data_pedido && v.descricao_produto.trim());
}

/** Preenche o formulário a partir de um registro já salvo. */
export function valoresDoDetalhe(d: Record<string, unknown>): AtendimentoFormValores {
  const medidas: Medidas = {};
  MEDIDAS_CAMPOS.forEach(({ key }) => {
    const v = d[key];
    if (typeof v === "number" && v > 0) medidas[key] = v;
  });
  const texto = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
  const numeroTexto = (k: string) => (d[k] == null ? "" : String(d[k]));

  return {
    tipo: (d.tipo as TipoAtendimento) ?? "pedido",
    cliente_id: (d.cliente_id as number) ?? null,
    tipo_pedido_id: (d.tipo_pedido_id as number) ?? null,
    forma_peca_id: (d.forma_peca_id as number) ?? null,
    descricao_produto: texto("descricao_produto"),
    data_pedido: texto("data_pedido").slice(0, 10) || hojeISO(),
    data_entrega: texto("data_entrega").slice(0, 10),
    quantidade_pecas: numeroTexto("quantidade_pecas"),
    valor_combinado: numeroTexto("valor_combinado"),
    medidas_disponiveis: Boolean(d.medidas_disponiveis),
    medidas,
    comentario_medidas: texto("comentario_medidas"),
    fotos: [
      (d.foto_url as string) ?? null,
      (d.foto_url_2 as string) ?? null,
      (d.foto_url_3 as string) ?? null,
    ],
    comentarios_foto: [texto("comentario_foto_1"), texto("comentario_foto_2"), texto("comentario_foto_3")],
    observacao_atendimento: texto("observacao_atendimento"),
  };
}
