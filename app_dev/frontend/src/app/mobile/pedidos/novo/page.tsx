"use client";

import React, { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Plus, Ruler, Search } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

interface ClienteItem {
  id: number;
  nome: string;
}
interface TipoPedidoItem {
  id: number;
  nome: string;
}
interface FormaPecaItem {
  id: number;
  nome: string;
  medidas: string[];
}

const STATUS_OPCOES = [
  "Orçamento",
  "Encomenda",
  "Cortado",
  "Provado",
  "Pronto",
  "Entregue",
];

const FORMAS_PAGAMENTO = ["Pix", "Parcelado", "Cartão de Crédito"];

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

function NovoPedidoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<ClienteItem[]>([]);
  const [clientesFiltrados, setClientesFiltrados] = useState<ClienteItem[]>([]);
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [clienteNome, setClienteNome] = useState("");
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const clienteRef = useRef<HTMLDivElement>(null);

  const [tipos, setTipos] = useState<TipoPedidoItem[]>([]);
  const [tipoId, setTipoId] = useState<number | null>(null);
  const [formasPeca, setFormasPeca] = useState<FormaPecaItem[]>([]);
  const [formaPecaId, setFormaPecaId] = useState<number | null>(null);

  const [dataPedido, setDataPedido] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [dataEntrega, setDataEntrega] = useState("");
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState("Encomenda");

  const [horasTrabalho, setHorasTrabalho] = useState(0);
  const [custoMateriais, setCustoMateriais] = useState(0);
  const [custosVariaveis, setCustosVariaveis] = useState(0);
  const [valorPecas, setValorPecas] = useState(0);
  const [quantidadePecas, setQuantidadePecas] = useState(0);

  const [formaPagamento, setFormaPagamento] = useState<string | null>(null);
  const [valorEntrada, setValorEntrada] = useState(0);
  const [detalhesPagamento, setDetalhesPagamento] = useState("");

  const [observacao, setObservacao] = useState("");
  const [medidasDisponiveis, setMedidasDisponiveis] = useState<boolean | null>(
    null
  );
  const [fotosDisponiveis, setFotosDisponiveis] = useState<boolean | null>(null);

  const [medidas, setMedidas] = useState<Record<string, number>>({});
  const [comentarioMedidas, setComentarioMedidas] = useState("");
  const [medidasFromCliente, setMedidasFromCliente] = useState(false);

  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotoUrl2, setFotoUrl2] = useState<string | null>(null);
  const [fotoUrl3, setFotoUrl3] = useState<string | null>(null);
  const [comentarioFoto1, setComentarioFoto1] = useState("");
  const [comentarioFoto2, setComentarioFoto2] = useState("");
  const [comentarioFoto3, setComentarioFoto3] = useState("");
  const [fotoUploading, setFotoUploading] = useState(false);

  const [parametros, setParametros] = useState<{
    preco_hora: number;
    impostos: number;
    cartao_credito: number;
    total_horas_mes: number | null;
    margem_target: number | null;
  } | null>(null);

  useEffect(() => {
    const cid = searchParams.get("clienteId");
    if (cid) {
      const id = parseInt(cid, 10);
      if (!isNaN(id)) {
        setClienteId(id);
        fetch(`${API_URL}/api/v1/clientes/${id}`)
          .then((res) => res.json())
          .then((c) => setClienteNome(c.nome))
          .catch(() => {});
      }
    }
  }, [searchParams]);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/clientes`)
      .then((res) => res.json())
      .then(setClientes)
      .catch(() => setClientes([]));
    fetch(`${API_URL}/api/v1/pedidos/tipos`)
      .then((res) => res.json())
      .then(setTipos)
      .catch(() => setTipos([]));
    fetch(`${API_URL}/api/v1/parametros`)
      .then((res) => res.json())
      .then((data) =>
        setParametros({
          preco_hora: data.preco_hora ?? 50,
          impostos: data.impostos ?? 0.06,
          cartao_credito: data.cartao_credito ?? 0.03,
          total_horas_mes: data.total_horas_mes ?? null,
          margem_target: data.margem_target ?? null,
        })
      )
      .catch(() => setParametros(null));
  }, []);

  useEffect(() => {
    if (!tipoId) {
      setFormasPeca([]);
      setFormaPecaId(null);
      return;
    }
    fetch(`${API_URL}/api/v1/pedidos/formas-peca?tipo_pedido_id=${tipoId}`)
      .then((res) => res.json())
      .then(setFormasPeca)
      .catch(() => setFormasPeca([]));
    setFormaPecaId(null);
  }, [tipoId]);

  useEffect(() => {
    if (!clienteId) {
      setMedidasDisponiveis(null);
      setMedidas({});
      setMedidasFromCliente(false);
      return;
    }
    fetch(`${API_URL}/api/v1/clientes/${clienteId}`)
      .then((res) => res.json())
      .then((c) => {
        const hasMedidas =
          c.flag_medidas &&
          (c.medida_ombro != null ||
            c.medida_busto != null ||
            c.medida_cinto != null ||
            c.medida_quadril != null ||
            c.medida_comprimento_corpo != null ||
            c.medida_comprimento_vestido != null);
        if (hasMedidas) {
          setMedidasDisponiveis(true);
          setMedidasFromCliente(true);
          const m: Record<string, number> = {};
          MEDIDAS_CAMPOS.forEach(({ key }) => {
            const v = c[key];
            if (v != null && v > 0) m[key] = v;
          });
          setMedidas(m);
        } else {
          setMedidasDisponiveis(null);
          setMedidas({});
          setMedidasFromCliente(false);
        }
      })
      .catch(() => {
        setMedidasDisponiveis(null);
        setMedidas({});
        setMedidasFromCliente(false);
      });
  }, [clienteId]);

  const { valorMargem20, valorMargem30, valorMargem40, margemReal } =
    useMemo(() => {
      if (!parametros)
        return {
          valorMargem20: 0,
          valorMargem30: 0,
          valorMargem40: 0,
          margemReal: 0,
        };
      const custoTotal =
        parametros.preco_hora * horasTrabalho +
        custoMateriais +
        custosVariaveis;
      const denom = (m: number) =>
        1 - parametros.impostos - parametros.cartao_credito - m;
      const margem = (x: number) =>
        denom(x) <= 0 ? 0 : Math.round((custoTotal / denom(x)) * 100) / 100;
      const margemRealCalc =
        valorPecas > 0
          ? (valorPecas - custoTotal) / valorPecas -
            parametros.impostos -
            parametros.cartao_credito
          : 0;
      return {
        valorMargem20: margem(0.2),
        valorMargem30: margem(0.3),
        valorMargem40: margem(0.4),
        margemReal: Math.round(Math.max(0, margemRealCalc) * 1000) / 10,
      };
    }, [
      parametros,
      horasTrabalho,
      custoMateriais,
      custosVariaveis,
      valorPecas,
    ]);

  useEffect(() => {
    if (!clienteSearch.trim()) {
      setClientesFiltrados(clientes.slice(0, 20));
      return;
    }
    const q = clienteSearch.toLowerCase();
    const filtrados = clientes.filter((c) =>
      c.nome.toLowerCase().includes(q)
    );
    setClientesFiltrados(filtrados.slice(0, 15));
  }, [clienteSearch, clientes]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (clienteRef.current && !clienteRef.current.contains(e.target as Node)) {
        setShowClienteDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [formError, setFormError] = useState("");

  const isFormValid = Boolean(
    clienteId &&
    tipoId &&
    dataPedido &&
    descricao.trim() &&
    dataEntrega
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!clienteId) {
      setFormError(
        clienteSearch.trim()
          ? "Cliente não encontrado. Selecione um cliente da lista (clique no nome)."
          : "Selecione um cliente da lista."
      );
      return;
    }
    // Validar se o cliente existe na base antes de prosseguir
    try {
      const checkRes = await fetch(`${API_URL}/api/v1/clientes/${clienteId}`);
      if (!checkRes.ok) {
        setClienteId(null);
        setClienteNome("");
        setClienteSearch("");
        setFormError("Cliente não encontrado na base de dados. Selecione novamente da lista.");
        return;
      }
    } catch {
      setFormError("Erro ao validar cliente. Tente novamente.");
      return;
    }
    if (!dataPedido) return;
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        cliente_id: clienteId,
        tipo_pedido_id: tipoId,
        forma_peca_id: formaPecaId,
        data_pedido: dataPedido,
        data_entrega: dataEntrega || null,
        descricao_produto: descricao || "",
        status,
        valor_pecas: valorPecas || null,
        quantidade_pecas: quantidadePecas || null,
        horas_trabalho: horasTrabalho || null,
        custo_materiais: custoMateriais || null,
        custos_variaveis: custosVariaveis || null,
        margem_real: margemReal || null,
        param_preco_hora: parametros?.preco_hora ?? null,
        param_impostos: parametros?.impostos ?? null,
        param_cartao_credito: parametros?.cartao_credito ?? null,
        param_total_horas_mes: parametros?.total_horas_mes ?? null,
        param_margem_target: parametros?.margem_target ?? null,
        forma_pagamento: formaPagamento,
        valor_entrada: valorEntrada || null,
        valor_restante: Math.max(0, (valorPecas || 0) - (valorEntrada || 0)) || null,
        detalhes_pagamento: detalhesPagamento || null,
        medidas_disponiveis: medidasDisponiveis,
        comentario_medidas: comentarioMedidas || null,
        observacao_pedido: observacao || null,
        fotos_disponiveis: fotosDisponiveis,
        foto_url: fotoUrl,
        foto_url_2: fotoUrl2,
        foto_url_3: fotoUrl3,
        comentario_foto_1: comentarioFoto1 || null,
        comentario_foto_2: comentarioFoto2 || null,
        comentario_foto_3: comentarioFoto3 || null,
      };
      MEDIDAS_CAMPOS.forEach(({ key }) => {
        const v = medidas[key];
        if (v != null && v > 0) body[key] = v;
      });
      const res = await fetch(`${API_URL}/api/v1/pedidos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Erro ao salvar");

      if (medidasDisponiveis && Object.keys(medidas).some((k) => medidas[k] > 0)) {
        const clienteMedidas: Record<string, number> = {};
        MEDIDAS_CAMPOS.forEach(({ key }) => {
          const v = medidas[key];
          if (v != null && v > 0) clienteMedidas[key] = v;
        });
        if (Object.keys(clienteMedidas).length > 0) {
          await fetch(`${API_URL}/api/v1/clientes/${clienteId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              flag_medidas: true,
              ...clienteMedidas,
            }),
          });
        }
      }

      router.push("/mobile/pedidos");
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Link href="/mobile/pedidos">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Novo Pedido</h2>
            <p className="text-sm text-gray-500">Dados do pedido</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-6">
        {/* Cliente - busca ao digitar */}
        <div ref={clienteRef} className="relative">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="cliente">Nome Cliente *</Label>
            <Link
              href="/mobile/clientes/novo"
              className="flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700"
            >
              <Plus className="h-4 w-4" />
              Novo cliente
            </Link>
          </div>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="cliente"
              type="text"
              value={clienteId ? clienteNome : clienteSearch}
              onChange={(e) => {
                setClienteSearch(e.target.value);
                setClienteId(null);
                setClienteNome("");
                setShowClienteDropdown(true);
              }}
              onFocus={() => setShowClienteDropdown(true)}
              placeholder="Digite para buscar..."
              className="pl-10"
            />
            {clienteId && (
              <button
                type="button"
                onClick={() => {
                  setClienteId(null);
                  setClienteNome("");
                  setClienteSearch("");
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-red-600"
              >
                Limpar
              </button>
            )}
          </div>
          {showClienteDropdown && clientesFiltrados.length > 0 && !clienteId && (
            <ul className="absolute z-20 w-full mt-1 max-h-48 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {clientesFiltrados.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setClienteId(c.id);
                      setClienteNome(c.nome);
                      setClienteSearch("");
                      setShowClienteDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    {c.nome}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Data Pedido */}
        <div>
          <Label htmlFor="dataPedido">Data Pedido *</Label>
          <Input
            id="dataPedido"
            type="date"
            value={dataPedido}
            onChange={(e) => setDataPedido(e.target.value)}
            required
            className="mt-1"
          />
        </div>

        {/* Tipo Pedido - caixas clicáveis */}
        <div>
          <Label>Tipo Pedido *</Label>
          <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3">
            <div className="flex flex-wrap gap-2">
              {tipos.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTipoId(tipoId === t.id ? null : t.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tipoId === t.id
                      ? "bg-red-500 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {t.nome}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Forma da peça - toggle (filtrado pelo tipo de pedido) */}
        {tipoId && formasPeca.length > 0 && (
          <div>
            <Label>Forma da peça</Label>
            <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3">
              <div className="flex flex-wrap gap-2">
                {formasPeca.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormaPecaId(formaPecaId === f.id ? null : f.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      formaPecaId === f.id
                        ? "bg-red-500 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {f.nome}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Descrição */}
        <div>
          <Label htmlFor="descricao">Descrição Produto *</Label>
          <Input
            id="descricao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Vestido de lese branca..."
            required
            className="mt-1 min-h-[80px]"
          />
        </div>

        {/* Status */}
        <div>
          <Label>Status Pedido *</Label>
          <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3">
            <div className="grid grid-cols-3 gap-2">
              {STATUS_OPCOES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    status === s
                      ? "bg-red-500 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Horas, Custo Materiais, Custos Variáveis */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
          <h3 className="text-sm font-medium text-gray-500">Trabalho</h3>
          <div>
            <Label>Horas (15min=0.25, 30min=0.5) *</Label>
            <Input
              type="number"
              min={0}
              step={0.25}
              value={horasTrabalho || ""}
              onChange={(e) => setHorasTrabalho(parseFloat(e.target.value) || 0)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Custo Materiais *</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={custoMateriais || ""}
              onChange={(e) => setCustoMateriais(parseFloat(e.target.value) || 0)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Custos Variáveis</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={custosVariaveis || ""}
              onChange={(e) => setCustosVariaveis(parseFloat(e.target.value) || 0)}
              className="mt-1"
            />
          </div>

          {/* Valor para Margem 20%, 30%, 40% - output calculado */}
          <div className="pt-3 border-t border-gray-100 space-y-2">
            <p className="text-xs text-gray-500">
              Valor sugerido para margem (a partir de Horas, Custo Materiais e
              Custos Variáveis)
            </p>
            <div className="grid grid-cols-1 gap-2">
              <div className="flex justify-between items-center py-2 px-3 rounded-lg bg-gray-50">
                <span className="text-sm text-gray-600">
                  Valor para Margem de 20%
                </span>
                <span className="font-semibold text-gray-900">
                  R$ {valorMargem20.toFixed(2).replace(".", ",")}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 px-3 rounded-lg bg-gray-50">
                <span className="text-sm text-gray-600">
                  Valor para Margem de 30%
                </span>
                <span className="font-semibold text-gray-900">
                  R$ {valorMargem30.toFixed(2).replace(".", ",")}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 px-3 rounded-lg bg-gray-50">
                <span className="text-sm text-gray-600">
                  Valor para Margem de 40%
                </span>
                <span className="font-semibold text-gray-900">
                  R$ {valorMargem40.toFixed(2).replace(".", ",")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Valores */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
          <h3 className="text-sm font-medium text-gray-500">Valores</h3>
          <div>
            <Label>Valor Peça(s) *</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={valorPecas || ""}
              onChange={(e) => setValorPecas(parseFloat(e.target.value) || 0)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Margem Real (%)</Label>
            <div className="flex justify-between items-center py-2 px-3 rounded-lg bg-gray-50 mt-1">
              <span className="text-sm text-gray-500">
                Calculada a partir de Valor Peça(s), Horas, Custos
              </span>
              <span className="font-semibold text-gray-900">
                {margemReal.toFixed(1)}%
              </span>
            </div>
          </div>
          <div>
            <Label>Quantidade de Peças *</Label>
            <Input
              type="number"
              min={0}
              step={1}
              value={quantidadePecas || ""}
              onChange={(e) =>
                setQuantidadePecas(parseInt(e.target.value, 10) || 0)
              }
              className="mt-1"
            />
          </div>
        </div>

        {/* Data Entrega */}
        <div>
          <Label htmlFor="dataEntrega">Data de Entrega *</Label>
          <Input
            id="dataEntrega"
            type="date"
            value={dataEntrega}
            onChange={(e) => setDataEntrega(e.target.value)}
            className="mt-1"
          />
        </div>

        {/* Observação */}
        <div>
          <Label htmlFor="observacao">Observação Pedido</Label>
          <Input
            id="observacao"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Observações adicionais..."
            className="mt-1 min-h-[60px]"
          />
        </div>

        {/* Medidas disponíveis */}
        <div>
          <Label>Medidas estão disponíveis?</Label>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => setMedidasDisponiveis(true)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                medidasDisponiveis === true
                  ? "bg-red-500 text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              SIM
            </button>
            <button
              type="button"
              onClick={() => setMedidasDisponiveis(false)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                medidasDisponiveis === false
                  ? "bg-red-500 text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              NÃO
            </button>
          </div>
        </div>

        {/* Medidas (cm) - filtradas pela forma da peça quando selecionada */}
        {medidasDisponiveis && (
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
              <Ruler className="w-4 h-4" />
              Medidas (cm)
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {(formaPecaId
                ? MEDIDAS_CAMPOS.filter(({ key }) =>
                    formasPeca.find((fp) => fp.id === formaPecaId)?.medidas.includes(key)
                  )
                : MEDIDAS_CAMPOS
              ).map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <p className="text-xs text-gray-500">{label}</p>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={medidas[key] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      const num = parseFloat(val);
                      setMedidas((prev) => {
                        const next = { ...prev };
                        if (val === "") delete next[key];
                        else if (!isNaN(num)) next[key] = num;
                        return next;
                      });
                    }}
                    placeholder="—"
                    className="h-10 text-center"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Comentário sobre as medidas */}
        <div>
          <Label>Comentário sobre as medidas</Label>
          <Input
            value={comentarioMedidas}
            onChange={(e) => setComentarioMedidas(e.target.value)}
            placeholder="Ex: Medidas tiradas com a cliente em pé..."
            className="mt-1 min-h-[60px]"
          />
        </div>

        {/* Forma de Pagamento */}
        <div>
          <Label>Forma de Pagamento</Label>
          <div className="flex flex-col gap-2 mt-2">
            {FORMAS_PAGAMENTO.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormaPagamento(formaPagamento === f ? null : f)}
                className={`py-2 px-4 rounded-lg text-sm font-medium text-left ${
                  formaPagamento === f
                    ? "bg-red-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Valor Entrada, Restante, Detalhes */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
          <h3 className="text-sm font-medium text-gray-500">Pagamento</h3>
          <div>
            <Label>Valor Entrada</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={valorEntrada || ""}
              onChange={(e) => setValorEntrada(parseFloat(e.target.value) || 0)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Valor Restante</Label>
            <div className="flex justify-between items-center py-2 px-3 rounded-lg bg-gray-50 mt-1">
              <span className="text-sm text-gray-500">Calculado automaticamente</span>
              <span className="font-semibold text-gray-900">
                R$ {Math.max(0, (valorPecas || 0) - (valorEntrada || 0)).toFixed(2).replace(".", ",")}
              </span>
            </div>
          </div>
          <div>
            <Label>Detalhes do Pagamento</Label>
            <Input
              value={detalhesPagamento}
              onChange={(e) => setDetalhesPagamento(e.target.value)}
              placeholder="Detalhes..."
              className="mt-1 min-h-[60px]"
            />
          </div>
        </div>

        {/* Fotos disponíveis */}
        <div>
          <Label>Fotos disponíveis?</Label>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => setFotosDisponiveis(true)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                fotosDisponiveis === true
                  ? "bg-red-500 text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              SIM
            </button>
            <button
              type="button"
              onClick={() => {
                setFotosDisponiveis(false);
                setFotoUrl(null);
                setFotoUrl2(null);
                setFotoUrl3(null);
              }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                fotosDisponiveis === false
                  ? "bg-red-500 text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              NÃO
            </button>
          </div>
          {fotosDisponiveis && (
            <div className="mt-3 space-y-4">
              {/* Foto 1 */}
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <Label>Foto 1</Label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setFotoUploading(true);
                    try {
                      const form = new FormData();
                      form.append("file", file);
                      const res = await fetch(
                        `${API_URL}/api/v1/pedidos/upload-foto`,
                        { method: "POST", body: form }
                      );
                      if (!res.ok) throw new Error("Erro");
                      const { url } = await res.json();
                      setFotoUrl(url);
                    } catch {
                      setFotoUrl(null);
                    } finally {
                      setFotoUploading(false);
                      e.target.value = "";
                    }
                  }}
                  className="mt-2 block w-full text-sm text-gray-500 file:mr-4 file:rounded file:border-0 file:bg-red-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-red-700 hover:file:bg-red-100"
                />
                {fotoUploading && (
                  <p className="mt-2 text-sm text-gray-500 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </p>
                )}
                {fotoUrl && !fotoUploading && (
                  <p className="mt-2 text-sm text-green-600">Foto 1 anexada</p>
                )}
                <div className="mt-2">
                  <Label className="text-xs text-gray-500">Observação foto 1</Label>
                  <Input
                    value={comentarioFoto1}
                    onChange={(e) => setComentarioFoto1(e.target.value)}
                    placeholder="Comentário sobre a foto..."
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Foto 2 - só aparece se foto 1 estiver anexada */}
              {fotoUrl && (
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <Label>Foto 2</Label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setFotoUploading(true);
                      try {
                        const form = new FormData();
                        form.append("file", file);
                        const res = await fetch(
                          `${API_URL}/api/v1/pedidos/upload-foto`,
                          { method: "POST", body: form }
                        );
                        if (!res.ok) throw new Error("Erro");
                        const { url } = await res.json();
                        setFotoUrl2(url);
                      } catch {
                        setFotoUrl2(null);
                      } finally {
                        setFotoUploading(false);
                        e.target.value = "";
                      }
                    }}
                    className="mt-2 block w-full text-sm text-gray-500 file:mr-4 file:rounded file:border-0 file:bg-red-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-red-700 hover:file:bg-red-100"
                  />
                  {fotoUploading && (
                    <p className="mt-2 text-sm text-gray-500 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </p>
                  )}
                  {fotoUrl2 && !fotoUploading && (
                    <p className="mt-2 text-sm text-green-600">Foto 2 anexada</p>
                  )}
                  <div className="mt-2">
                    <Label className="text-xs text-gray-500">Observação foto 2</Label>
                    <Input
                      value={comentarioFoto2}
                      onChange={(e) => setComentarioFoto2(e.target.value)}
                      placeholder="Comentário sobre a foto..."
                      className="mt-1"
                    />
                  </div>
                </div>
              )}

              {/* Foto 3 - só aparece se foto 2 estiver anexada */}
              {fotoUrl2 && (
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <Label>Foto 3</Label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setFotoUploading(true);
                      try {
                        const form = new FormData();
                        form.append("file", file);
                        const res = await fetch(
                          `${API_URL}/api/v1/pedidos/upload-foto`,
                          { method: "POST", body: form }
                        );
                        if (!res.ok) throw new Error("Erro");
                        const { url } = await res.json();
                        setFotoUrl3(url);
                      } catch {
                        setFotoUrl3(null);
                      } finally {
                        setFotoUploading(false);
                        e.target.value = "";
                      }
                    }}
                    className="mt-2 block w-full text-sm text-gray-500 file:mr-4 file:rounded file:border-0 file:bg-red-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-red-700 hover:file:bg-red-100"
                  />
                  {fotoUploading && (
                    <p className="mt-2 text-sm text-gray-500 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </p>
                  )}
                  {fotoUrl3 && !fotoUploading && (
                    <p className="mt-2 text-sm text-green-600">Foto 3 anexada</p>
                  )}
                  <div className="mt-2">
                    <Label className="text-xs text-gray-500">Observação foto 3</Label>
                    <Input
                      value={comentarioFoto3}
                      onChange={(e) => setComentarioFoto3(e.target.value)}
                      placeholder="Comentário sobre a foto..."
                      className="mt-1"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {formError && (
          <p className="text-sm text-red-600">{formError}</p>
        )}

        {/* Botões */}
        <div className="flex gap-2 pt-4">
          <Button
            type="submit"
            disabled={loading}
            className={`flex-1 transition-colors ${
              isFormValid
                ? "bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-md"
                : ""
            }`}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isFormValid ? "Tudo certo! Salvar" : "Salvar"}
          </Button>
          <Link href="/mobile/pedidos">
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function NovoPedidoPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>}>
      <NovoPedidoContent />
    </Suspense>
  );
}
