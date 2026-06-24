#!/usr/bin/env bash
# solana-tx-guard custom installer — choose install location and CLAUDE.md target.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "solana-tx-guard custom installer"
echo "Choose install location:"
echo "  1) Personal  (~/.claude/skills/)"
echo "  2) Project   (./.claude/skills/ in the current directory)"
echo "  3) Custom    (you type the path)"
read -r -p "Selection [1]: " choice
choice="${choice:-1}"

case "${choice}" in
  1) BASE="${HOME}/.claude/skills" ; CLAUDE_BASE="${HOME}/.claude" ;;
  2) BASE="$(pwd)/.claude/skills"  ; CLAUDE_BASE="$(pwd)/.claude" ;;
  3) read -r -p "Enter skills directory: " BASE
     read -r -p "Enter CLAUDE.md directory: " CLAUDE_BASE ;;
  *) echo "invalid selection"; exit 1 ;;
esac

TARGET="${BASE}/solana-tx-guard"
echo "Installing to: ${TARGET}"
mkdir -p "${TARGET}"
cp -R "${SCRIPT_DIR}/skill" "${SCRIPT_DIR}/agents" "${SCRIPT_DIR}/commands" \
      "${SCRIPT_DIR}/rules" "${SCRIPT_DIR}/analyzer" "${TARGET}/"
cp "${SCRIPT_DIR}/CLAUDE.md" "${TARGET}/"
rm -rf "${TARGET}/analyzer/node_modules" "${TARGET}/analyzer/dist"

read -r -p "Place CLAUDE.md in ${CLAUDE_BASE}? [Y/n] " reply
case "${reply}" in
  [nN]*) echo "  skipped CLAUDE.md placement" ;;
  *) mkdir -p "${CLAUDE_BASE}"
     if [ -f "${CLAUDE_BASE}/CLAUDE.md" ]; then
       echo "  ${CLAUDE_BASE}/CLAUDE.md exists — left untouched"
     else
       cp "${SCRIPT_DIR}/CLAUDE.md" "${CLAUDE_BASE}/CLAUDE.md"
       echo "  copied CLAUDE.md to ${CLAUDE_BASE}/"
     fi ;;
esac

echo ""
echo "Installed. Build the analyzer:"
echo "  cd ${TARGET}/analyzer && npm install && npm run build"
