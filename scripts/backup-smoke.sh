#!/usr/bin/env bash
set -euo pipefail
umask 077
psql() { command psql --dbname="$PGDATABASE" "$@"; }
work=$(mktemp -d /tmp/musika-smoke.XXXXXXXX)
trap 'case "$work" in /tmp/musika-smoke.*) rm -rf -- "$work" ;; esac' EXIT
export PGDATABASE='postgresql://postgres:restore-test-only@restore:5432/postgres'
psql -X --set=ON_ERROR_STOP=1 -c 'CREATE DATABASE musika_source' -c 'CREATE DATABASE musika_restore'
export BACKUP_DATABASE_URL='postgresql://postgres:restore-test-only@restore:5432/musika_source'
PGDATABASE="$BACKUP_DATABASE_URL" psql -X --set=ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE "LedgerEntry" (id text PRIMARY KEY, sender text NOT NULL, data jsonb NOT NULL);
CREATE TABLE "LedgerRevision" (id text PRIMARY KEY, "entryId" text REFERENCES "LedgerEntry"(id));
CREATE TABLE "Conversation" (sender text PRIMARY KEY, state jsonb NOT NULL);
CREATE TABLE "InboundMessage" (id text PRIMARY KEY, response jsonb);
INSERT INTO "LedgerEntry" VALUES ('one','vendor-one','{"customer":"Makoni","total":1020,"cashReceived":600}'), ('two','vendor-two','{"customer":"Chipo","total":300,"cashReceived":300}');
INSERT INTO "LedgerRevision" VALUES ('audit-one','one');
INSERT INTO "Conversation" VALUES ('vendor-one','{"phase":"confirm"}');
INSERT INTO "InboundMessage" VALUES ('message-one','{"text":"Transaction saved."}');
SQL
age-keygen -o "$work/identity" 2>/dev/null
export AGE_RECIPIENT
AGE_RECIPIENT=$(age-keygen -y "$work/identity")
export RESTORE_TEST_URL='postgresql://postgres:restore-test-only@restore:5432/musika_restore'
bash scripts/backup.sh "$work/output"
archive=$(find "$work/output" -name '*.age' -type f)
age --decrypt --identity "$work/identity" --output "$work/decrypted.dump" "$archive"
pg_restore --list "$work/decrypted.dump" >/dev/null
export PGDATABASE="$RESTORE_TEST_URL"
check=$(psql -XAt --set=ON_ERROR_STOP=1 -c "SELECT count(*) FROM \"LedgerEntry\" WHERE (sender='vendor-one' AND data->>'cashReceived'='600') OR (sender='vendor-two' AND data->>'customer'='Chipo')")
[[ "$check" == 2 ]]
[[ $(psql -XAt -c 'SELECT count(*) FROM "LedgerRevision"') == 1 ]]
[[ $(psql -XAt --set=ON_ERROR_STOP=1 -c "SELECT state->>'phase' FROM \"Conversation\"") == confirm ]]
[[ $(psql -XAt --set=ON_ERROR_STOP=1 -c 'SELECT count(*) FROM "InboundMessage"') == 1 ]]
# Wrong decryption key must fail. No private key leaves this temporary directory.
age-keygen -o "$work/wrong-key" 2>/dev/null
if age --decrypt --identity "$work/wrong-key" --output "$work/wrong.dump" "$archive" 2>/dev/null; then
  echo 'Wrong key unexpectedly decrypted backup.' >&2; exit 1
fi
# A second restore must refuse a non-empty target.
if bash scripts/backup.sh "$work/rejected" >/dev/null 2>&1; then
  echo 'Non-empty restore target was not rejected.' >&2; exit 1
fi
echo 'Backup smoke test passed: vendor data, audit history, encryption and safety guards.'
