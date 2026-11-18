#!/usr/bin/env bash
# Keep one expensive verification running, independent of the agent shell.
set -euo pipefail
run_name=${1:?Usage: run-durable-check.sh name command [args...]}
shift
[[ "$run_name" =~ ^[a-z0-9-]+$ ]] || exit 2
project_dir=$(cd "$(dirname "$0")/.." && pwd)
run_dir=/workspace/.agent-runs/m39
mkdir -p "$run_dir"
systemd-run --unit="qbank-m39-$run_name" --collect --service-type=exec \
  --working-directory="$project_dir" \
  --setenv=OMP_THREAD_LIMIT=1 \
  --setenv=PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright \
  --property="StandardOutput=append:$run_dir/$run_name.log" \
  --property="StandardError=append:$run_dir/$run_name.log" \
  /usr/bin/flock --nonblock --conflict-exit-code=75 "$run_dir/heavy.lock" \
  /usr/bin/bash -c '"$@"; result=$?; printf "\nRESULT exit=%s\n" "$result"; exit "$result"' -- "$@"
printf 'Unit: qbank-m39-%s; log: %s/%s.log\n' "$run_name" "$run_dir" "$run_name"
