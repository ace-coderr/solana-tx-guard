#!/usr/bin/env bash
# solana-tx-guard standard installer
# Installs the skill to ~/.claude/skills/solana-tx-guard and copies CLAUDE.md.
# Usage: ./install.sh [-y]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="${HOME}/.claude/skills"
TARGET="${SKILLS_DIR}/solana-tx-guard"
ASSUME_YES="false"
[ "${1:-}" = "-y" ] && ASSUME_YES="true"

echo "solana-tx-guard installer"
echo "  source: ${SCRIPT_DIR}"
echo "  target: ${TARGET}"

if [ "${ASSUME_YES}" != "true" ]; then
  read -r -p "Install to ${TARGET}? [Y/n] " reply
  case "${reply}" in [nN]*) echo "aborted"; exit 0 ;; esac
fi

mkdir -p "${TARGET}"
cp -R "${SCRIPT_DIR}/skill"    "${TARGET}/"
cp -R "${SCRIPT_DIR}/agents"   "${TARGET}/"
cp -R "${SCRIPT_DIR}/commands" "${TARGET}/"
cp -R "${SCRIPT_DIR}/rules"    "${TARGET}/"
cp -R "${SCRIPT_DIR}/analyzer" "${TARGET}/"
cp    "${SCRIPT_DIR}/CLAUDE.md" "${TARGET}/"
# remove any copied build artifacts / deps
rm -rf "${TARGET}/analyzer/node_modules" "${TARGET}/analyzer/dist"

mkdir -p "${HOME}/.claude"
if [ ! -f "${HOME}/.claude/CLAUDE.md" ]; then
  cp "${SCRIPT_DIR}/CLAUDE.md" "${HOME}/.claude/CLAUDE.md"
  echo "  copied CLAUDE.md to ~/.claude/"
else
  echo "  ~/.claude/CLAUDE.md exists — left untouched (skill copy is at ${TARGET}/CLAUDE.md)"
fi

echo ""
echo "Installed. To build the analyzer:"
echo "  cd ${TARGET}/analyzer && npm install && npm run build"
echo "Then: npx tx-guard <base64-tx> --json"
