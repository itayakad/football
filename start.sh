#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
SESSION_NAME="football-manager"
BACKEND_PORT="3001"
FRONTEND_PORT="8081"

kill_port() {
  local port="$1"
  local pids

  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    printf 'Stopping process(es) listening on port %s...\n' "$port"
    kill $pids 2>/dev/null || true

    for _ in 1 2 3 4 5; do
      if ! lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
        return
      fi
      sleep 0.2
    done

    pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    [ -z "$pids" ] || kill -KILL $pids 2>/dev/null || true
  fi
}

if ! command -v tmux >/dev/null 2>&1; then
  printf '%s\n' 'tmux is required to run the frontend and backend in side-by-side panes.'
  printf '%s\n' 'Install it with: brew install tmux'
  exit 1
fi

if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  tmux kill-session -t "$SESSION_NAME"
fi

kill_port "$BACKEND_PORT"
kill_port "$FRONTEND_PORT"

BACKEND_COMMAND=$(printf 'cd %q && npm run build && npm run seed && printf %q && npm run api:dev' \
  "$ROOT_DIR/backend" \
  'Seed complete. Starting backend API...\n')
FRONTEND_COMMAND=$(printf 'cd %q && npm start' "$ROOT_DIR/frontend")

tmux new-session -d -s "$SESSION_NAME" -n app "$BACKEND_COMMAND"
tmux set-option -g mouse on
tmux set-window-option -t "$SESSION_NAME:app" history-limit 10000
tmux set-window-option -t "$SESSION_NAME:app" remain-on-exit on
tmux split-window -h -t "$SESSION_NAME:app" "$FRONTEND_COMMAND"
tmux select-layout -t "$SESSION_NAME:app" even-horizontal
tmux select-pane -t "$SESSION_NAME:app.0"

exec tmux attach-session -t "$SESSION_NAME"
