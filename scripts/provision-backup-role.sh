#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${BACKUP_DATABASE_URL:?Set the existing owner connection privately}"
: "${AGE_RECIPIENT:?Set the public age recipient}"
[[ "$BACKUP_DATABASE_URL" == postgresql://* && "$BACKUP_DATABASE_URL" != *'-pooler.'* && "$BACKUP_DATABASE_URL" != *'*'* ]] || exit 1
out="${1:?Provide an output directory}"
mkdir -p "$out"
work=$(mktemp -d /tmp/musika-role.XXXXXXXX)
trap 'case "$work" in /tmp/musika-role.*) rm -rf -- "$work" ;; esac' EXIT
export PGCONNECT_TIMEOUT=30
existing=$(psql --dbname="$BACKUP_DATABASE_URL" -XAt --set=ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_roles WHERE rolname='musika_backup_reader'" 2>"$work/errors")
[[ "$existing" == 0 ]] || { echo 'Backup role already exists; refusing to reset its password.' >&2; exit 1; }
password=$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')
if ! psql --dbname="$BACKUP_DATABASE_URL" -X --set=ON_ERROR_STOP=1 --set=backup_password="$password" >"$work/setup-log" 2>"$work/errors" <<'SQL'
BEGIN;
CREATE ROLE musika_backup_reader LOGIN PASSWORD :'backup_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT CONNECTION LIMIT 2;
SELECT format('GRANT CONNECT ON DATABASE %I TO musika_backup_reader', current_database()) \gexec
GRANT USAGE ON SCHEMA public TO musika_backup_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO musika_backup_reader;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO musika_backup_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO musika_backup_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO musika_backup_reader;
ALTER ROLE musika_backup_reader SET default_transaction_read_only=on;
ALTER ROLE musika_backup_reader SET statement_timeout='5min';
DO $$ BEGIN
  IF has_schema_privilege('musika_backup_reader','public','CREATE')
     OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f') AND has_table_privilege('musika_backup_reader',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
     OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname='musika_backup_reader' AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls))
  THEN RAISE EXCEPTION 'Backup role has excessive privileges'; END IF;
END $$;
COMMIT;
SQL
then
  echo 'Role setup failed and its transaction was rolled back; private details were not logged.' >&2; exit 1
fi
backup_url="postgresql://musika_backup_reader:${password}@${BACKUP_DATABASE_URL#*@}"
if ! psql --dbname="$backup_url" -XAt --set=ON_ERROR_STOP=1 -c 'SELECT count(*) FROM public."LedgerEntry"' >"$work/read-check" 2>"$work/errors"; then
  echo 'Role was created but login verification failed. Do not rerun password creation; inspect the role.' >&2; exit 1
fi
printf '%s' "$backup_url" > "$work/backup-login.txt"
age -r "$AGE_RECIPIENT" -o "$work/backup-login.age" "$work/backup-login.txt"
mv -- "$work/backup-login.age" "$out/backup-login.age"
echo 'Read-only backup role created; encrypted login details are ready. Application login unchanged.'
