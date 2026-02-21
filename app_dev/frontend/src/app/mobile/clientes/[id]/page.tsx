"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Loader2,
  Pencil,
  Phone,
  Mail,
  Ruler,
  Package,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

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

interface ClienteDetail {
  id: number;
  nome: string;
  cpf: string | null;
  rg: string | null;
  endereco: string | null;
  telefone: string | null;
  email: string | null;
  primeiro_agendamento: string | null;
  data_cadastro: string | null;
  flag_medidas: boolean;
  medida_ombro?: number | null;
  medida_busto?: number | null;
  medida_cinto?: number | null;
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
  created_at: string;
  updated_at: string;
}

interface PedidoItem {
  id: number;
  cliente_nome: string;
  descricao_produto: string;
  status: string;
  data_pedido: string;
  data_entrega: string | null;
  foto_url: string | null;
}

interface ValoresPorMes {
  mes: string;
  label: string;
  valor: number;
}

function formatMoney(val: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ClienteDetailPage() {
  const params = useParams();
  const id = Number(params.id);

  const [cliente, setCliente] = useState<ClienteDetail | null>(null);
  const [pedidos, setPedidos] = useState<PedidoItem[]>([]);
  const [valoresPorMes, setValoresPorMes] = useState<ValoresPorMes[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editingMedidas, setEditingMedidas] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState<Partial<ClienteDetail>>({});
  const [medidas, setMedidas] = useState<Record<string, number>>({});

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/v1/clientes/${id}`).then((r) =>
        r.ok ? r.json() : Promise.reject()
      ),
      fetch(`${API_URL}/api/v1/clientes/${id}/pedidos?limit=10`).then((r) =>
        r.ok ? r.json() : []
      ),
      fetch(`${API_URL}/api/v1/clientes/${id}/valores-por-mes?meses=12`).then(
        (r) => (r.ok ? r.json() : [])
      ),
    ])
      .then(([c, p, v]) => {
        setCliente(c);
        setForm({
          nome: c.nome,
          telefone: c.telefone,
          email: c.email,
          endereco: c.endereco,
          cpf: c.cpf,
          rg: c.rg,
        });
        setPedidos(p);
        setValoresPorMes(v);
        const m: Record<string, number> = {};
        MEDIDAS_CAMPOS.forEach(({ key }) => {
          const v = c[key];
          if (v != null && v > 0) m[key] = v;
        });
        setMedidas(m);
      })
      .catch(() => setCliente(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setFormError("");
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (editingMedidas || editing) {
        payload.flag_medidas = Object.values(medidas).some((v) => v > 0);
        MEDIDAS_CAMPOS.forEach(({ key }) => {
          const v = medidas[key];
          payload[key] = v != null && v > 0 ? v : null;
        });
      }
      const res = await fetch(`${API_URL}/api/v1/clientes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.detail || "Erro ao salvar. Verifique se o nome já existe.");
        setSaving(false);
        return;
      }
      setCliente(data);
      setForm(data);
      const m: Record<string, number> = {};
      MEDIDAS_CAMPOS.forEach(({ key }) => {
        const v = data[key];
        if (v != null && v > 0) m[key] = v;
      });
      setMedidas(m);
      setEditing(false);
      setEditingMedidas(false);
    } catch {
      setFormError("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="p-4">
        <p className="text-gray-500">Cliente não encontrado.</p>
        <Link href="/mobile/clientes">
          <Button variant="outline" className="mt-2">
            Voltar à lista
          </Button>
        </Link>
      </div>
    );
  }

  const temMedidas = MEDIDAS_CAMPOS.some(
    ({ key }) => medidas[key] != null && medidas[key] > 0
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pb-24">
      <div className="flex items-center gap-2">
        <Link href="/mobile/clientes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-gray-900">
            {editing ? "Editar Cliente" : cliente.nome}
          </h2>
          <p className="text-sm text-gray-500">Detalhes do cliente</p>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
        )}
      </div>

      {/* Nome e contato */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        {editing ? (
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={form.nome ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nome: e.target.value }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={form.telefone ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, telefone: e.target.value }))
                }
                className="mt-1"
                placeholder="(16) 99999-9999"
              />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                className="mt-1"
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <Label>Endereço</Label>
              <Input
                value={form.endereco ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endereco: e.target.value }))
                }
                className="mt-1"
              />
            </div>
          </div>
        ) : (
          <>
            <p className="text-lg font-semibold text-gray-900">{cliente.nome}</p>
            <div className="mt-3 space-y-2">
              {cliente.telefone && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <a
                    href={`tel:${cliente.telefone}`}
                    className="text-sm hover:text-red-600"
                  >
                    {cliente.telefone}
                  </a>
                </div>
              )}
              {cliente.email && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <a
                    href={`mailto:${cliente.email}`}
                    className="text-sm hover:text-red-600 break-all"
                  >
                    {cliente.email}
                  </a>
                </div>
              )}
              {!cliente.telefone && !cliente.email && (
                <p className="text-sm text-gray-500">
                  Telefone e e-mail não cadastrados
                </p>
              )}
            </div>
            {(cliente.endereco || cliente.cpf || cliente.rg) && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-1 text-sm text-gray-600">
                {cliente.endereco && <p>Endereço: {cliente.endereco}</p>}
                {cliente.cpf && <p>CPF: {cliente.cpf}</p>}
                {cliente.rg && <p>RG: {cliente.rg}</p>}
              </div>
            )}
          </>
        )}
      </div>

      {/* Medidas */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Ruler className="h-4 w-4" />
            Medidas (cm)
          </h3>
          {!editing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingMedidas(true)}
            >
              <Pencil className="h-4 w-4 mr-1" />
              Editar
            </Button>
          )}
        </div>
        {editingMedidas || editing ? (
          <div className="grid grid-cols-3 gap-3">
            {MEDIDAS_CAMPOS.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs text-gray-500">{label}</Label>
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
        ) : temMedidas ? (
          <div className="grid grid-cols-3 gap-2">
            {MEDIDAS_CAMPOS.filter(
              ({ key }) => medidas[key] != null && medidas[key] > 0
            ).map(({ key, label }) => (
              <div
                key={key}
                className="py-2 px-3 rounded-lg bg-gray-50 text-center"
              >
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-sm font-medium">{medidas[key]}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Nenhuma medida cadastrada</p>
        )}
      </div>

      {formError && (
        <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          {formError}
        </p>
      )}
      {(editing || editingMedidas) && (
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setEditing(false);
              setEditingMedidas(false);
              setForm(cliente);
              const m: Record<string, number> = {};
              MEDIDAS_CAMPOS.forEach(({ key }) => {
                const v = cliente[key as keyof ClienteDetail];
                if (typeof v === "number" && v > 0) m[key] = v;
              });
              setMedidas(m);
            }}
          >
            Cancelar
          </Button>
        </div>
      )}

      {/* Gráfico valores gastos por mês */}
      {valoresPorMes.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-4">
            Valores gastos por mês
          </h3>
          <div className="h-[200px]">
            <ResponsiveContainer
                width="100%"
                height="100%"
                minHeight={200}
                initialDimension={{ width: 300, height: 200 }}
              >
              <BarChart
                data={valoresPorMes}
                margin={{ top: 5, right: 5, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => v.split("/")[0]}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) =>
                    v >= 1000 ? `${v / 1000}k` : String(v)
                  }
                />
                <Tooltip
                  formatter={(val: number | undefined) => [val != null ? formatMoney(val) : "", "Valor"]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                  }}
                  labelFormatter={(l) => `Mês: ${l}`}
                />
                <Bar
                  dataKey="valor"
                  fill="#dc2626"
                  radius={[4, 4, 0, 0]}
                  name="Valor"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Últimos 10 pedidos */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <Package className="h-4 w-4" />
          Últimos pedidos
        </h3>
        {pedidos.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum pedido registrado</p>
        ) : (
          <div className="space-y-2">
            {pedidos.map((p) => (
              <Link
                key={p.id}
                href={`/mobile/pedidos/${p.id}`}
                className="block py-3 px-3 rounded-lg border border-gray-100 hover:bg-gray-50"
              >
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {p.descricao_produto || "Sem descrição"}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDate(p.data_pedido)}
                      {p.data_entrega && ` → ${formatDate(p.data_entrega)}`}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${
                      p.status === "Entregue"
                        ? "bg-green-100 text-green-800"
                        : p.status === "Orçamento"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
