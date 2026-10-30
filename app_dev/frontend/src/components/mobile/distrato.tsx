"use client";

import { useEffect, useState } from "react";
import { FileX2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getToken } from "@/lib/api-client";
import { formatDateOnlyBR, todayLocalISO } from "@/lib/date-utils";
import { formatMoney } from "@/lib/money";

export interface DistratoInfo {
  data: string;
  motivo: string;
  fase: string;
  status_anterior: string | null;
  valor_garantido: number;
  valor_devolvido: number;
  valor_retido: number;
  repasse_funcionaria: number;
  observacao: string | null;
  devolucao_pagamento_id: number | null;
  devolucao_data_prevista: string | null;
  devolucao_data_pagamento: string | null;
  devolucao_forma: string | null;
}

interface DistratoPreview {
  valor_recebido: number;
  valor_cartao_a_cair: number;
  valor_garantido: number;
  valor_a_cancelar: number;
  parcelas_a_cancelar: number;
}

const MOTIVOS: Record<string, string> = {
  cliente: "Desistência da cliente",
  atelie: "Desistência do ateliê",
  outro: "Outro",
};

// Fases da cláusula 4.1 do contrato.
const FASES: Record<string, string> = {
  antes_producao: "Antes da produção",
  em_producao: "Em produção",
  apos_3a_prova: "Após a 3ª prova",
};

const FORMAS_DEVOLUCAO = ["Pix", "Dinheiro", "Transferência", "Estorno no cartão"];

function authFetch(url: string, init?: RequestInit) {
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

// "1.200,50" e "1200.50" valem o mesmo: com vírgula, ponto é milhar.
function parseValor(v: string): number {
  const t = v.trim();
  return parseFloat(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t) || 0;
}

function Linha({ label, valor, destaque }: { label: string; valor: string; destaque?: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-medium ${destaque ?? "text-gray-900"}`}>{valor}</span>
    </div>
  );
}

/** Formulário de distrato, aberto pelo menu de ações do pedido. */
export function DistratoDialog({
  open,
  onOpenChange: setOpen,
  pedidoId,
  clienteNome,
  apiUrl,
  onRegistrado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedidoId: number;
  clienteNome: string;
  apiUrl: string;
  onRegistrado: () => void;
}) {
  const [preview, setPreview] = useState<DistratoPreview | null>(null);
  const [data, setData] = useState(todayLocalISO());
  const [motivo, setMotivo] = useState("cliente");
  const [fase, setFase] = useState("em_producao");
  const [devolvido, setDevolvido] = useState("");
  const [jaDevolvido, setJaDevolvido] = useState(true);
  const [dataDevolucao, setDataDevolucao] = useState(todayLocalISO());
  const [forma, setForma] = useState("Pix");
  const [repasse, setRepasse] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErro(null);
    authFetch(`${apiUrl}/api/v1/pedidos/${pedidoId}/distrato/preview`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setPreview)
      .catch(() => setErro("Não foi possível carregar os valores do pedido."));
  }, [open, apiUrl, pedidoId]);

  const valorDevolvido = parseValor(devolvido);
  const garantido = preview?.valor_garantido ?? 0;
  const retido = Math.max(0, garantido - valorDevolvido);
  const excede = valorDevolvido > garantido + 0.005;

  const registrar = async () => {
    setSaving(true);
    setErro(null);
    try {
      const res = await authFetch(`${apiUrl}/api/v1/pedidos/${pedidoId}/distrato`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          motivo,
          fase,
          valor_devolvido: valorDevolvido,
          devolucao_data_prevista: valorDevolvido > 0 ? dataDevolucao : null,
          devolucao_data_pagamento: valorDevolvido > 0 && jaDevolvido ? dataDevolucao : null,
          devolucao_forma: valorDevolvido > 0 ? forma : null,
          repasse_funcionaria: parseValor(repasse),
          observacao: observacao.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.detail === "string" ? body.detail : "Não foi possível registrar o distrato.");
      }
      setOpen(false);
      onRegistrado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao registrar distrato.");
    } finally {
      setSaving(false);
    }
  };

  return (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg">
              <DialogHeader>
                <DialogTitle>Distrato · {clienteNome}</DialogTitle>
                <DialogDescription>
                  Para quando a cliente desiste depois de já ter pago. Parcelas pendentes são canceladas;
                  cartão já passado continua caindo normalmente.
                </DialogDescription>
              </DialogHeader>

              {!preview ? (
                <div className="flex justify-center py-6">
                  {erro ? <p className="text-sm text-red-600">{erro}</p> : <Loader2 className="h-5 w-5 animate-spin text-gray-400" />}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <Linha label="Já recebido" valor={formatMoney(preview.valor_recebido)} />
                    {preview.valor_cartao_a_cair > 0 && (
                      <Linha label="Cartão ainda a cair" valor={formatMoney(preview.valor_cartao_a_cair)} />
                    )}
                    <Linha label="Total pago pela cliente" valor={formatMoney(garantido)} destaque="text-gray-900 font-semibold" />
                    {preview.parcelas_a_cancelar > 0 && (
                      <Linha
                        label={`Pendente a cancelar (${preview.parcelas_a_cancelar})`}
                        valor={formatMoney(preview.valor_a_cancelar)}
                        destaque="text-gray-400 line-through"
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Data do distrato</Label>
                      <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label>Motivo</Label>
                      <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm">
                        {Object.entries(MOTIVOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label>Fase da peça</Label>
                    <select value={fase} onChange={(e) => setFase(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm">
                      {Object.entries(FASES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>

                  <div>
                    <Label>Valor a devolver</Label>
                    <Input inputMode="decimal" placeholder="0,00" value={devolvido} onChange={(e) => setDevolvido(e.target.value)} className="mt-1" />
                    <p className={`mt-1 text-xs ${excede ? "text-red-600" : "text-gray-500"}`}>
                      {excede ? "Maior que o total pago." : `Fica com o ateliê: ${formatMoney(retido)}`}
                    </p>
                  </div>

                  {valorDevolvido > 0 && (
                    <div className="space-y-3 rounded-lg border border-gray-100 p-3">
                      <div className="flex gap-2">
                        {[true, false].map((v) => (
                          <button
                            key={String(v)}
                            type="button"
                            onClick={() => setJaDevolvido(v)}
                            className={`flex-1 rounded-lg py-2 text-sm font-medium ${jaDevolvido === v ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-700"}`}
                          >
                            {v ? "Já devolvi" : "Vou devolver"}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>{jaDevolvido ? "Devolvido em" : "Devolver até"}</Label>
                          <Input type="date" value={dataDevolucao} onChange={(e) => setDataDevolucao(e.target.value)} className="mt-1" />
                        </div>
                        <div>
                          <Label>Forma</Label>
                          <select value={forma} onChange={(e) => setForma(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm">
                            {FORMAS_DEVOLUCAO.map((f) => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label>Repasse da funcionária</Label>
                    <Input inputMode="decimal" placeholder="0,00" value={repasse} onChange={(e) => setRepasse(e.target.value)} className="mt-1" />
                    <p className="mt-1 text-xs text-gray-500">Quanto ela recebe pelo trabalho já feito. Deixe vazio se nada.</p>
                  </div>

                  <div>
                    <Label>Observação</Label>
                    <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} className="mt-1" />
                  </div>

                  {erro && (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{erro}</p>
                  )}
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                  Voltar
                </Button>
                <Button
                  type="button"
                  onClick={registrar}
                  disabled={saving || !preview || excede}
                  className="bg-purple-600 text-white hover:bg-purple-700"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirmar distrato
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
  );
}

/** Resumo do distrato no detalhe do pedido. */
export function DistratoResumo({ distrato }: { distrato: DistratoInfo }) {
  const devolucaoPendente = distrato.valor_devolvido > 0 && !distrato.devolucao_data_pagamento;
  return (
    <section className="rounded-xl border border-purple-200 bg-white p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-purple-700">
        <FileX2 className="h-4 w-4" />
        Distrato em {formatDateOnlyBR(distrato.data)}
      </h2>
      <div className="divide-y divide-gray-100">
        <Linha label="Motivo" valor={MOTIVOS[distrato.motivo] ?? distrato.motivo} />
        <Linha label="Fase da peça" valor={FASES[distrato.fase] ?? distrato.fase} />
        {distrato.status_anterior && <Linha label="Status antes" valor={distrato.status_anterior} />}
        <Linha label="Pago pela cliente" valor={formatMoney(distrato.valor_garantido)} />
        <Linha label="Devolvido" valor={`− ${formatMoney(distrato.valor_devolvido)}`} destaque="text-red-600" />
        <Linha label="Ficou com o ateliê" valor={formatMoney(distrato.valor_retido)} destaque="text-emerald-600 font-semibold" />
        {distrato.repasse_funcionaria > 0 && (
          <Linha label="Repasse funcionária" valor={formatMoney(distrato.repasse_funcionaria)} />
        )}
      </div>
      {distrato.valor_devolvido > 0 && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${devolucaoPendente ? "bg-amber-50 text-amber-800" : "bg-gray-50 text-gray-600"}`}>
          {devolucaoPendente
            ? `Devolução a fazer até ${formatDateOnlyBR(distrato.devolucao_data_prevista ?? "")}${distrato.devolucao_forma ? ` · ${distrato.devolucao_forma}` : ""}. Confirme no Financeiro quando pagar.`
            : `Devolvido em ${formatDateOnlyBR(distrato.devolucao_data_pagamento ?? "")}${distrato.devolucao_forma ? ` · ${distrato.devolucao_forma}` : ""}.`}
        </p>
      )}
      {distrato.observacao && <p className="mt-3 text-sm text-gray-600">{distrato.observacao}</p>}
    </section>
  );
}
