"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Loader2,
  Pencil,
  Trash2,
  Calendar,
  Package,
  Clock,
  DollarSign,
  CreditCard,
  Ruler,
  FileText,
  ImageIcon,
  XCircle,
} from "lucide-react";
import { PagamentoFormEdit } from "@/components/mobile/pagamento-form";
import { PedidoConfirmacaoAtipica } from "@/components/mobile/pedido-confirmacao-atipica";
import { calcularMargem, avaliarAvisosPedido, AvisoPedido, ParametrosCalculo } from "@/lib/margem-pedido";
import { getToken } from "@/lib/api-client";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

function authFetch(url: string, init?: RequestInit) {
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

function parseMoneyInput(value: string): number {
  return parseFloat(value.replace(",", ".")) || 0;
}

const STATUS_OPCOES = [
  "Orçamento",
  "Encomenda",
  "Cortado",
  "Provado",
  "Pronto",
  "Entregue",
  "Cancelado",
];


interface ParcelaForm {
  id?: number;        // existe se já salva no banco
  valor: string;
  data_vencimento: string;
  data_pagamento: string;  // "" = não pago
  status?: string;   // calculado do servidor
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const PAG_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  confirmado: { label: "Pago", cls: "text-green-600 bg-green-50 border-green-200" },
  aguardando: { label: "Aguardando", cls: "text-amber-600 bg-amber-50 border-amber-200" },
  em_atraso:  { label: "Em atraso",  cls: "text-red-600 bg-red-50 border-red-200" },
  previsto:   { label: "Previsto",   cls: "text-blue-600 bg-blue-50 border-blue-200" },
};

interface PedidoDetail {
  id: number;
  cliente_id: number;
  cliente_nome: string;
  tipo_pedido_id: number | null;
  tipo_pedido_nome: string | null;
  forma_peca_id: number | null;
  forma_peca_nome: string | null;
  descricao_produto: string;
  status: string;
  criado_como_orcamento: boolean;
  data_pedido: string;
  data_entrega: string | null;
  valor_pecas: number | null;
  quantidade_pecas: number | null;
  horas_trabalho: number | null;
  custo_materiais: number | null;
  custos_variaveis: number | null;
  margem_real: number | null;
  percentual_lucro_dono: number | null;
  forma_pagamento: string | null;
  valor_entrada: number | null;
  valor_restante: number | null;
  detalhes_pagamento: string | null;
  medidas_disponiveis: boolean | null;
  fotos_disponiveis?: boolean | null;
  medida_ombro: number | null;
  medida_busto: number | null;
  medida_cinto: number | null;
  medida_quadril?: number | null;
  medida_comprimento_corpo?: number | null;
  medida_comprimento_vestido?: number | null;
  medida_distancia_busto?: number | null;
  medida_raio_busto?: number | null;
  medida_altura_busto?: number | null;
  medida_frente?: number | null;
  medida_costado?: number | null;
  medida_comprimento_calca?: number | null;
  medida_comprimento_blusa?: number | null;
  medida_largura_manga?: number | null;
  medida_comprimento_manga?: number | null;
  medida_punho?: number | null;
  medida_comprimento_saia?: number | null;
  medida_comprimento_bermuda?: number | null;
  comentario_medidas?: string | null;
  observacao_pedido: string | null;
  foto_url?: string | null;
  foto_url_2?: string | null;
  foto_url_3?: string | null;
  comentario_foto_1?: string | null;
  comentario_foto_2?: string | null;
  comentario_foto_3?: string | null;
  param_preco_hora?: number | null;
  param_impostos?: number | null;
  param_cartao_credito?: number | null;
  param_total_horas_mes?: number | null;
  param_margem_target?: number | null;
  pagamento_na_entrega?: boolean | null;
  canal_cartao?: string | null;
  taxa_cartao_valor?: number | null;
  taxa_cartao_percentual?: number | null;
  taxa_cartao_manual?: boolean | null;
  desconto_pix_valor?: number | null;
  desconto_pix_percentual?: number | null;
  desconto_pix_manual?: boolean | null;
}

const MEDIDAS_CAMPOS: { key: keyof PedidoDetail; label: string }[] = [
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isoToInputDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatMoney(val: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(val);
}

function formatDateBR(iso: string | null): string {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function parcelaTitulo(index: number, total: number): string {
  const numero = index + 1;
  if (total <= 1) return "Pagamento";
  return `Parcela ${numero} de ${total}`;
}

function Field({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
}) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-start gap-2">
      {Icon && (
        <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
      )}
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}

export default function PedidoDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = Number(params.id);
  const fromPage = searchParams.get("from");
  const fromMes = searchParams.get("mes");
  const aba = searchParams.get("aba");
  const backUrl = fromPage === "financeiro"
    ? "/mobile/financeiro"
    : fromPage === "historico"
    ? `/mobile/pedidos/todos${fromMes ? `?mes=${fromMes}` : ""}`
    : fromPage === "orcamentos"
    ? "/mobile/pedidos/orcamentos"
    : fromPage === "pagamentos"
    ? "/mobile/pagamentos"
    : "/mobile/pedidos";
  const [pedido, setPedido] = useState<PedidoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fotoUploading, setFotoUploading] = useState(false);

  // Form state
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState("");
  const [dataEntrega, setDataEntrega] = useState("");
  const [valorPecas, setValorPecas] = useState<number | "">("");
  const [quantidadePecas, setQuantidadePecas] = useState<number | "">("");
  const [horasTrabalho, setHorasTrabalho] = useState<number | "">("");
  const [custoMateriais, setCustoMateriais] = useState<number | "">("");
  const [custosVariaveis, setCustosVariaveis] = useState<number | "">("");
  const [formaPagamento, setFormaPagamento] = useState<string | null>(null);
  const [valorEntrada, setValorEntrada] = useState<number | "">("");
  const [detalhesPagamento, setDetalhesPagamento] = useState("");
  // Parcelas (novo fluxo)
  const [parcelas, setParcelas] = useState<ParcelaForm[]>([]);
  const [parcelasLoaded, setParcelasLoaded] = useState(false);
  const [savingParcelas, setSavingParcelas] = useState(false);
  const [medidasDisponiveis, setMedidasDisponiveis] = useState<boolean | null>(null);
  const [fotosDisponiveis, setFotosDisponiveis] = useState<boolean | null>(null);
  const [observacao, setObservacao] = useState("");
  const [comentarioMedidas, setComentarioMedidas] = useState("");
  const [medidas, setMedidas] = useState<Record<string, number>>({});
  const [formaPecaId, setFormaPecaId] = useState<number | null>(null);
  const [formasPeca, setFormasPeca] = useState<{ id: number; nome: string; medidas: string[] }[]>([]);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotoUrl2, setFotoUrl2] = useState<string | null>(null);
  const [fotoUrl3, setFotoUrl3] = useState<string | null>(null);
  const [comentarioFoto1, setComentarioFoto1] = useState("");
  const [comentarioFoto2, setComentarioFoto2] = useState("");
  const [comentarioFoto3, setComentarioFoto3] = useState("");
  const [percentualLucroDono, setPercentualLucroDono] = useState<number | "">("");
  const [parametros, setParametros] = useState<ParametrosCalculo | null>(null);
  const [avisosAtipicos, setAvisosAtipicos] = useState<AvisoPedido[]>([]);
  const [confirmadoAtipico, setConfirmadoAtipico] = useState(false);
  const pagamentoSectionRef = useRef<HTMLElement | null>(null);

  const loadPedido = () => {
    authFetch(`${API_URL}/api/v1/pedidos/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Não encontrado");
        return res.json();
      })
      .then((data) => {
        setPedido(data);
        setDescricao(data.descricao_produto || "");
        setStatus(data.status || "Encomenda");
        setDataEntrega(isoToInputDate(data.data_entrega));
        setValorPecas(data.valor_pecas ?? "");
        setQuantidadePecas(data.quantidade_pecas ?? "");
        setHorasTrabalho(data.horas_trabalho ?? "");
        setCustoMateriais(data.custo_materiais ?? "");
        setCustosVariaveis(data.custos_variaveis ?? "");
        setPercentualLucroDono(data.percentual_lucro_dono ?? "");
        setFormaPagamento(data.forma_pagamento || null);
        setValorEntrada(data.valor_entrada ?? "");
        setDetalhesPagamento(data.detalhes_pagamento || "");
        setFormaPecaId(data.forma_peca_id ?? null);
        setMedidasDisponiveis(data.medidas_disponiveis ?? null);
        setComentarioMedidas(data.comentario_medidas || "");
        setFotosDisponiveis(data.fotos_disponiveis ?? null);
        setObservacao(data.observacao_pedido || "");
        const m: Record<string, number> = {};
        MEDIDAS_CAMPOS.forEach(({ key }) => {
          const v = data[key];
          if (v != null && v > 0) m[key] = v;
        });
        setMedidas(m);
        setFotoUrl(data.foto_url || null);
        setFotoUrl2(data.foto_url_2 || null);
        setFotoUrl3(data.foto_url_3 || null);
        setComentarioFoto1(data.comentario_foto_1 || "");
        setComentarioFoto2(data.comentario_foto_2 || "");
        setComentarioFoto3(data.comentario_foto_3 || "");
      })
      .catch(() => setPedido(null))
      .finally(() => setLoading(false));
  };

  const loadParcelas = () => {
    if (!id || isNaN(id)) { setParcelasLoaded(true); return; }
    setParcelasLoaded(false);
    authFetch(`${API_URL}/api/v1/pedidos/${id}/parcelas`)
      .then((res) => res.json())
      .then((data: { id: number; valor: number; data_vencimento: string | null; data_pagamento: string | null; status: string }[]) => {
        setParcelas(data.map((p) => ({
          id: p.id,
          valor: String(p.valor),
          data_vencimento: p.data_vencimento || todayISO(),
          data_pagamento: p.data_pagamento || "",
          status: p.status,
        })));
        setParcelasLoaded(true);
      })
      .catch(() => { setParcelas([]); setParcelasLoaded(true); });
  };

  useEffect(() => {
    loadPedido();
    loadParcelas();
    authFetch(`${API_URL}/api/v1/parametros`)
      .then((res) => res.json())
      .then((data) =>
        setParametros({
          preco_hora: data.preco_hora ?? 50,
          impostos: data.impostos ?? 0.06,
          cartao_credito: data.cartao_credito ?? 0.03,
        })
      )
      .catch(() => setParametros(null));
  }, [id]);

  useEffect(() => {
    if (aba !== "pagamento" || loading || !parcelasLoaded) return;
    window.setTimeout(() => {
      pagamentoSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  }, [aba, loading, parcelasLoaded]);

  useEffect(() => {
    if (!pedido?.tipo_pedido_id || !editing) {
      setFormasPeca([]);
      return;
    }
    authFetch(`${API_URL}/api/v1/pedidos/formas-peca?tipo_pedido_id=${pedido.tipo_pedido_id}`)
      .then((res) => res.json())
      .then(setFormasPeca)
      .catch(() => setFormasPeca([]));
  }, [pedido?.tipo_pedido_id, editing]);

  const margemPreview = React.useMemo(() => {
    if (!parametros) return null;
    return calcularMargem(
      Number(valorPecas) || 0,
      Number(horasTrabalho) || 0,
      Number(custoMateriais) || 0,
      Number(custosVariaveis) || 0,
      parametros
    );
  }, [parametros, valorPecas, horasTrabalho, custoMateriais, custosVariaveis]);

  const enterEditMode = () => {
    if (pedido) {
      setDescricao(pedido.descricao_produto || "");
      setStatus(pedido.status || "Encomenda");
      setDataEntrega(isoToInputDate(pedido.data_entrega));
      setValorPecas(pedido.valor_pecas ?? "");
      setQuantidadePecas(pedido.quantidade_pecas ?? "");
      setHorasTrabalho(pedido.horas_trabalho ?? "");
      setCustoMateriais(pedido.custo_materiais ?? "");
      setCustosVariaveis(pedido.custos_variaveis ?? "");
      setPercentualLucroDono(pedido.percentual_lucro_dono ?? "");
      setFormaPagamento(pedido.forma_pagamento || null);
      setValorEntrada(pedido.valor_entrada ?? "");
      setDetalhesPagamento(pedido.detalhes_pagamento || "");
      setFormaPecaId(pedido.forma_peca_id ?? null);
      setMedidasDisponiveis(pedido.medidas_disponiveis ?? null);
      setComentarioMedidas(pedido.comentario_medidas || "");
      setFotosDisponiveis(pedido.fotos_disponiveis ?? null);
      setObservacao(pedido.observacao_pedido || "");
      const m: Record<string, number> = {};
      MEDIDAS_CAMPOS.forEach(({ key }) => {
        const v = pedido[key];
        if (v != null && (v as number) > 0) m[key] = v as number;
      });
      setMedidas(m);
      setFotoUrl(pedido.foto_url || null);
      setFotoUrl2(pedido.foto_url_2 || null);
      setFotoUrl3(pedido.foto_url_3 || null);
      setComentarioFoto1(pedido.comentario_foto_1 || "");
      setComentarioFoto2(pedido.comentario_foto_2 || "");
      setComentarioFoto3(pedido.comentario_foto_3 || "");
      setAvisosAtipicos([]);
      setConfirmadoAtipico(false);
      setEditing(true);
    }
  };

  const handleSave = async () => {
    if (margemPreview) {
      const avisos = avaliarAvisosPedido(
        Number(valorPecas) || 0,
        Number(quantidadePecas) || 0,
        Number(horasTrabalho) || 0,
        margemPreview.margemReal
      );
      if (avisos.length > 0 && !confirmadoAtipico) {
        setAvisosAtipicos(avisos);
        setConfirmadoAtipico(true);
        return;
      }
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        descricao_produto: descricao || null,
        status,
        data_entrega: dataEntrega || null,
        valor_pecas: valorPecas === "" ? null : valorPecas,
        quantidade_pecas: quantidadePecas === "" ? null : quantidadePecas,
        horas_trabalho: horasTrabalho === "" ? null : horasTrabalho,
        custo_materiais: custoMateriais === "" ? null : custoMateriais,
        custos_variaveis: custosVariaveis === "" ? null : custosVariaveis,
        confirmado_atipico: confirmadoAtipico,
        percentual_lucro_dono: percentualLucroDono === "" ? null : percentualLucroDono,
        forma_pagamento: formaPagamento,
        valor_entrada: valorEntrada === "" ? null : valorEntrada,
        valor_restante: Math.max(0, (Number(valorPecas) || 0) - (Number(valorEntrada) || 0)) || null,
        forma_peca_id: formaPecaId,
        detalhes_pagamento: detalhesPagamento || null,
        medidas_disponiveis: medidasDisponiveis,
        comentario_medidas: comentarioMedidas || null,
        fotos_disponiveis: fotosDisponiveis,
        observacao_pedido: observacao || null,
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
      const res = await authFetch(`${API_URL}/api/v1/pedidos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 422) {
        const errBody = await res.json().catch(() => null);
        const avisosBackend: AvisoPedido[] = errBody?.detail?.avisos ?? [];
        setAvisosAtipicos(avisosBackend);
        setConfirmadoAtipico(true);
        return;
      }
      if (!res.ok) throw new Error("Erro ao salvar");
      // Refetch para obter o pedido completo (PATCH retorna PedidoListItem)
      const detailRes = await authFetch(`${API_URL}/api/v1/pedidos/${id}`);
      if (detailRes.ok) {
        const updated = await detailRes.json();
        setPedido(updated);
      }
      setAvisosAtipicos([]);
      setConfirmadoAtipico(false);
      setEditing(false);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pedido) return;
    setDeleting(true);
    try {
      const res = await authFetch(`${API_URL}/api/v1/pedidos/${pedido.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir");
      router.push(backUrl);
    } catch {
      alert("Erro ao excluir pedido. Tente novamente.");
      setDeleting(false);
    }
  };

  const handleCancelOrcamento = async () => {
    if (!pedido) return;
    setDeleting(true);
    try {
      const res = await authFetch(`${API_URL}/api/v1/pedidos/${pedido.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Cancelado" }),
      });
      if (!res.ok) throw new Error("Erro ao cancelar");
      router.push(backUrl);
    } catch {
      alert("Erro ao cancelar orçamento. Tente novamente.");
      setDeleting(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setAvisosAtipicos([]);
    setConfirmadoAtipico(false);
    if (pedido) {
      setDescricao(pedido.descricao_produto || "");
      setStatus(pedido.status || "Encomenda");
      setDataEntrega(isoToInputDate(pedido.data_entrega));
      setValorPecas(pedido.valor_pecas ?? "");
      setQuantidadePecas(pedido.quantidade_pecas ?? "");
      setHorasTrabalho(pedido.horas_trabalho ?? "");
      setCustoMateriais(pedido.custo_materiais ?? "");
      setCustosVariaveis(pedido.custos_variaveis ?? "");
      setFormaPagamento(pedido.forma_pagamento || null);
      setValorEntrada(pedido.valor_entrada ?? "");
      setDetalhesPagamento(pedido.detalhes_pagamento || "");
      setFormaPecaId(pedido.forma_peca_id ?? null);
      setMedidasDisponiveis(pedido.medidas_disponiveis ?? null);
      setComentarioMedidas(pedido.comentario_medidas || "");
      setFotosDisponiveis(pedido.fotos_disponiveis ?? null);
      setObservacao(pedido.observacao_pedido || "");
      const m: Record<string, number> = {};
      MEDIDAS_CAMPOS.forEach(({ key }) => {
        const v = pedido[key];
        if (v != null && (v as number) > 0) m[key] = v as number;
      });
      setMedidas(m);
      setFotoUrl(pedido.foto_url || null);
      setFotoUrl2(pedido.foto_url_2 || null);
      setFotoUrl3(pedido.foto_url_3 || null);
      setComentarioFoto1(pedido.comentario_foto_1 || "");
      setComentarioFoto2(pedido.comentario_foto_2 || "");
      setComentarioFoto3(pedido.comentario_foto_3 || "");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!pedido) {
    return (
      <div className="p-4">
        <p className="text-gray-500">Pedido não encontrado.</p>
        <Button variant="link" className="mt-2" onClick={() => router.push(backUrl)}>
          Voltar
        </Button>
      </div>
    );
  }

  const medidasComValor = MEDIDAS_CAMPOS.filter(
    (m) => pedido[m.key] != null && pedido[m.key] !== ""
  );
  const temMedidas =
    medidasComValor.length > 0 || pedido.medidas_disponiveis;

  const temPagamento =
    pedido.forma_pagamento ||
    pedido.valor_entrada != null ||
    pedido.valor_restante != null ||
    pedido.detalhes_pagamento ||
    parcelas.length > 0;

  // Modo edição: formulário completo
  if (editing) {
    return (
      <div className="flex flex-1 flex-col pb-32">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.push(backUrl)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-gray-900 truncate">
                Editar pedido
              </h1>
              <p className="text-sm text-gray-500">{pedido.cliente_nome}</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Data do pedido - SOMENTE LEITURA */}
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Data do pedido
            </h2>
            <p className="text-sm font-medium text-gray-900 bg-gray-50 py-2 px-3 rounded-lg">
              {formatDate(pedido.data_pedido)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Não editável</p>
          </section>

          {/* Descrição */}
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <Label>Descrição do produto</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição do produto"
              className="mt-2 min-h-[80px]"
            />
          </section>

          {/* Status */}
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <Label>Status</Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
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
          </section>

          {/* Divisão do valor */}
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <Label>% para Ilma</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step={1}
              value={percentualLucroDono}
              onChange={(e) =>
                setPercentualLucroDono(
                  e.target.value === ""
                    ? ""
                    : Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))
                )
              }
              className="mt-2"
            />
            {percentualLucroDono !== "" && (
              <p className="mt-2 text-xs text-gray-500">
                {Number(percentualLucroDono).toFixed(0)}% fica para Ilma e{" "}
                {(100 - Number(percentualLucroDono)).toFixed(0)}% fica como repasse para Andrea.
              </p>
            )}
          </section>

          {/* Forma da peça (quando tipo de pedido permite) */}
          {formasPeca.length > 0 && (
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <Label>Forma da peça</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {formasPeca.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormaPecaId(formaPecaId === f.id ? null : f.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      formaPecaId === f.id
                        ? "bg-red-500 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {f.nome}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Data de entrega */}
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <Label>Data de entrega</Label>
            <Input
              type="date"
              value={dataEntrega}
              onChange={(e) => setDataEntrega(e.target.value)}
              className="mt-2"
            />
          </section>

          {/* Trabalho */}
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Trabalho</h3>
            <div className="space-y-4">
              <div>
                <Label>Quantidade de peças</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={quantidadePecas}
                  onChange={(e) => {
                    setQuantidadePecas(
                      e.target.value === "" ? "" : parseInt(e.target.value, 10) || 0
                    );
                    setConfirmadoAtipico(false);
                    setAvisosAtipicos([]);
                  }}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Horas (15min=0.25, 30min=0.5)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.25}
                  value={horasTrabalho}
                  onChange={(e) => {
                    setHorasTrabalho(
                      e.target.value === "" ? "" : parseFloat(e.target.value) || 0
                    );
                    setConfirmadoAtipico(false);
                    setAvisosAtipicos([]);
                  }}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Custo materiais</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={custoMateriais}
                  onChange={(e) =>
                    setCustoMateriais(
                      e.target.value === "" ? "" : parseFloat(e.target.value) || 0
                    )
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Custos variáveis</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={custosVariaveis}
                  onChange={(e) =>
                    setCustosVariaveis(
                      e.target.value === "" ? "" : parseFloat(e.target.value) || 0
                    )
                  }
                  className="mt-1"
                />
              </div>
            </div>
          </section>

          {/* Valores */}
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Valores</h3>
            <div className="space-y-4">
              <div>
                <Label>Valor peça(s)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={valorPecas}
                  onChange={(e) => {
                    setValorPecas(
                      e.target.value === "" ? "" : parseMoneyInput(e.target.value)
                    );
                    setConfirmadoAtipico(false);
                    setAvisosAtipicos([]);
                  }}
                  className="mt-1"
                />
              </div>
              {margemPreview && (
                <div className="py-2 px-3 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500">Margem estimada com os valores atuais</p>
                  <p className="font-medium">{margemPreview.margemReal.toFixed(1)}%</p>
                </div>
              )}
            </div>
          </section>

          {/* Pagamento */}
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Pagamento
            </h3>
            <PagamentoFormEdit
              pedidoId={id}
              valorPecas={Number(valorPecas) || 0}
              apiUrl={API_URL}
              formaPagamento={formaPagamento}
              pagamentoNaEntrega={pedido?.pagamento_na_entrega ?? null}
              onFormaPagamentoChange={setFormaPagamento}
            />
          </section>

          {/* Medidas disponíveis */}
          <section className="rounded-xl border border-gray-200 bg-white p-4">
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
          </section>

          {/* Medidas (cm) - filtradas pela forma quando selecionada */}
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
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <Label>Comentário sobre as medidas</Label>
            <Input
              value={comentarioMedidas}
              onChange={(e) => setComentarioMedidas(e.target.value)}
              placeholder="Ex: Medidas tiradas com a cliente em pé..."
              className="mt-2 min-h-[60px]"
            />
          </section>

          {/* Observação */}
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <Label>Observação</Label>
            <Input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Observações adicionais..."
              className="mt-2 min-h-[60px]"
            />
          </section>

          {/* Fotos disponíveis */}
          <section className="rounded-xl border border-gray-200 bg-white p-4">
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
              <div className="mt-4 space-y-4">
                {/* Foto 1 */}
                <div>
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
                        const res = await authFetch(
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
                    <div className="mt-2 flex items-center gap-2">
                      <img
                        src={fotoUrl}
                        alt="Foto 1"
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                      <span className="text-sm text-green-600">Foto 1 anexada</span>
                    </div>
                  )}
                  <div className="mt-2">
                    <Label className="text-xs text-gray-500">Comentário foto 1</Label>
                    <Input
                      value={comentarioFoto1}
                      onChange={(e) => setComentarioFoto1(e.target.value)}
                      placeholder="Comentário..."
                      className="mt-1"
                    />
                  </div>
                </div>
                {fotoUrl && (
                  <div>
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
                          const res = await authFetch(
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
                    {fotoUrl2 && !fotoUploading && (
                      <div className="mt-2 flex items-center gap-2">
                        <img
                          src={fotoUrl2}
                          alt="Foto 2"
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                        <span className="text-sm text-green-600">Foto 2 anexada</span>
                      </div>
                    )}
                    <div className="mt-2">
                      <Label className="text-xs text-gray-500">Comentário foto 2</Label>
                      <Input
                        value={comentarioFoto2}
                        onChange={(e) => setComentarioFoto2(e.target.value)}
                        placeholder="Comentário..."
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
                {fotoUrl2 && (
                  <div>
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
                          const res = await authFetch(
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
                    {fotoUrl3 && !fotoUploading && (
                      <div className="mt-2 flex items-center gap-2">
                        <img
                          src={fotoUrl3}
                          alt="Foto 3"
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                        <span className="text-sm text-green-600">Foto 3 anexada</span>
                      </div>
                    )}
                    <div className="mt-2">
                      <Label className="text-xs text-gray-500">Comentário foto 3</Label>
                      <Input
                        value={comentarioFoto3}
                        onChange={(e) => setComentarioFoto3(e.target.value)}
                        placeholder="Comentário..."
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <PedidoConfirmacaoAtipica avisos={avisosAtipicos} />

          {/* Botões Salvar / Cancelar */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
            <Button variant="outline" onClick={handleCancel} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Modo visualização
  return (
    <div className="flex flex-1 flex-col pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.push(backUrl)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 truncate">
              {pedido.cliente_nome}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-gray-500">
                {pedido.tipo_pedido_nome || "Pedido"}
              </span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  pedido.status === "Entregue"
                    ? "bg-green-100 text-green-800"
                    : pedido.status === "Orçamento"
                      ? "bg-amber-100 text-amber-800"
                      : pedido.status === "Cancelado"
                        ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-700"
                }`}
              >
                {pedido.status}
              </span>
              {pedido.criado_como_orcamento && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                  Nasceu como orçamento
                </span>
              )}
            </div>
          </div>
          <Link
            href={`/mobile/contratos/novo?cliente_id=${pedido.cliente_id}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-700"
          >
            <FileText className="h-4 w-4" />
            Contrato
          </Link>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Descrição */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Descrição do produto
          </h2>
          <p className="text-gray-900">
            {pedido.descricao_produto || "—"}
          </p>
          {pedido.forma_peca_nome && (
            <p className="text-sm text-gray-500 mt-2">
              Forma da peça: {pedido.forma_peca_nome}
            </p>
          )}
        </section>

        {/* Fotos */}
        {(pedido.foto_url || pedido.foto_url_2 || pedido.foto_url_3) && (
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Fotos
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[pedido.foto_url, pedido.foto_url_2, pedido.foto_url_3].map(
                (url, i) =>
                  url ? (
                    <div key={i} className="space-y-1">
                      <img
                        src={url}
                        alt={`Foto ${i + 1}`}
                        className="w-full aspect-square object-cover rounded-lg border border-gray-200"
                      />
                      {i === 0 && pedido.comentario_foto_1 && (
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {pedido.comentario_foto_1}
                        </p>
                      )}
                      {i === 1 && pedido.comentario_foto_2 && (
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {pedido.comentario_foto_2}
                        </p>
                      )}
                      {i === 2 && pedido.comentario_foto_3 && (
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {pedido.comentario_foto_3}
                        </p>
                      )}
                    </div>
                  ) : null
              )}
            </div>
          </section>
        )}

        {/* Datas */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Datas
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Data do pedido"
              value={formatDate(pedido.data_pedido)}
              icon={Calendar}
            />
            <Field
              label="Data de entrega"
              value={pedido.data_entrega ? formatDate(pedido.data_entrega) : "—"}
              icon={Calendar}
            />
          </div>
        </section>

        {/* Trabalho e quantidades */}
        {(pedido.quantidade_pecas != null ||
          pedido.horas_trabalho != null ||
          pedido.custo_materiais != null ||
          pedido.custos_variaveis != null) && (
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Trabalho
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field
                label="Quantidade de peças"
                value={pedido.quantidade_pecas}
                icon={Package}
              />
              <Field
                label="Horas (15min=0.25, 30min=0.5)"
                value={
                  pedido.horas_trabalho != null
                    ? pedido.horas_trabalho.toFixed(2)
                    : null
                }
                icon={Clock}
              />
              <Field
                label="Custo materiais"
                value={
                  pedido.custo_materiais != null
                    ? formatMoney(pedido.custo_materiais)
                    : null
                }
                icon={DollarSign}
              />
              <Field
                label="Custos variáveis"
                value={
                  pedido.custos_variaveis != null
                    ? formatMoney(pedido.custos_variaveis)
                    : null
                }
                icon={DollarSign}
              />
            </div>
          </section>
        )}

        {/* Valores */}
        {(pedido.valor_pecas != null || pedido.margem_real != null) && (
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Valores
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Valor peça(s)"
                value={
                  pedido.valor_pecas != null
                    ? formatMoney(pedido.valor_pecas)
                    : null
                }
                icon={DollarSign}
              />
              <Field
                label="Margem real"
                value={
                  pedido.margem_real != null
                    ? `${pedido.margem_real.toFixed(1)}%`
                    : null
                }
                icon={DollarSign}
              />
              <Field
                label="% para Ilma"
                value={
                  pedido.percentual_lucro_dono != null
                    ? `${pedido.percentual_lucro_dono.toFixed(0)}%`
                    : null
                }
                icon={DollarSign}
              />
              {pedido.percentual_lucro_dono != null && (
                <Field
                  label="% repasse"
                  value={`${(100 - pedido.percentual_lucro_dono).toFixed(0)}%`}
                  icon={DollarSign}
                />
              )}
            </div>
          </section>
        )}

        {/* Custo de receber */}
        <CustoReceberSection
          pedido={pedido}
          apiUrl={API_URL}
          onSaved={(atualizado) => setPedido((p) => (p ? { ...p, ...atualizado } : p))}
        />

        {/* Parâmetros usados no cálculo */}
        {(pedido.param_preco_hora != null ||
          pedido.param_impostos != null ||
          pedido.param_cartao_credito != null ||
          pedido.param_total_horas_mes != null ||
          pedido.param_margem_target != null) && (
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-medium text-gray-500 mb-3">
              Parâmetros usados no cálculo
            </h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {pedido.param_preco_hora != null && (
                <div className="py-2 px-3 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500">Preço/hora</p>
                  <p className="font-medium">{formatMoney(pedido.param_preco_hora)}</p>
                </div>
              )}
              {pedido.param_impostos != null && (
                <div className="py-2 px-3 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500">Impostos</p>
                  <p className="font-medium">{(pedido.param_impostos * 100).toFixed(1)}%</p>
                </div>
              )}
              {pedido.param_cartao_credito != null && (
                <div className="py-2 px-3 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500">Cartão crédito</p>
                  <p className="font-medium">{(pedido.param_cartao_credito * 100).toFixed(1)}%</p>
                </div>
              )}
              {pedido.param_total_horas_mes != null && (
                <div className="py-2 px-3 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500">Total horas/mês</p>
                  <p className="font-medium">{pedido.param_total_horas_mes}</p>
                </div>
              )}
              {pedido.param_margem_target != null && (
                <div className="py-2 px-3 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500">Margem target</p>
                  <p className="font-medium">{(pedido.param_margem_target * 100).toFixed(1)}%</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Pagamento */}
        {temPagamento && (
          <section
            id="pagamento"
            ref={pagamentoSectionRef}
            className="scroll-mt-20 rounded-xl border border-gray-200 bg-white p-4"
          >
            <h2 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Pagamento
            </h2>
            <div className="space-y-3">
              {pedido.forma_pagamento && (
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50">
                  <span className="text-sm text-gray-500">Forma</span>
                  <span className="font-medium text-gray-900">
                    {pedido.forma_pagamento}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {pedido.valor_entrada != null && (
                  <div className="py-2 px-3 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-500">Entrada</p>
                    <p className="font-medium text-gray-900">
                      {formatMoney(pedido.valor_entrada)}
                    </p>
                  </div>
                )}
                {pedido.valor_restante != null && (
                  <div className="py-2 px-3 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-500">Restante</p>
                    <p className="font-medium text-gray-900">
                      {formatMoney(pedido.valor_restante)}
                    </p>
                  </div>
                )}
              </div>
              {pedido.detalhes_pagamento && (
                <p className="text-sm text-gray-600 pt-1">
                  {pedido.detalhes_pagamento}
                </p>
              )}
              {parcelas.length > 0 && (
                <div className="space-y-2 pt-1">
                  {parcelas.map((parcela, index) => {
                    const statusInfo = parcela.status ? PAG_STATUS_LABEL[parcela.status] : null;
                    return (
                      <div key={parcela.id ?? index} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {parcelaTitulo(index, parcelas.length)}
                            </p>
                            {/* Parcela de cartão futura tem data de pagamento gravada (a data
                                prevista de crédito) — chamar isso de "pago em" seria mentira. */}
                            <p className="text-xs text-gray-500">
                              {parcela.status === "previsto"
                                ? `Cai em ${formatDateBR(parcela.data_vencimento)}`
                                : `Vence ${formatDateBR(parcela.data_vencimento)}${
                                    parcela.data_pagamento ? ` · pago em ${formatDateBR(parcela.data_pagamento)}` : ""
                                  }`}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold text-gray-900">
                              {formatMoney(parseMoneyInput(parcela.valor))}
                            </p>
                            {statusInfo && (
                              <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] ${statusInfo.cls}`}>
                                {statusInfo.label}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Medidas */}
        {temMedidas && (
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
              <Ruler className="w-4 h-4" />
              Medidas (cm)
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {medidasComValor.map(({ key, label }) => (
                <div
                  key={key}
                  className="py-3 px-3 rounded-lg bg-gray-50 text-center"
                >
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {pedido[key] as number}
                  </p>
                </div>
              ))}
            </div>
            {pedido.medidas_disponiveis && medidasComValor.length === 0 && (
              <p className="text-sm text-gray-500 mt-2">
                Medidas disponíveis (dados em outro campo)
              </p>
            )}
          </section>
        )}

        {/* Comentário sobre as medidas */}
        {pedido.comentario_medidas && (
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
              <Ruler className="w-4 h-4" />
              Comentário sobre as medidas
            </h2>
            <p className="text-sm text-gray-700">{pedido.comentario_medidas}</p>
          </section>
        )}

        {/* Observação */}
        {pedido.observacao_pedido && (
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Observação
            </h2>
            <p className="text-sm text-gray-700">{pedido.observacao_pedido}</p>
          </section>
        )}

        {pedido.status === "Orçamento" ? (
          <section className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-amber-600">
                <XCircle className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-amber-900">Cancelar orçamento</h2>
                <p className="mt-1 text-sm text-amber-700">
                  O orçamento sai da lista de ativos, mas continua no histórico para acompanhar conversão.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      className="mt-3 w-full bg-amber-600 text-white hover:bg-amber-700 sm:w-auto"
                      disabled={deleting}
                    >
                      {deleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      Cancelar orçamento
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-lg">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar este orçamento?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O orçamento de {pedido.cliente_nome} será marcado como Cancelado e continuará
                        disponível no histórico. Nenhum registro será apagado.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={deleting}>Voltar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(e) => {
                          e.preventDefault();
                          handleCancelOrcamento();
                        }}
                        disabled={deleting}
                        className="bg-amber-600 text-white hover:bg-amber-700"
                      >
                        {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                        Confirmar cancelamento
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </section>
        ) : (
        <section className="rounded-xl border border-red-100 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-red-500">
              <Trash2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-red-900">Excluir pedido</h2>
              <p className="mt-1 text-sm text-red-700">
                Use quando o pedido foi lançado duplicado ou não deve existir no histórico.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    className="mt-3 w-full bg-red-600 hover:bg-red-700 sm:w-auto"
                    disabled={deleting}
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Excluir pedido
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-lg">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir este pedido?</AlertDialogTitle>
                    <AlertDialogDescription>
                      O pedido de {pedido.cliente_nome} será removido junto com os pagamentos vinculados.
                      Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        handleDelete();
                      }}
                      disabled={deleting}
                      className="bg-red-600 text-white hover:bg-red-700"
                    >
                      {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                      Excluir definitivamente
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </section>
        )}
      </div>

      {/* FAB Editar */}
      <button
        onClick={enterEditMode}
        className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600"
        aria-label="Editar"
      >
        <Pencil className="h-6 w-6" />
      </button>

    </div>
  );
}

/**
 * Custo de receber do pedido: taxa de cartão e desconto Pix, em reais.
 *
 * O faturamento continua sendo o valor cheio da peça — estes valores viram
 * despesa e entram como custo na margem. São editáveis porque o número real vem
 * do extrato da adquirente, que nem sempre bate com a taxa da tabela.
 */
function CustoReceberSection({
  pedido, apiUrl, onSaved,
}: {
  pedido: PedidoDetail;
  apiUrl: string;
  onSaved: (p: Partial<PedidoDetail>) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [taxa, setTaxa] = useState("");
  const [desconto, setDesconto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const taxaAtual = pedido.taxa_cartao_valor ?? 0;
  const descontoAtual = pedido.desconto_pix_valor ?? 0;
  const total = taxaAtual + descontoAtual;
  const liquido = (pedido.valor_pecas ?? 0) - total;

  // Pedidos antigos, anteriores à mudança, não têm nada a mostrar aqui.
  if (pedido.taxa_cartao_valor == null && pedido.desconto_pix_valor == null) return null;

  const abrir = () => {
    setTaxa(taxaAtual ? taxaAtual.toFixed(2) : "");
    setDesconto(descontoAtual ? descontoAtual.toFixed(2) : "");
    setErro(null);
    setEditando(true);
  };

  const salvar = async (recalcular = false) => {
    setSalvando(true);
    setErro(null);
    try {
      const body: Record<string, unknown> = { confirmado_atipico: true };
      if (recalcular) {
        body.recalcular_custos = true;
      } else {
        body.taxa_cartao_valor = parseMoneyInput(taxa);
        body.desconto_pix_valor = parseMoneyInput(desconto);
      }
      const res = await authFetch(`${apiUrl}/api/v1/pedidos/${pedido.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Não foi possível salvar o custo de receber.");
      const detalhe = await authFetch(`${apiUrl}/api/v1/pedidos/${pedido.id}`).then((r) => r.json());
      onSaved(detalhe);
      setEditando(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-500">Custo de receber</h2>
        {!editando && (
          <button type="button" onClick={abrir} className="text-xs text-blue-600 hover:underline">
            Editar
          </button>
        )}
      </div>

      {editando ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Taxa de cartão (R$)</p>
              <input
                type="text" inputMode="decimal" value={taxa}
                onChange={(e) => setTaxa(e.target.value)}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              {pedido.taxa_cartao_percentual != null && (
                <p className="text-[10px] text-gray-400 mt-1">
                  Automático: {pedido.taxa_cartao_percentual.toLocaleString("pt-BR")}%
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Desconto Pix (R$)</p>
              <input
                type="text" inputMode="decimal" value={desconto}
                onChange={(e) => setDesconto(e.target.value)}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              {pedido.desconto_pix_percentual != null && (
                <p className="text-[10px] text-gray-400 mt-1">
                  Automático: {pedido.desconto_pix_percentual.toLocaleString("pt-BR")}%
                </p>
              )}
            </div>
          </div>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
          <div className="flex gap-2">
            <button
              type="button" disabled={salvando} onClick={() => salvar(false)}
              className="flex-1 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button" disabled={salvando} onClick={() => salvar(true)}
              className="py-2 px-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 text-sm disabled:opacity-50"
              title="Volta a calcular pela tabela de taxas"
            >
              Recalcular
            </button>
            <button
              type="button" disabled={salvando} onClick={() => setEditando(false)}
              className="py-2 px-3 rounded-lg border border-gray-200 text-gray-600 text-sm disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="py-2 px-3 rounded-lg bg-gray-50">
              <p className="text-xs text-gray-500">
                Taxa de cartão
                {pedido.taxa_cartao_percentual != null && ` (${pedido.taxa_cartao_percentual.toLocaleString("pt-BR")}%)`}
                {pedido.taxa_cartao_manual ? " · manual" : ""}
              </p>
              <p className="font-medium">{formatMoney(taxaAtual)}</p>
            </div>
            <div className="py-2 px-3 rounded-lg bg-gray-50">
              <p className="text-xs text-gray-500">
                Desconto Pix
                {pedido.desconto_pix_percentual != null && ` (${pedido.desconto_pix_percentual.toLocaleString("pt-BR")}%)`}
                {pedido.desconto_pix_manual ? " · manual" : ""}
              </p>
              <p className="font-medium">{formatMoney(descontoAtual)}</p>
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-3 pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              Pedido {formatMoney(pedido.valor_pecas ?? 0)}
              {pedido.canal_cartao ? ` · ${pedido.canal_cartao}` : ""}
            </span>
            <span className="text-sm font-semibold text-gray-800">
              você recebe {formatMoney(liquido)}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
