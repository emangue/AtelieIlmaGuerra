"""
Perfis de acesso.

O ateliê tem dois sites com bases parcialmente compartilhadas:

- gestão (este app)         — acesso total: pedidos, financeiro, plano, despesas
- atendimento (:8002)       — só clientes e pedidos aguardando aprovação

`atendimento` é uma role de acesso restrito: entra apenas no site de atendimento.
`admin` entra nos dois. `user` só na gestão.
"""

ROLE_ADMIN = "admin"
ROLE_USER = "user"
ROLE_ATENDIMENTO = "atendimento"

ROLES_VALIDAS = (ROLE_ADMIN, ROLE_USER, ROLE_ATENDIMENTO)

# Quem pode fazer login no app de gestão.
ROLES_GESTAO = (ROLE_ADMIN, ROLE_USER)

# Quem pode fazer login no app de atendimento (espelhado em app_atendimento).
ROLES_ATENDIMENTO = (ROLE_ADMIN, ROLE_ATENDIMENTO)

ROLE_LABELS = {
    ROLE_ADMIN: "Administrador",
    ROLE_USER: "Usuário",
    ROLE_ATENDIMENTO: "Atendimento",
}
