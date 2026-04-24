# Backup Diário → Google Drive

Guia de configuração do backup automático do banco PostgreSQL da VM para o Google Drive.

---

## Pré-requisitos

- VM rodando com PostgreSQL
- Acesso SSH à VM (`ssh root@148.230.78.91`)
- Conta Google com espaço no Drive

---

## 1. Instalar rclone na VM

```bash
ssh root@148.230.78.91

curl https://rclone.org/install.sh | sudo bash
rclone --version   # confirmar instalação
```

---

## 2. Configurar rclone com Google Drive

> **Atenção:** como a VM não tem browser, a autenticação OAuth é feita localmente
> no seu Mac e o arquivo de configuração é copiado para a VM.

### 2a. No seu Mac — instalar rclone localmente

```bash
brew install rclone
```

### 2b. No Mac — criar a configuração

```bash
rclone config
```

Siga os passos:
1. `n` → New remote
2. Name: `gdrive`
3. Storage type: `drive` (Google Drive) — geralmente opção **17**
4. Client ID e Secret: deixe **em branco** (Enter)
5. Scope: `1` (acesso completo ao Drive)
6. Root folder ID: deixe **em branco** (Enter)
7. Service Account: deixe **em branco** (Enter)
8. Edit advanced? `n`
9. Auto config? `y` → **abre o browser** → autorize com sua conta Google
10. Configure as a Shared Drive? `n`
11. `y` → confirmar

### 2c. Testar no Mac

```bash
rclone lsd gdrive:           # lista pastas no Drive
rclone mkdir gdrive:backups-atelie   # cria a pasta de backups
```

### 2d. Copiar configuração do Mac para a VM

```bash
# No Mac:
scp ~/.config/rclone/rclone.conf root@148.230.78.91:/root/.config/rclone/rclone.conf
```

> Se o diretório não existir na VM, crie antes:
> ```bash
> ssh root@148.230.78.91 "mkdir -p /root/.config/rclone"
> ```

### 2e. Testar na VM

```bash
ssh root@148.230.78.91
rclone lsd gdrive:           # deve listar suas pastas do Drive
rclone lsd gdrive:backups-atelie   # deve mostrar a pasta criada
```

---

## 3. Implantar o script na VM

O script já está em `scripts/backup_to_drive.sh` no repositório.
Após o próximo `deploy.sh`, ele estará em `/var/www/atelie/scripts/`.

Dar permissão de execução na VM:

```bash
ssh root@148.230.78.91
chmod +x /var/www/atelie/scripts/backup_to_drive.sh
```

### Teste manual

```bash
bash /var/www/atelie/scripts/backup_to_drive.sh
```

Verifique o log:
```bash
tail -50 /var/log/atelie-backup.log
```

Verifique no Drive: acesse `drive.google.com` → pasta `backups-atelie`.

---

## 4. Configurar cron job (execução diária às 03:00)

```bash
ssh root@148.230.78.91
crontab -e
```

Adicione a linha:

```
0 3 * * * /var/www/atelie/scripts/backup_to_drive.sh >> /var/log/atelie-backup.log 2>&1
```

Verifique os crons ativos:
```bash
crontab -l
```

---

## 5. Estrutura dos backups no Drive

```
Google Drive/
└── backups-atelie/
    ├── atelie_db_2026-02-26_03-00-01.sql.gz
    ├── atelie_db_2026-02-27_03-00-02.sql.gz
    └── ...  (mantidos por 30 dias)
```

Nomenclatura: `atelie_db_YYYY-MM-DD_HH-MM-SS.sql.gz`

---

## 6. Restaurar um backup

```bash
# Baixar do Drive
rclone copy gdrive:backups-atelie/atelie_db_2026-02-26_03-00-01.sql.gz /tmp/

# Restaurar no PostgreSQL
gunzip -c /tmp/atelie_db_2026-02-26_03-00-01.sql.gz \
  | PGPASSWORD="SUA_SENHA" psql \
      --host=127.0.0.1 \
      --port=5432 \
      --username=atelie_user \
      atelie_db
```

---

## 7. Monitoramento

Ver os últimos backups realizados:
```bash
tail -100 /var/log/atelie-backup.log | grep -E "(Iniciando|concluído|ERRO)"
```

Listar backups no Drive:
```bash
rclone ls gdrive:backups-atelie/
```

Ver tamanho total no Drive:
```bash
rclone size gdrive:backups-atelie/
```

---

## Resumo da política de retenção

| Local       | Retenção          |
|-------------|-------------------|
| VM local    | 7 arquivos mais recentes |
| Google Drive | 30 dias           |
