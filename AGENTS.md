# AtelieIlmaGuerra: regras operacionais para agentes

## Deploy: fonte da verdade

Quando o usuario pedir commit/deploy/subir versao do Atelie, use estes arquivos,
nesta ordem:

1. `scripts/deploy.sh` no Mac/local.
   - Este e o deploy canonico.
   - Builda `app_dev/frontend` e `app_atendimento/frontend`.
   - Envia o repositorio para `/var/www/atelie` respeitando `.deployignore`.
2. `scripts/deploy/pos_deploy_vm.sh` na VM.
   - Executar com `ssh minha-vps-hostinger "cd /var/www/atelie && bash scripts/deploy/pos_deploy_vm.sh"`.
   - Instala/atualiza dependencias, builda na VM, instala units systemd e reinicia os servicos.
3. Validar com `scripts/validar_deploy_vm.sh` na VM.

Nao use o skill generico `anthropic-skills:deploy` para este projeto: ele e de
FinUp e aponta para `/var/www/finup`.

Nao use `deploy/deploy.sh` como implementacao propria. Ele existe apenas como
wrapper legado para `scripts/deploy.sh`.

`scripts/deploy/deploy_atelie.sh` e `scripts/deploy_atelie_servidor.sh` servem
para integrar/recarregar Nginx, nao para publicar codigo da aplicacao.

Mais detalhes: `docs/deploy/DEPLOY_SOURCE_OF_TRUTH.md`.
