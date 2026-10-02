#!/usr/bin/env bash
#
# BF Studio — inicializador para Linux e macOS
#
#   ./iniciar.sh          usa a porta 5173
#   ./iniciar.sh 3000     usa a porta 3000
#
# Ele confere o Node.js, instala as dependências na primeira vez e sobe o
# servidor em http://localhost:PORTA abrindo o navegador em seguida.

set -uo pipefail
cd "$(dirname "$0")"

PORT="${1:-5173}"

BOLD=$'\033[1m'; DIM=$'\033[2m'; GREEN=$'\033[32m'
YELLOW=$'\033[33m'; RED=$'\033[31m'; RESET=$'\033[0m'

ok()   { printf '%s\n' "  ${GREEN}[OK]${RESET} $*"; }
info() { printf '%s\n' "  ${DIM}[*]${RESET} $*"; }
warn() { printf '%s\n' "  ${YELLOW}[AVISO]${RESET} $*"; }
erro() { printf '%s\n' "  ${RED}[ERRO]${RESET} $*"; }

echo
echo "  ==============================================================  "
echo "${BOLD}   BF Studio — editor, compilador e depurador de Brainfuck${RESET}"
echo "  ==============================================================  "
echo

if [ ! -f package.json ]; then
  erro "Não achei o package.json em $(pwd)."
  echo "       O iniciar.sh precisa ficar na raiz do projeto."
  exit 1
fi

# ------------------------------------------------------------ 1. Node.js
instalar_node() {
  warn "O Node.js não está instalado. Tentando instalar automaticamente…"
  if command -v brew >/dev/null 2>&1; then
    brew install node
  elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update && sudo apt-get install -y curl ca-certificates
    # NodeSource entrega o Node 22; o pacote da Debian/Ubuntu costuma ser antigo
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y nodejs npm
  elif command -v yum >/dev/null 2>&1; then
    sudo yum install -y nodejs npm
  elif command -v pacman >/dev/null 2>&1; then
    sudo pacman -Sy --noconfirm nodejs npm
  elif command -v zypper >/dev/null 2>&1; then
    sudo zypper install -y nodejs npm
  else
    erro "Não encontrei um gerenciador de pacotes conhecido."
    echo "        Baixe o Node.js LTS em https://nodejs.org/ e rode ./iniciar.sh de novo."
    exit 1
  fi
}

if ! command -v node >/dev/null 2>&1; then
  instalar_node
  command -v node >/dev/null 2>&1 || { erro "A instalação do Node.js falhou."; exit 1; }
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  warn "Seu Node.js é a versão $(node -v) e o projeto precisa da 20.19 ou mais nova."
  warn "Instale a LTS de https://nodejs.org/ e rode o script outra vez."
  exit 1
fi
ok "Node.js $(node -v)"

# --------------------------------------------------------- 2. Dependências
if [ ! -d node_modules/vite ]; then
  info "Instalando as dependências do projeto (só acontece na primeira vez)…"
  echo
  if ! npm install --no-audit --no-fund; then
    echo
    erro "A instalação das dependências falhou. Tente rodar: npm install"
    exit 1
  fi
  echo
  ok "Dependências instaladas."
else
  ok "Dependências já estavam instaladas."
fi

# ------------------------------------------------------------- 3. Servidor
echo
echo "  ==============================================================  "
echo "   Endereço:   ${BOLD}http://localhost:${PORT}${RESET}"
echo "   O navegador abre sozinho. Deixe este terminal aberto."
echo "   Para encerrar o servidor, aperte Ctrl+C."
echo "  ==============================================================  "
echo

BF_PORT="$PORT" exec npm run dev -- --host --open --port "$PORT"
