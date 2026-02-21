# 🔐 Resumo da Estrutura de Segurança

**Baseado em:** ProjetoFinancasV5 (meufinup.com.br)  
**Data:** 14/02/2026

---

## ✅ O que foi implementado

### Backend (FastAPI)

| Item | Status | Descrição |
|------|--------|-----------|
| JWT | ✅ | Tokens com expiração configurável (60 min padrão) |
| Bcrypt | ✅ | Hash de senhas (12 salt rounds) |
| Cookie HttpOnly | ✅ | `auth_token` com Secure em produção |
| Endpoints auth | ✅ | `/login`, `/me`, `/logout` |
| CORS | ✅ | Restrito a origens configuradas |

### Frontend (Next.js)

| Item | Status | Descrição |
|------|--------|-----------|
| AuthContext | ✅ | Login, logout, loadUser, token em localStorage |
| api-client | ✅ | Fetch com credentials + tratamento 401 → redirect login |
| Middleware | ✅ | Protege `/mobile/*` – redirect para login sem cookie |
| Header | ✅ | Botão Entrar/Sair conforme estado de auth |
| Redirect pós-login | ✅ | Usa `?redirect=` para voltar à página original |

### Fluxo de autenticação

1. Usuário acessa `/mobile/*` → middleware verifica cookie `auth_token`
2. Sem cookie → redirect para `/auth/login?redirect=/mobile/...`
3. Login → backend retorna token + seta cookie
4. Frontend salva token em localStorage (para api-client)
5. Requisições usam `credentials: "include"` + `Authorization: Bearer <token>`
6. 401 → api-client limpa auth e redireciona para `/auth/login`
7. Logout → limpa cookie, localStorage e estado

---

## 📁 Arquivos criados/alterados

- `app_dev/frontend/src/lib/api-client.ts` – Cliente API com auth
- `app_dev/frontend/src/middleware.ts` – Proteção de rotas
- `app_dev/frontend/src/components/mobile/header-auth.tsx` – Entrar/Sair
- `app_dev/frontend/src/contexts/AuthContext.tsx` – Token em localStorage
- `app_dev/backend/app/core/config.py` – `is_production`
- `docs/deploy/GUIA_DEPLOY_GESTAO.md` – Guia de deploy
- `app_dev/backend/.env.example` – Exemplo de variáveis
- `app_dev/frontend/.env.production.example` – Exemplo produção

---

## 🔒 Proteção de rotas no backend (opcional)

Para exigir login em rotas específicas, use a dependência do auth:

```python
from app.domains.auth.router import get_user_id_from_token

@router.get("/protegido")
def rota_protegida(user_id: int = Depends(get_user_id_from_token)):
    ...
```

Rotas sem essa dependência continuam públicas.

---

## ⏱ Tempo máximo logado

Configurado em `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` (padrão: 60 min).  
Após expirar, o próximo request retorna 401 e o usuário é redirecionado para login.
