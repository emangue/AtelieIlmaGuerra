/**
 * Tipos das respostas da API de atendimento.
 * Espelham os schemas Pydantic em app_atendimento/backend/app/domains.
 */

export interface ClienteListItem {
  id: number;
  nome: string;
  telefone: string | null;
  email: string | null;
}

export interface ClienteDetail extends ClienteListItem {
  cpf: string | null;
  rg: string | null;
  endereco: string | null;
  primeiro_agendamento: string | null;
  data_cadastro: string | null;
  flag_medidas: boolean;
  [medida: string]: unknown;
}

export interface TipoPedidoItem {
  id: number;
  nome: string;
}

export interface FormaPecaItem {
  id: number;
  nome: string;
  medidas: string[];
}

export type StatusAprovacao = "pendente" | "aprovado" | "recusado";
export type TipoAtendimento = "pedido" | "orcamento";

export interface AtendimentoListItem {
  id: number;
  tipo: TipoAtendimento;
  cliente_id: number;
  cliente_nome: string;
  tipo_pedido_id: number | null;
  tipo_pedido_nome: string | null;
  forma_peca_nome: string | null;
  descricao_produto: string;
  data_pedido: string;
  data_entrega: string | null;
  quantidade_pecas: number | null;
  valor_combinado: number | null;
  status_aprovacao: StatusAprovacao;
  motivo_recusa: string | null;
  criado_por_nome: string;
  criado_em: string | null;
  revisado_em: string | null;
  foto_url: string | null;
  editavel: boolean;
}

export interface AtendimentoDetail extends AtendimentoListItem {
  forma_peca_id: number | null;
  observacao_atendimento: string | null;
  medidas_disponiveis: boolean | null;
  comentario_medidas: string | null;
  fotos_disponiveis: boolean | null;
  foto_url_2: string | null;
  foto_url_3: string | null;
  comentario_foto_1: string | null;
  comentario_foto_2: string | null;
  comentario_foto_3: string | null;
  [medida: string]: unknown;
}

export interface HistoricoItem {
  id: number;
  criado_em: string;
  user_id: number;
  user_nome: string;
  entidade: string;
  entidade_id: number | null;
  acao: string;
  resumo: string | null;
  diff_json: string | null;
  app: string;
}
