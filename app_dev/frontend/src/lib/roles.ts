// Espelha app_dev/backend/app/domains/users/roles.py — mantido em sincronia manual.

export interface UserItem {
  id: number;
  email: string;
  nome: string;
  role: string;
  ativo: number;
}

/**
 * Perfis de acesso. `atendimento` é restrito: entra apenas em
 * atendimento.atelieilmaguerra.com.br, e não vê financeiro, plano nem parâmetros.
 */
export const ROLES = [
  { valor: "user", rotulo: "Usuário", curto: "Usuário", sub: "Acesso ao sistema de gestão" },
  { valor: "admin", rotulo: "Administrador", curto: "Admin", sub: "Acesso total, incluindo usuários" },
  {
    valor: "atendimento",
    rotulo: "Atendimento",
    curto: "Atendimento",
    sub: "Só o site de atendimento: clientes e pedidos para aprovação",
  },
];

export function rotuloRole(role: string, curto = false): string {
  const r = ROLES.find((x) => x.valor === role);
  if (!r) return role;
  return curto ? r.curto : r.rotulo;
}
