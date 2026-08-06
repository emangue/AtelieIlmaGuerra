# Deploy Source Of Truth — Atelie

Este arquivo existe para eliminar a ambiguidade entre scripts antigos.

## Comando correto

Deploy de codigo sempre com:

```bash
./scripts/deploy.sh
ssh minha-vps-hostinger "cd /var/www/atelie && bash scripts/deploy/pos_deploy_vm.sh"
ssh minha-vps-hostinger "cd /var/www/atelie && bash scripts/validar_deploy_vm.sh"
```

## O que cada arquivo faz

| Arquivo | Usar para deploy de codigo? | Funcao |
|---|---:|---|
| `scripts/deploy.sh` | Sim | Script local canonico: builda frontends e sincroniza o repo para `/var/www/atelie`. |
| `scripts/deploy/pos_deploy_vm.sh` | Sim | Pos-deploy na VM: venv, npm, builds, systemd e restart dos apps. |
| `scripts/validar_deploy_vm.sh` | Sim | Validacao pos-deploy. |
| `deploy/deploy.sh` | Wrapper apenas | Legado; chama `scripts/deploy.sh`. |
| `scripts/deploy/deploy_atelie.sh` | Nao | Apenas integra config do Nginx Docker/FinUp. |
| `scripts/deploy_atelie_servidor.sh` | Nao | Variante manual na VM para Nginx. |

## Contexto atual

- VM: `minha-vps-hostinger`
- Caminho: `/var/www/atelie`
- Gestao:
  - backend: `atelie-backend`, porta `8001`
  - frontend: `atelie-frontend`, porta `3004`
  - dominio: `https://gestao.atelieilmaguerra.com.br`
- Atendimento:
  - backend: `atelie-atendimento-backend`, porta `8002`
  - frontend: `atelie-atendimento-frontend`, porta `3005`
  - dominio: `https://atendimento.atelieilmaguerra.com.br`

## Regra pratica

Se a tarefa disser "deploy do Atelie", "subir versao", "publicar atual" ou
"commit e deploy", comece lendo este arquivo e use `scripts/deploy.sh`.
