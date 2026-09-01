# ADR 0008: Local and production Supabase environments

- Status: Accepted
- Date: 2026-08-27
- Supersedes the staging requirement in Step 02 only

## Decision

Use a local Supabase stack and one hosted production project (`bgflnssilreepfzxoqpc`) until a dedicated staging project is provisioned. The hosted project is pre-launch and may receive one explicitly approved bootstrap reset after a backup. Its deterministic seed contains two passwordless foundation identities.

After bootstrap, production database changes are forward-only migrations run by the manual GitHub workflow. A linked reset requires the separate `bootstrap-reset` operation, exact project-ref confirmation, and approval through the protected `production` environment.

## Consequences

Local database tests are the migration gate, but they do not replace staging validation. Production carries additional release risk until staging exists. Provisioning staging should supersede this ADR and remove production test identities before real-user launch.
