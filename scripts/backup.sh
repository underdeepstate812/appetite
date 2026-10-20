#!/usr/bin/env bash
# Резервные копии рабочего дерева Appetite: снимок ВСЕГО, что не в .gitignore (изменённое, новое, незакоммиченное),
# без коммита в вашу ветку и без изменения рабочих файлов.
#
#   bash scripts/backup.sh create [имя]      сделать снимок (по умолчанию имя = дата-время)
#   bash scripts/backup.sh list              показать снимки
#   bash scripts/backup.sh diff <имя>        что изменилось в рабочем дереве с момента снимка
#   bash scripts/backup.sh restore <имя>     вернуть файлы из снимка (перед этим автоматически делается снимок «как есть сейчас»)
#   bash scripts/backup.sh restore <имя> --prune   то же + удалить файлы, которых в снимке не было (созданные позже)
#   bash scripts/backup.sh delete <имя>      удалить снимок
#
# Где хранится: (1) скрытая ссылка git refs/backups/<имя> (коммит-снимок, виден в `git log refs/backups/<имя>`; ветки
# и история не затронуты) и (2) архив <имя>.tar.gz в BACKUP_DIR (по умолчанию ../appetite-backups рядом с репозиторием) —
# он переживёт даже потерю .git. Папка img/ в снимок не входит (её нельзя коммитить), node_modules и прочее из .gitignore — тоже.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
REF_PREFIX="refs/backups"
BACKUP_DIR="${BACKUP_DIR:-$(cd "$ROOT/.." && pwd)/appetite-backups}"
EXCLUDE=(':(exclude)img')

die() { echo "Ошибка: $*" >&2; exit 1; }

valid_name() { [[ "$1" =~ ^[A-Za-z0-9._-]+$ ]] || die "имя может содержать только латиницу, цифры, точку, дефис и подчёркивание: '$1'"; }

# Дерево (tree) текущего рабочего каталога — через временный индекс, чтобы не трогать настоящий.
current_tree() {
  local idx; idx="$(mktemp -u)"
  GIT_INDEX_FILE="$idx" git read-tree HEAD
  GIT_INDEX_FILE="$idx" git add -A -- . "${EXCLUDE[@]}"
  GIT_INDEX_FILE="$idx" git write-tree
  rm -f "$idx"
}

create() {
  local name="${1:-$(date +%Y%m%d-%H%M%S)}"
  valid_name "$name"
  git rev-parse -q --verify "$REF_PREFIX/$name" >/dev/null && die "снимок '$name' уже есть (выберите другое имя или удалите старый)"
  local tree commit
  tree="$(current_tree)"
  commit="$(git commit-tree "$tree" -p HEAD -m "backup: $name ($(date '+%Y-%m-%d %H:%M:%S'), ветка $(git rev-parse --abbrev-ref HEAD))")"
  git update-ref "$REF_PREFIX/$name" "$commit"
  mkdir -p "$BACKUP_DIR"
  git archive --format=tar.gz -o "$BACKUP_DIR/$name.tar.gz" "$commit"
  local files; files="$(git ls-tree -r --name-only "$commit" | wc -l | tr -d ' ')"
  echo "Снимок '$name' создан: $files файлов"
  echo "  git:    $REF_PREFIX/$name ($(git rev-parse --short "$commit"))"
  echo "  архив:  $BACKUP_DIR/$name.tar.gz ($(du -h "$BACKUP_DIR/$name.tar.gz" | cut -f1))"
}

list() {
  if ! git for-each-ref "$REF_PREFIX" --format='x' | grep -q x; then echo "Снимков пока нет."; return; fi
  git for-each-ref "$REF_PREFIX" --sort=-creatordate --format='%(refname:strip=2)|%(creatordate:format:%Y-%m-%d %H:%M)|%(objectname:short)|%(subject)' |
    while IFS='|' read -r name date sha subject; do printf '%-34s %s  %s\n' "$name" "$date" "$sha"; done
}

require() {
  [ -n "${1:-}" ] || die "укажите имя снимка (см. list)"
  git rev-parse -q --verify "$REF_PREFIX/$1" >/dev/null || die "снимка '$1' нет (см. list)"
}

diff_cmd() {
  require "${1:-}"
  local cur; cur="$(current_tree)"
  echo "Изменения рабочего дерева относительно снимка '$1' (+ добавлено сейчас, − удалено сейчас):"
  git diff --stat --no-color "$REF_PREFIX/$1^{tree}" "$cur" | tail -n 40
}

restore() {
  require "${1:-}"
  local name="$1" prune="${2:-}"
  local safety="auto-before-restore-$(date +%Y%m%d-%H%M%S)"
  create "$safety" >/dev/null
  echo "Страховка: состояние «как сейчас» сохранено как '$safety' (вернуть его: restore $safety)"
  git archive "$REF_PREFIX/$name" | tar -x -C "$ROOT"
  echo "Файлы из снимка '$name' возвращены."
  if [ "$prune" = "--prune" ]; then
    local extra
    extra="$(comm -13 <(git ls-tree -r --name-only "$REF_PREFIX/$name" | sort) <(git ls-files -m -o --exclude-standard -- . "${EXCLUDE[@]}" | sort))"
    if [ -n "$extra" ]; then
      echo "$extra" | while IFS= read -r f; do [ -f "$f" ] && rm -f -- "$f" && echo "  удалён: $f"; done
    else
      echo "Лишних файлов нет."
    fi
  else
    echo "Файлы, созданные ПОСЛЕ снимка, не удалялись (чтобы удалить: restore $name --prune)."
  fi
}

delete() {
  require "${1:-}"
  git update-ref -d "$REF_PREFIX/$1"
  rm -f "$BACKUP_DIR/$1.tar.gz"
  echo "Снимок '$1' удалён."
}

case "${1:-help}" in
  create) shift; create "$@" ;;
  list) list ;;
  diff) shift; diff_cmd "$@" ;;
  restore) shift; restore "$@" ;;
  delete) shift; delete "$@" ;;
  *) sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//' ;;
esac
