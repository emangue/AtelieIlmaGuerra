# =============================================================================
# Configuração centralizada para deploy Ateliê Ilma Guerra
# =============================================================================
# Uso: source "$(dirname "$0")/config.sh"
#
# ~/.ssh/config (exemplo):
#   Host minha-vps-hostinger
#     HostName 148.230.78.91
#     Port 22
#     User root
#     IdentityFile ~/.ssh/id_rsa_hostinger
# =============================================================================

# Alias SSH (ex: minha-vps-hostinger em ~/.ssh/config com Port 22)
VM_HOST="${VM_HOST:-minha-vps-hostinger}"

# Caminho no servidor
ATELIE_PATH="${ATELIE_PATH:-/var/www/atelie}"