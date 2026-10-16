#!/usr/bin/env bash
set -euo pipefail
umask 077
bash scripts/backup-smoke.sh
work=$(mktemp -d /tmp/musika-role-test.XXXXXXXX)
trap 'case "$work" in /tmp/musika-role-test.*) rm -rf -- "$work" ;; esac' EXIT
age-keygen -o "$work/identity" 2>/dev/null
export AGE_RECIPIENT
AGE_RECIPIENT=$(age-keygen -y "$work/identity")
export BACKUP_DATABASE_URL='postgresql://postgres:restore-test-only@restore:5432/musika_source'
bash scripts/provision-backup-role.sh "$work/login"
age -d -i "$work/identity" -o "$work/login.txt" "$work/login/backup-login.age"
reader_url=$(cat "$work/login.txt")
[[ "$reader_url" == postgresql://musika_backup_reader:* ]]
psql --dbname="$BACKUP_DATABASE_URL" -X --set=ON_ERROR_STOP=1 -c 'CREATE TABLE future_read_test (id int)' >/dev/null
psql --dbname="$reader_url" -X --set=ON_ERROR_STOP=1 -c 'SELECT count(*) FROM future_read_test' >/dev/null
# Disable the default read-only mode: privileges must still prevent writes/DDL.
if PGOPTIONS='-c default_transaction_read_only=off' psql --dbname="$reader_url" -X --set=ON_ERROR_STOP=1 -c 'UPDATE "LedgerEntry" SET id=id WHERE false' >/dev/null 2>&1; then
  echo 'Backup reader unexpectedly has write access.' >&2; exit 1
fi
if PGOPTIONS='-c default_transaction_read_only=off' psql --dbname="$reader_url" -X --set=ON_ERROR_STOP=1 -c 'CREATE TABLE public.forbidden_write(id int)' >/dev/null 2>&1; then
  echo 'Backup reader unexpectedly can create application tables.' >&2; exit 1
fi
if bash scripts/provision-backup-role.sh "$work/rejected" >/dev/null 2>&1; then
  echo 'Provisioning unexpectedly reset an existing login.' >&2; exit 1
fi
psql --dbname='postgresql://postgres:restore-test-only@restore:5432/postgres' -X --set=ON_ERROR_STOP=1 -c 'DROP DATABASE musika_restore' -c 'CREATE DATABASE musika_restore' >/dev/null
export BACKUP_DATABASE_URL="$reader_url"
export RESTORE_TEST_URL='postgresql://postgres:restore-test-only@restore:5432/musika_restore'
bash scripts/backup.sh "$work/reader-backup"
echo 'Read-only role verified: current/future tables, real export, denied writes/DDL, no password reset.'
