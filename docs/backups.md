# MUSIKA backup and recovery

## Verified 16 October 2026

- Synthetic recovery test passed: https://github.com/Tawonga01/whatsapp-bookkeeper/actions/runs/38937024090
- First live Neon export, isolated PostgreSQL restore and encrypted artifact passed (attempt 2): https://github.com/Tawonga01/whatsapp-bookkeeper/actions/runs/38937241989
- Downloaded encrypted artifact was decrypted successfully with the local owner key; the PostgreSQL custom-archive header was verified. Temporary plaintext was removed. Encrypted copy is retained in `C:\Users\Tawonga\.codex\musika-recovery\first-verified-backup`.
- Local key round-trip and Windows directory/file ACLs were verified. Private key was not uploaded.
- `BACKUPS_ENABLED=true`, direct connection secret and public recipient are configured.
- GitHub account Actions notification setting was checked: Email, Failed workflows only. Actual email delivery was not independently verified.
- No real vendor transactions were added or changed. WhatsApp remains disabled.
- Owner still needs an offline/password-manager copy of the recovery key; dedicated read-only backup credentials remain a pre-pilot task.

## Read-only access rollout (16 October 2026)

- Permission/export test passed: https://github.com/Tawonga01/whatsapp-bookkeeper/actions/runs/38939285607
- Dedicated `musika_backup_reader` login created and read-verified in Neon: https://github.com/Tawonga01/whatsapp-bookkeeper/actions/runs/38939548360
- It is not a superuser, database/role creator, replication or RLS-bypass role. It receives public-schema USAGE, table SELECT and sequence SELECT, plus future-table/sequence SELECT for objects created by the provisioning owner. It owns no application records and is not given INSERT/UPDATE/DELETE/DDL privileges. Other migration owners need their own corresponding default grants.
- Permission tests disable its default read-only session setting before checking denial of writes/DDL, and perform an actual export/restore as the reader.
- Login credentials are stored only in an age-encrypted artifact and an encrypted local copy under `C:\Users\Tawonga\.codex\musika-recovery\read-only-login`. Setup refuses to reset an existing role/password.
- **Cutover not completed:** the original local recovery-key path is now missing. Owner must supply its new location (not its contents). GitHub's existing backup secret and Render's application connection are unchanged. Do not claim nightly jobs use the reader until the secret is replaced and a live export/restore passes.
- Do not generate a replacement recovery key silently: it cannot decrypt existing backups or the encrypted reader-login artifact.

## Policy

- GitHub Actions `Encrypted database backup`: daily at 01:23 UTC (03:23 Zimbabwe; Berlin 03:23 summer / 02:23 winter). Scheduling is best-effort, not a guarantee.
- Only runs when repository variable `BACKUPS_ENABLED=true`.
- Repository secret `BACKUP_DATABASE_URL`: direct Neon TLS connection, not the application's pooled URL.
- Repository variable `BACKUP_AGE_RECIPIENT`: public age recipient. This cannot decrypt data.
- Every successful run exports PostgreSQL 18, restores into a fresh isolated PostgreSQL 18 service, checks required tables, encrypts with age, and uploads only `*.dump.age`.
- Plaintext and temporary databases exist on the ephemeral GitHub runner during verification. Treat GitHub as a trusted processor. Restrict repository write access: collaborators who can change trusted workflows can use repository secrets. Never enable these secrets in fork/PR workflows.
- Source export uses a read-only PostgreSQL session. The setup initially uses an existing Neon credential; it is NOT a dedicated least-privilege account. Before real vendor onboarding, provision a separate backup-only role with SELECT access and appropriate future-table grants, then replace the secret.
- Encrypted artifacts expire after 7 days and can be downloaded by people with repository artifact access. Only the local private key decrypts them. They are not committed to Git.
- Free storage/compute allowances are finite. Monitor artifact size and Neon usage, disable paid overages, and reduce retention/frequency or move storage before exceeding free limits. No unlimited/free-forever guarantee.
- An export is a point-in-time snapshot. Target recovery point is the latest successful daily run (roughly 24h of possible loss, longer after failures). A seven-day policy is a pilot starting point, not statutory financial-record retention advice.

## Recovery key

Local private key: `C:\Users\Tawonga\.codex\musika-recovery\musika-backup-2026-10-16.agekey`.
Age tools are under that folder's `tools\age` directory. The directory is outside OneDrive/the repo and restricted to the Windows owner and SYSTEM.
Keep an additional copy in a password manager or encrypted offline device. Without this key, encrypted backups cannot be recovered. Never upload it to GitHub, paste it into chat, or put it in repository variables/secrets.

## First verification and ongoing checks

1. `Backup recovery test` must pass: synthetic vendor records, receipt/draft/audit history, encrypted export, private-key decryption, wrong-key rejection and refusal of nonempty restore target.
2. Run `Encrypted database backup` manually once against Neon. Verify the run succeeds and an encrypted artifact is present.
3. Download that artifact. Decrypt it locally with the private key and verify its archive listing. The scheduled workflow never needs the private key.
4. Verify GitHub Actions failure email notifications on your account; a workflow alone does not guarantee alerts. Review last successful backup before each pilot day. No external missed-schedule watchdog is configured.
5. At least monthly, practice restoring into a separate non-production database and compare customer balances using the application. Never point the WhatsApp worker at restored message receipts before delivery/replay review.

## Manual recovery (owner-supervised only)

Do not restore over production. Pause writes before a real recovery and preserve the current database.
Download/unzip the desired artifact and decrypt to a private, non-synced temporary folder:

```powershell
& 'C:\Users\Tawonga\.codex\musika-recovery\tools\age\age.exe' --decrypt --identity 'C:\Users\Tawonga\.codex\musika-recovery\musika-backup-2026-10-16.agekey' --output 'C:\private-recovery\database.dump' 'C:\private-recovery\downloaded.dump.age'
```

Use PostgreSQL 18 `pg_restore --list` to inspect the dump, then restore with `--exit-on-error --single-transaction --no-owner --no-acl` into a NEW EMPTY database. Set its connection privately through `PGDATABASE`; do not put passwords on the command line. Never use `--clean` or reset against live records.
Verify journal counts, audit revisions, per-vendor/customer balances, captured due dates, drafts and incoming/outgoing receipt state. Keep `WHATSAPP_ENABLED=false` and simulator off until reviewed. A recovered old receipt snapshot may contain messages already delivered after that snapshot: reconcile these before activating the worker.
Only the owner should approve switching Render to a recovered database. Securely remove plaintext exports once the recovery is verified.

## References

- https://neon.com/docs/manage/backup-pg-dump
- https://github.com/FiloSottile/age
- https://docs.github.com/en/actions/concepts/security/secrets
