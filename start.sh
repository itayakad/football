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

START_BACKEND=1
START_FRONTEND=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --frontend)
      START_BACKEND=0
      shift
      ;;
    --backend)
      START_FRONTEND=0
      shift
      ;;
    --help|-h)
      printf '%s\n' 'Usage: ./start.sh [--frontend] [--backend]'
      printf '%s\n' '  --frontend   Start only the frontend'
      printf '%s\n' '  --backend    Start only the backend'
      exit 0
      ;;
    *)
      printf '%s\n' "Unknown option: $1"
      exit 1
      ;;
  esac
done

if [[ $START_BACKEND -eq 0 && $START_FRONTEND -eq 0 ]]; then
  printf '%s\n' 'At least one of --frontend or --backend must be selected.'
  exit 1
fi

if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  tmux kill-session -t "$SESSION_NAME"
fi

cleanup() {
  if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    tmux kill-session -t "$SESSION_NAME"
  fi
}

trap 'cleanup' INT TERM EXIT

if [[ $START_BACKEND -eq 1 ]]; then
  kill_port "$BACKEND_PORT"
fi
if [[ $START_FRONTEND -eq 1 ]]; then
  kill_port "$FRONTEND_PORT"
fi

BACKEND_COMMAND=$(printf 'cd %q && npm run db:deploy && npm run build && npm run seed && printf %q && npm run api:dev' \
  "$ROOT_DIR/backend" \
  'Seed complete. Starting backend API...\n')
FRONTEND_COMMAND=$(printf 'cd %q && npm start' "$ROOT_DIR/frontend")

if [[ $START_BACKEND -eq 1 && $START_FRONTEND -eq 1 ]]; then
  tmux new-session -d -s "$SESSION_NAME" -n app "$BACKEND_COMMAND"
  tmux set-hook -g pane-exited "run-shell 'tmux kill-session -t $SESSION_NAME'"
  tmux set-hook -g pane-died "run-shell 'tmux kill-session -t $SESSION_NAME'"
  tmux set-option -g mouse on
  tmux set-window-option -t "$SESSION_NAME:app" history-limit 10000
  tmux set-window-option -t "$SESSION_NAME:app" remain-on-exit off
  tmux split-window -h -t "$SESSION_NAME:app" "$FRONTEND_COMMAND"
  tmux select-layout -t "$SESSION_NAME:app" even-horizontal
  tmux select-pane -t "$SESSION_NAME:app.0"
  tmux attach-session -t "$SESSION_NAME" || true
elif [[ $START_BACKEND -eq 1 ]]; then
  tmux new-session -d -s "$SESSION_NAME" -n backend "$BACKEND_COMMAND"
  tmux set-hook -g pane-exited "run-shell 'tmux kill-session -t $SESSION_NAME'"
  tmux set-hook -g pane-died "run-shell 'tmux kill-session -t $SESSION_NAME'"
  tmux set-option -g mouse on
  tmux set-window-option -t "$SESSION_NAME:backend" history-limit 10000
  tmux set-window-option -t "$SESSION_NAME:backend" remain-on-exit off
  tmux attach-session -t "$SESSION_NAME" || true
else
  tmux new-session -d -s "$SESSION_NAME" -n frontend "$FRONTEND_COMMAND"
  tmux set-hook -g pane-exited "run-shell 'tmux kill-session -t $SESSION_NAME'"
  tmux set-hook -g pane-died "run-shell 'tmux kill-session -t $SESSION_NAME'"
  tmux set-option -g mouse on
  tmux set-window-option -t "$SESSION_NAME:frontend" history-limit 10000
  tmux set-window-option -t "$SESSION_NAME:frontend" remain-on-exit off
  tmux attach-session -t "$SESSION_NAME" || true
fi
