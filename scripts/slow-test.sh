#!/usr/bin/env bash
# Runs a test command on a machine as slow as a GitHub runner (D50): a Linux container (the Playwright image, the
# browsers CI uses) limited to SLOW_CPUS CPUs (default 2: a runner has 4 vCPUs, each about half as fast as a
# developer Mac) and SLOW_MEMORY memory (default 7g), with CI=1.
# The working tree (committed and uncommitted files, without node_modules and ignored files) is copied into the
# container (as one commit of a fresh repository, for the tests that ask git); nothing is written back except the Linux screenshots when the command updates them.
#
#   npm run test:slow                                  # unit tests (npm test)
#   npm run test:slow -- npx playwright test tests/e2e/nav.spec.ts
#   SLOW_CPUS=1 npm run test:slow -- npm run e2e:fe -- tests/e2e-fe/lr5.spec.ts
#
# Needs Docker (Docker Desktop: Settings > Resources must allow at least SLOW_CPUS CPUs and SLOW_MEMORY memory).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CPUS="${SLOW_CPUS:-2}"
MEMORY="${SLOW_MEMORY:-7g}"
VERSION="$(node -p "require('$ROOT/node_modules/@playwright/test/package.json').version")"
IMAGE="mcr.microsoft.com/playwright:v${VERSION}-noble"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/smart-kit-slow.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

# tracked and untracked (not ignored) files of the working tree
(cd "$ROOT" && git ls-files -z --cached --others --exclude-standard | xargs -0 -I{} sh -c 'test -e "{}" && printf "%s\0" "{}"' | tar --null -T - -cf -) | tar -xf - -C "$WORK"
# the SAPUI5 api.json cache (check:ui5), if present
if [ -d "$ROOT/.cache/ui5" ]; then mkdir -p "$WORK/.cache" && cp -R "$ROOT/.cache/ui5" "$WORK/.cache/"; fi

CMD="${*:-npm test}"
echo "slow-test: $CMD (cpus $CPUS, memory $MEMORY, $IMAGE)"
set +e
docker run --rm --cpus="$CPUS" --memory="$MEMORY" -e CI=1 -v "$WORK:/work" -w /work "$IMAGE" \
  bash -c "git init -q && git config user.email slow@test && git config user.name slow-test && git add -A && git commit -qm copy && npm ci --no-audit --no-fund >/dev/null 2>&1 && $CMD"
status=$?
set -e

# keep Linux screenshots a command (re)wrote, e.g. with --update-snapshots
if [ -d "$WORK/tests/e2e/__screenshots__/linux" ]; then
  rsync -a --checksum "$WORK/tests/e2e/__screenshots__/linux/" "$ROOT/tests/e2e/__screenshots__/linux/"
fi
exit $status
