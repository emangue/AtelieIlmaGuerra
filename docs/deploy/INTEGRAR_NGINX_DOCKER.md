# Integração Ateliê no Nginx Docker (FinUp)

O Ateliê roda fora do Docker (systemd). Para funcionar, sua config é adicionada ao Nginx do FinUp.

## Deploy (local → SSH)

Usa o mesmo padrão do ProjetoFinancasV5: alias `minha-vps-hostinger` no `~/.ssh/config` (porta 50022).

```bash
# Na sua máquina, dentro do AtelieIlmaGuerra
./scripts/deploy/deploy_atelie.sh
```

Variáveis em `scripts/deploy/config.sh`:
- `VM_HOST` — alias SSH (padrão: minha-vps-hostinger)
- `ATELIE_PATH` — pasta do Ateliê no servidor (padrão: /var/www/atelie)
- `FINUP_PATH` — pasta do FinUp/Docker no servidor (padrão: /var/www/finup)

Se o FinUp estiver em outro caminho: `FINUP_PATH=/var/www/ProjetoFinancasV5 ./scripts/deploy/deploy_atelie.sh`

## Pré-requisito: extra_hosts

O `docker-compose.prod.yml` do FinUp precisa ter no serviço nginx:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

Se não tiver, adicione manualmente e rode `docker compose up -d nginx`.

## Arquivos

- `scripts/atelie-gestao-nginx.conf` — config copiada para o Nginx do FinUp
- `scripts/deploy/config.sh` — VM_HOST, ATELIE_PATH, FINUP_PATH
- `scripts/deploy/deploy_atelie.sh` — deploy via SSH (igual ao FinUp)
