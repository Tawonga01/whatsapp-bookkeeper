#!/usr/bin/env bash
# PostgreSQL 18 clients and age are required. Never run with shell tracing.
set -euo pipefail
umask 077
psql() { command psql --dbname="$PGDATABASE" "$@"; }
: "${BACKUP_DATABASE_URL:?Set the direct source connection privately}"
: "${AGE_RECIPIENT:?Set the public age recipient}"
: "${RESTORE_TEST_URL:?Set the disposable restore connection}"
if [[ "$BACKUP_DATABASE_URL" == *'-pooler.'* ]]; then
  echo 'Use a direct Neon connection for backups.' >&2; exit 1
fi
# Hard boundary: automated restores may ONLY target the isolated CI service/database.
if [[ "$RESTORE_TEST_URL" != 'postgresql://postgres:restore-test-only@restore:5432/musika_restore' ]]; then
  echo 'Restore target is not the approved disposable test database.' >&2; exit 1
fi
out="${1:?Provide an output directory}"
mkdir -p "$out"
tmp_root="${TMPDIR:-/tmp}"
work=$(mktemp -d "$tmp_root/musika-backup.XXXXXXXX")
cleanup() {
  case "$work" in "$tmp_root"/musika-backup.*) rm -rf -- "$work" ;; esac
}
trap cleanup EXIT
export PGCONNECT_TIMEOUT=30
export PGDATABASE="$BACKUP_DATABASE_URL"
export PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=300000'
if ! pg_dump --dbname="$BACKUP_DATABASE_URL" --format=custom --no-owner --no-acl --file="$work/database.dump" 2>"$work/dump-errors"; then
  echo 'Database export failed; private diagnostic output was not published.' >&2; exit 1
fi
test -s "$work/database.dump"
pg_restore --list "$work/database.dump" > "$work/archive-list"
unset PGOPTIONS
export PGDATABASE="$RESTORE_TEST_URL"
tables=$(psql -XAt --set=ON_ERROR_STOP=1 -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
[[ "$tables" == 0 ]] || { echo 'Restore test database is not empty.' >&2; exit 1; }
if ! pg_restore --exit-on-error --single-transaction --no-owner --no-acl --dbname="$RESTORE_TEST_URL" "$work/database.dump" 2>"$work/restore-errors"; then
  echo 'Disposable restore failed; no backup will be published.' >&2; exit 1
fi
required=$(psql -XAt --set=ON_ERROR_STOP=1 -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('LedgerEntry','LedgerRevision','Conversation','InboundMessage')")
[[ "$required" == 4 ]] || { echo 'Restored database is missing required MUSIKA tables.' >&2; exit 1; }
age --recipient "$AGE_RECIPIENT" --output "$work/database.dump.age" "$work/database.dump"
test -s "$work/database.dump.age"
name="musika-$(date -u +%Y%m%dT%H%M%SZ).dump.age"
mv -- "$work/database.dump.age" "$out/$name"
echo 'Export, isolated restore, required-table checks and encryption succeeded.'
