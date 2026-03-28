#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

VERSION=$(node -p "require('./package.json').version")
ELECTRON_VERSION=$(node -p "require('./node_modules/electron/package.json').version")
OUT_DIR="release/v${VERSION}/desktop"
APP_NAME="Yeju"
TARGET_DIR="${OUT_DIR}/${APP_NAME}-win32-x64"
ZIP_PATH="release/yeju-v${VERSION}-windows-portable.zip"
PACKAGER_ARGS=(
  .
  "$APP_NAME"
  --platform=win32
  --arch=x64
  --overwrite
  --prune=true
  --out="$OUT_DIR"
  --executable-name="$APP_NAME"
  --app-version="$VERSION"
  --electron-version="$ELECTRON_VERSION"
  --ignore='^/\.git($|/)'
  --ignore='^/output($|/)'
  --ignore='^/tests($|/)'
  --ignore='^/release/v[0-9]+\.[0-9]+\.[0-9]+/desktop($|/)'
  --extra-resource='dist'
)

CACHED_WIN_ZIP=$(find "${HOME}/Library/Caches/electron" -type f -name "electron-v${ELECTRON_VERSION}-win32-x64.zip" -print -quit 2>/dev/null || true)
if [[ -n "$CACHED_WIN_ZIP" ]]; then
  echo "[packager] use cached Electron zip: $CACHED_WIN_ZIP"
  PACKAGER_ARGS+=(--electron-zip-dir="$(dirname "$CACHED_WIN_ZIP")")
fi

echo "[1/5] build web assets"
npm run build

echo "[2/5] clean previous portable output"
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

echo "[3/5] package electron win32-x64"
npx @electron/packager "${PACKAGER_ARGS[@]}"

echo "[4/5] copy portable docs"
cp "release/v${VERSION}/windows-portable/README-Windows-Portable.md" "$TARGET_DIR/README-Windows-Portable.md"
cp "用户说明书.md" "$TARGET_DIR/用户说明书.md"
cp "release/v${VERSION}/RELEASE_NOTES.md" "$TARGET_DIR/RELEASE_NOTES.md"

echo "[5/5] create zip archive"
rm -f "$ZIP_PATH"
(
  cd "$OUT_DIR"
  COPYFILE_DISABLE=1 zip -r -X "../../yeju-v${VERSION}-windows-portable.zip" "${APP_NAME}-win32-x64" >/dev/null
)

echo "Portable package ready: $ZIP_PATH"
