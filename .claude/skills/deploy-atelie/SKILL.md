# /deploy-atelie — Deploy do Ateliê Ilma Guerra na VPS

Sincroniza o código local, roda migrações necessárias, rebuilda o frontend e valida que o site está funcionando — incluindo checagem de segurança.

## Contexto fixo

| Item | Valor |
|---|---|
| VPS | `minha-vps-hostinger` (148.230.78.91) |
| Local | `/Users/emangue/Documents/ProjetoVSCode/AtelieIlmaGuerra/app_dev/` |
| VPS path | `/var/www/atelie/app_dev/` |
| Backend | systemd `atelie-backend` → porta 8001 (uvicorn/FastAPI) |
| Frontend | systemd `atelie-frontend` → porta 3004 (Next.js 15) |
| Banco | SQLite em `/var/www/atelie/app_dev/backend/database/atelie.db` |
| Domínio | `https://gestao.atelieilmaguerra.com.br` |

### Segundo app: site de atendimento

| Item | Valor |
|---|---|
| Local | `/Users/emangue/Documents/ProjetoVSCode/AtelieIlmaGuerra/app_atendimento/` |
| VPS path | `/var/www/atelie/app_atendimento/` |
| Backend | systemd `atelie-atendimento-backend` → porta 8002 |
| Frontend | systemd `atelie-atendimento-frontend` → porta 3005 |
| Banco | **o mesmo** `atelie.db` do gestão (só users, clientes, pedidos_atendimento, historico) |
| Domínio | `https://atendimento.atelieilmaguerra.com.br` |

> Os dois apps compartilham o arquivo SQLite, mas **só o backend de gestão cria e
> altera schema**. Ao deployar mudanças de tabela, suba o gestão primeiro — o
> `create_all`/migrations do startup dele é que preparam o banco para os dois.

Se o deploy mexe só no gestão, siga os passos 0–7 e ignore a seção
"Deploy do site de atendimento" no fim deste arquivo.

---

## Passo 0 — Limpeza de arquivos duplicados do Finder (SEMPRE antes de qualquer coisa)

> O macOS Finder cria cópias com espaço no nome (`page 2.tsx`, `router 2.py`). Se não removidos, o rsync os envia para a VM e podem mascarar os arquivos reais — já causou bugs em produção.

```bash
# Remover duplicatas locais
LOCAL_DUPS=$(find /Users/emangue/Documents/ProjetoVSCode/AtelieIlmaGuerra/app_dev -name "* 2.*" -o -name "* 3.*" 2>/dev/null | grep -v venv | wc -l | tr -d ' ')
if [ "$LOCAL_DUPS" -gt 0 ]; then
  echo "⚠️  $LOCAL_DUPS duplicatas locais — removendo..."
  find /Users/emangue/Documents/ProjetoVSCode/AtelieIlmaGuerra/app_dev -name "* 2.*" -not -path "*/venv/*" -delete -print
  find /Users/emangue/Documents/ProjetoVSCode/AtelieIlmaGuerra/app_dev -name "* 3.*" -not -path "*/venv/*" -delete -print
else
  echo "✅ Nenhuma duplicata local"
fi

# Remover duplicatas na VM
VM_DUPS=$(ssh minha-vps-hostinger 'find /var/www/atelie/app_dev -name "* 2.*" -o -name "* 3.*" 2>/dev/null | wc -l')
if [ "$VM_DUPS" -gt 0 ]; then
  echo "⚠️  $VM_DUPS duplicatas na VM — removendo..."
  ssh minha-vps-hostinger 'find /var/www/atelie/app_dev -name "* 2.*" -delete -print; find /var/www/atelie/app_dev -name "* 3.*" -delete -print'
else
  echo "✅ Nenhuma duplicata na VM"
fi
```

---

## Passo 1 — Validação local antes de enviar

```bash
cd /Users/emangue/Documents/ProjetoVSCode/AtelieIlmaGuerra/app_dev/frontend

# Build local deve passar sem erros antes de qualquer deploy
npm run build 2>&1 | tail -20
```

**Se o build falhar, pare aqui e corrija. Nunca faça deploy com build quebrado.**

Checagens adicionais:

```bash
# NEXT_PUBLIC_BACKEND_URL JAMAIS deve conter localhost — vaza para o browser e causa CORS
# O valor correto em produção é VAZIO (usa URLs relativas, roteadas pelo nginx)
grep 'NEXT_PUBLIC_BACKEND_URL' \
  /Users/emangue/Documents/ProjetoVSCode/AtelieIlmaGuerra/app_dev/frontend/.env* 2>/dev/null \
  && echo "ATENÇÃO: verificar se NEXT_PUBLIC_BACKEND_URL está vazia ou aponta para domínio público" \
  || echo "OK: sem .env local com NEXT_PUBLIC_BACKEND_URL"
```

---

## Passo 2 — Verificar estado da VPS antes do deploy

```bash
ssh minha-vps-hostinger "
echo '=== Serviços ==='
sudo systemctl status atelie-backend atelie-frontend --no-pager | grep -E 'Active|Main PID'

echo '=== Espaço em disco ==='
df -h / | tail -1

echo '=== Banco acessível ==='
sqlite3 /var/www/atelie/app_dev/backend/database/atelie.db 'SELECT COUNT(*) FROM pedidos' \
  && echo 'DB OK' || echo 'ERRO: banco inacessível'

echo '=== Backup do banco antes de qualquer mudança ==='
cp /var/www/atelie/app_dev/backend/database/atelie.db \
   /var/www/atelie/app_dev/backend/database/atelie_backup_pre_deploy_\$(date +%Y%m%d_%H%M%S).db \
   && echo 'Backup criado'

echo '=== NEXT_PUBLIC_BACKEND_URL na VM (deve estar VAZIA) ==='
grep 'NEXT_PUBLIC_BACKEND_URL' /var/www/atelie/app_dev/frontend/.env.local 2>/dev/null \
  && echo 'ATENÇÃO: verificar valor acima — se tiver localhost, CORRIGIR ANTES DO BUILD' \
  || echo 'OK: variável não definida (usará URL relativa)'
"
```

> ⚠️ **CRÍTICO — `.env.local` na VM:**
> - `NEXT_PUBLIC_BACKEND_URL` deve estar **VAZIA** ou **ausente**
> - `BACKEND_URL=http://localhost:8001` (só backend, não vaza para o browser)
> - Se `NEXT_PUBLIC_BACKEND_URL=http://localhost:8001` estiver definida, o browser vai chamar o backend diretamente → CORS bloqueado → site quebrado
> - Corrigir antes do build: `echo "NEXT_PUBLIC_BACKEND_URL=\nBACKEND_URL=http://localhost:8001" > /var/www/atelie/app_dev/frontend/.env.local`

---

## Passo 3 — Sincronizar código para a VPS

> **CRÍTICO: sempre excluir `venv/` e `database/`.**
> O rsync sem esses excludes sobrescreve o venv da VM com o venv do Mac (shebangs
> apontam para `/Users/emangue/...` e o uvicorn para de funcionar) e pode apagar o banco.

```bash
rsync -avz \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='database/' \
  --exclude='venv/' \
  --exclude='.git' \
  /Users/emangue/Documents/ProjetoVSCode/AtelieIlmaGuerra/app_dev/ \
  minha-vps-hostinger:/var/www/atelie/app_dev/ 2>&1
```

> ⚠️ **ATENÇÃO:** O rsync **não exclui** `.env.local` — ele sobrescreve o `.env.local` da VM com o do Mac.
> Por isso o `.env.local` do Mac já deve ter `NEXT_PUBLIC_BACKEND_URL=` (vazio). Confirme antes de rodar:
> ```bash
> grep 'NEXT_PUBLIC_BACKEND_URL' /Users/emangue/Documents/ProjetoVSCode/AtelieIlmaGuerra/app_dev/frontend/.env.local
> # Deve mostrar: NEXT_PUBLIC_BACKEND_URL=   (sem valor após o =)
> ```

---

## Passo 4 — Verificar e rodar migrações do banco

> **Avaliar antes de rodar.** A migração só é necessária se o deploy adiciona/altera colunas.
> Se for só mudança de lógica/frontend, pule este passo.

```bash
ssh minha-vps-hostinger "
python3 - <<'PYEOF'
import sqlite3
conn = sqlite3.connect('/var/www/atelie/app_dev/backend/database/atelie.db')

expected = {
    'pedidos': {
        'id','cliente_id','tipo_pedido_id','forma_peca_id','data_pedido','data_entrega',
        'descricao_produto','status','valor_pecas','quantidade_pecas','horas_trabalho',
        'custo_materiais','custos_variaveis','margem_real','forma_pagamento','valor_entrada',
        'valor_restante','detalhes_pagamento','pagamento_na_entrega','percentual_lucro_dono',
        'param_preco_hora','param_impostos','param_cartao_credito','param_total_horas_mes',
        'param_margem_target','medidas_disponiveis','medida_ombro','medida_busto',
        'medida_cinto','medida_quadril','medida_comprimento_corpo','medida_comprimento_vestido',
        'medida_distancia_busto','medida_raio_busto','medida_altura_busto','medida_frente',
        'medida_costado','medida_comprimento_calca','medida_comprimento_blusa',
        'medida_largura_manga','medida_comprimento_manga','medida_punho',
        'medida_comprimento_saia','medida_comprimento_bermuda','comentario_medidas',
        'fotos_disponiveis','observacao_pedido','foto_url','foto_url_2','foto_url_3',
        'comentario_foto_1','comentario_foto_2','comentario_foto_3',
        'appsheet_id','created_at','updated_at',
    },
    'pagamentos': {
        'id','anomes','tipo','origem','pedido_id','plano_item_id','despesa_id',
        'data','data_vencimento','data_pagamento','parcela_numero','parcela_total',
        'taxa_cartao','categoria','tipo_item','valor','descricao','created_at',
    },
}

all_ok = True
for table, cols in expected.items():
    cur = conn.execute(f'PRAGMA table_info({table})')
    db_cols = {r[1] for r in cur.fetchall()}
    missing = cols - db_cols
    if missing:
        print(f'FALTANDO em {table}: {missing}')
        all_ok = False
    else:
        print(f'{table}: OK ({len(db_cols)} colunas)')

conn.close()
if all_ok:
    print('Banco em dia — sem migrações necessárias')
PYEOF
"
```

Se houver colunas faltando, adicionar via `ALTER TABLE ... ADD COLUMN` ou rodar o script `migrate_2026_06.py`.

---

## Passo 5 — Reiniciar o backend

```bash
ssh minha-vps-hostinger "
sudo systemctl restart atelie-backend
sleep 3
sudo systemctl status atelie-backend --no-pager | head -8
head -1 /var/www/atelie/app_dev/backend/venv/bin/uvicorn
"
```

**Se o shebang mostrar `/Users/emangue/...`**, o venv foi sobrescrito. Recriar:

```bash
ssh minha-vps-hostinger "
cd /var/www/atelie/app_dev/backend
rm -rf venv
python3 -m venv venv
venv/bin/pip install -r requirements.txt
sudo systemctl restart atelie-backend
"
```

---

## Passo 6 — Build e reinício do frontend

> **ANTES do build, confirmar que `.env.local` na VM tem `NEXT_PUBLIC_BACKEND_URL=` VAZIO.**
> Se tiver `localhost:8001`, o browser vai chamar o backend diretamente → CORS → site quebrado.
> O `NEXT_PUBLIC_*` é embutido no bundle em tempo de build — rebuild obrigatório após correção.

```bash
ssh minha-vps-hostinger "
# Confirmar .env.local correto antes de buildar
cat /var/www/atelie/app_dev/frontend/.env.local
# Deve mostrar: NEXT_PUBLIC_BACKEND_URL= (vazio) e BACKEND_URL=http://localhost:8001
"
```

Se `NEXT_PUBLIC_BACKEND_URL` tiver qualquer valor com `localhost`, corrigir agora:

```bash
ssh minha-vps-hostinger "
cat > /var/www/atelie/app_dev/frontend/.env.local << 'EOF'
NEXT_PUBLIC_BACKEND_URL=
BACKEND_URL=http://localhost:8001
EOF
echo 'env.local corrigido'
"
```

Então buildar:

```bash
ssh minha-vps-hostinger "
sudo systemctl stop atelie-frontend
rm -rf /var/www/atelie/app_dev/frontend/.next
cd /var/www/atelie/app_dev/frontend && npm run build 2>&1 | tail -15
"
```

Após build bem-sucedido:

```bash
ssh minha-vps-hostinger "
# Confirmar que localhost:8001 não vazou para o bundle
grep -r 'localhost:8001' /var/www/atelie/app_dev/frontend/.next/static/ 2>/dev/null \
  && echo 'FALHA: URL de backend no bundle JS — corrigir .env.local e rebuildar' \
  || echo 'OK: sem localhost no bundle'

ls /var/www/atelie/app_dev/frontend/.next/prerender-manifest.json && echo 'Build OK'
sudo systemctl start atelie-frontend
sleep 8
curl -s -o /dev/null -w '%{http_code}' http://localhost:3004
"
```

**307 = OK** (redirect para login — comportamento normal do Next.js).

---

## Passo 7 — Validação final

```bash
# Site público respondendo
curl -sf -o /dev/null -w 'Site público: %{http_code}\n' \
  https://gestao.atelieilmaguerra.com.br/

ssh minha-vps-hostinger "
echo '=== Serviços finais ==='
sudo systemctl status atelie-backend atelie-frontend --no-pager | grep -E 'Active|Main PID'

echo '=== Backend responde ==='
curl -s -o /dev/null -w '%{http_code}' http://localhost:8001/api/v1/pedidos/ativos

echo '=== JWT bloqueando sem token ==='
CODE=\$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8001/api/v1/auth/me)
[ \"\$CODE\" = '401' ] && echo 'OK: 401 sem token' || echo 'Retornou '\$CODE

echo '=== Headers de segurança (nginx) ==='
curl -sI https://gestao.atelieilmaguerra.com.br/ 2>/dev/null | grep -E 'X-Frame|X-Content|Strict-Transport'

echo '=== Porta 8001 não exposta externamente ==='
curl -s --connect-timeout 3 -o /dev/null -w '%{http_code}' http://148.230.78.91:8001/ \
  && echo 'ATENÇÃO: porta 8001 pública!' || echo 'OK: porta 8001 interna'
"
```

---

## Critérios de sucesso

- [ ] Nenhuma duplicata `* 2.*` local ou na VM
- [ ] Build local passou sem erros TypeScript
- [ ] `NEXT_PUBLIC_BACKEND_URL=` **VAZIA** no `.env.local` da VM
- [ ] `npm run build` na VM completou sem erros
- [ ] `localhost:8001` **não aparece** no bundle `.next/static/`
- [ ] `venv/bin/uvicorn` shebang aponta para `/var/www/atelie/...` (não para `/Users/emangue/...`)
- [ ] Frontend responde 307 em `http://localhost:3004`
- [ ] Site público retorna 2xx/3xx em `https://gestao.atelieilmaguerra.com.br/`
- [ ] Banco tem todas as colunas esperadas (nenhuma 500 no backend)

---

## Deploy do site de atendimento (`app_atendimento/`)

> Rode **depois** do deploy do gestão quando houver mudança de schema: o backend
> de gestão é o dono do DDL; o de atendimento assume o banco pronto.

### Primeira vez na VM (setup, só uma vez)

```bash
# 1. DNS: criar registro A "atendimento" -> 148.230.78.91 no painel do domínio.
#    Confirmar antes de seguir:
dig +short atendimento.atelieilmaguerra.com.br

# 2. Certificado (certbot do FinUp)
ssh minha-vps-hostinger "
cd /opt/finup && docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  -d atendimento.atelieilmaguerra.com.br --agree-tos --no-eff-email -m emanuelgleandro@gmail.com
"

# 3. nginx
scp /Users/emangue/Documents/ProjetoVSCode/AtelieIlmaGuerra/scripts/atelie-atendimento-nginx.conf \
  minha-vps-hostinger:/var/www/infra/nginx/conf.d/atendimento.atelieilmaguerra.com.br.conf
ssh minha-vps-hostinger "docker exec infra_nginx nginx -t && docker exec infra_nginx nginx -s reload"

# 4. systemd
scp /Users/emangue/Documents/ProjetoVSCode/AtelieIlmaGuerra/scripts/deploy/atelie-atendimento-*.service \
  minha-vps-hostinger:/tmp/
ssh minha-vps-hostinger "
sudo mv /tmp/atelie-atendimento-*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable atelie-atendimento-backend atelie-atendimento-frontend
"

# 5. .env do backend — JWT_SECRET_KEY OBRIGATORIAMENTE diferente do gestão
ssh minha-vps-hostinger "
mkdir -p /var/www/atelie/app_atendimento/backend
SEGREDO=\$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')
cat > /var/www/atelie/app_atendimento/backend/.env <<EOF
DEBUG=false
DATABASE_PATH=/var/www/atelie/app_dev/backend/database/atelie.db
UPLOADS_DIR=/var/www/atelie/app_dev/backend/uploads
BACKEND_CORS_ORIGINS=https://atendimento.atelieilmaguerra.com.br
HOST=0.0.0.0
PORT=8002
JWT_SECRET_KEY=\$SEGREDO
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
EOF
chmod 600 /var/www/atelie/app_atendimento/backend/.env
# Conferir que o segredo é diferente do gestão:
diff <(grep JWT_SECRET_KEY /var/www/atelie/app_dev/backend/.env) \
     <(grep JWT_SECRET_KEY /var/www/atelie/app_atendimento/backend/.env) >/dev/null \
  && echo 'FALHA: mesmo JWT_SECRET_KEY dos dois lados — trocar!' \
  || echo 'OK: segredos diferentes'
"

# 6. .env.local do frontend
ssh minha-vps-hostinger "
mkdir -p /var/www/atelie/app_atendimento/frontend
printf 'NEXT_PUBLIC_BACKEND_URL=\nBACKEND_URL=http://localhost:8002\n' \
  > /var/www/atelie/app_atendimento/frontend/.env.local
"
```

### A cada deploy

```bash
# Build local primeiro — nunca deployar com build quebrado
cd /Users/emangue/Documents/ProjetoVSCode/AtelieIlmaGuerra/app_atendimento/frontend && npm run build 2>&1 | tail -15
```

```bash
# rsync (mesmas regras do gestão: nunca --delete, sempre excluir venv/ e .next)
rsync -avz \
  --exclude='node_modules' --exclude='.next' --exclude='__pycache__' --exclude='*.pyc' \
  --exclude='venv/' --exclude='.git' --exclude='.env' \
  /Users/emangue/Documents/ProjetoVSCode/AtelieIlmaGuerra/app_atendimento/ \
  minha-vps-hostinger:/var/www/atelie/app_atendimento/
```

```bash
ssh minha-vps-hostinger "
set -e
cd /var/www/atelie/app_atendimento/backend
[ -d venv ] || python3 -m venv venv
venv/bin/pip install -q -r requirements.txt
sudo systemctl restart atelie-atendimento-backend
sleep 3
curl -s -o /dev/null -w 'backend :8002 -> %{http_code}\n' http://localhost:8002/api/health

sudo systemctl stop atelie-atendimento-frontend
rm -rf /var/www/atelie/app_atendimento/frontend/.next
cd /var/www/atelie/app_atendimento/frontend
npm ci --omit=dev --no-audit --no-fund || npm install
npm run build 2>&1 | tail -15
sudo systemctl start atelie-atendimento-frontend
sleep 8
curl -s -o /dev/null -w 'frontend :3005 -> %{http_code}\n' http://localhost:3005
"
```

### Validação do isolamento (rodar SEMPRE após deploy do atendimento)

```bash
ssh minha-vps-hostinger "
echo '=== A API de atendimento não pode ter rota de dado sensível ==='
for r in pedidos plano despesas financeiro parametros dashboard contracts logs users; do
  CODE=\$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8002/api/v1/\$r)
  [ \"\$CODE\" = '404' ] && echo \"  OK  /\$r -> 404 (rota não existe)\" || echo \"  ATENÇÃO /\$r -> \$CODE\"
done

echo '=== Login de gestão recusado no atendimento e vice-versa ==='
curl -s -o /dev/null -w '  gestão:8001 sem token -> %{http_code}\n'      http://localhost:8001/api/v1/auth/me
curl -s -o /dev/null -w '  atendimento:8002 sem token -> %{http_code}\n' http://localhost:8002/api/v1/auth/me

echo '=== Schema da API fechado em produção (DEBUG=false) ==='
curl -s -o /dev/null -w '  /openapi.json -> %{http_code} (esperado 404)\n' http://localhost:8002/openapi.json
"

# Portas internas não expostas — SEMPRE do Mac, nunca por SSH de dentro da VM
# (curl de dentro da VM para o próprio IP público dá falso positivo)
for p in 8001 8002 3004 3005; do
  curl -s --connect-timeout 3 -o /dev/null -w "porta $p: %{http_code}\n" http://148.230.78.91:$p/ \
    || echo "porta $p: OK (bloqueada)"
done

curl -sf -o /dev/null -w 'Site de atendimento: %{http_code}\n' https://atendimento.atelieilmaguerra.com.br/
```

### Criar o login do ajudante

Pela tela **Perfil** do sistema de gestão (a Ilma faz sozinha): novo usuário com
função **Atendimento**. Esse perfil não entra no gestão — o login lá devolve 403.

---

## Problemas conhecidos e soluções

| Problema | Causa | Solução |
|---|---|---|
| CORS bloqueado — `ERR_FAILED` no browser | `NEXT_PUBLIC_BACKEND_URL=http://localhost:8001` no `.env.local` do Mac ou da VM | Zerar a variável **no Mac** (rsync copia para VM), rebuildar o frontend |
| `localhost:8001` no bundle JS mesmo com var vazia | rsync sobrescreveu `.env.local` correto da VM com `.env.local` errado do Mac | Corrigir `.env.local` do Mac primeiro, depois rsync + rebuild |
| `uvicorn: No such file or directory` | rsync sobrescreveu o venv com o do Mac | Excluir `venv/` do rsync; recriar venv na VM |
| Build corrompe / `.next` inválido | Dois builds simultâneos | Parar `atelie-frontend` ANTES do build; apagar `.next/` e rebuildar |
| `500 no such column: X` | Coluna nova no modelo Python não existe no SQLite da VM | `ALTER TABLE ... ADD COLUMN` ou rodar script de migração |
| `502 Bad Gateway` | Frontend ou backend não está rodando | Verificar `systemctl status` e logs com `journalctl -u` |
| Página velha em produção | Arquivo `page 2.tsx` mascarando o arquivo real | Rodar limpeza de duplicatas (Passo 0) |
| Foto com `ERR_HTTP2_PROTOCOL_ERROR` | Permissão `-rw-------` no arquivo de upload | `chown deploy:deploy` + `chmod 644` no arquivo específico |
| `database is locked` em qualquer um dos dois apps | Escrita simultânea gestão/atendimento sem WAL | Confirmar `PRAGMA journal_mode` = `wal` nos dois `core/database.py`; checar com `sqlite3 atelie.db 'PRAGMA journal_mode'` |
| Atendimento com `no such table: pedidos_atendimento` | Deploy do atendimento antes do gestão criar a tabela | Reiniciar `atelie-backend` (o startup dele roda o `create_all`), depois o de atendimento |
| Login do atendimento funciona no gestão (ou vice-versa) | Mesmo `JWT_SECRET_KEY` nos dois `.env` | Gerar segredo novo para `app_atendimento/backend/.env` e reiniciar os dois backends |
| Chamadas de `/api` do atendimento devolvem HTML | `matcher` do middleware do Next capturando `/api` | Conferir `app_atendimento/frontend/src/middleware.ts` — `api` e `uploads` precisam estar na exclusão |
