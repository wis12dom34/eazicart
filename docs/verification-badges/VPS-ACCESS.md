# Connecting the existing Contabo server for a read-only audit

Server supplied by the owner: `169.58.189.217`.
Source candidate supplied by the owner: `/opt/eazicart/source`.
SSH username, port and independently verified host fingerprint are still needed.

No connection has been attempted. No server configuration, data, service, firewall or deployment has been changed.

## What can be completed without connecting

The candidate implementation, subscription/settlement tests, migration compatibility checks, browser checks, screenshots and review package are prepared locally. GitHub configuration and remote branches have been inspected. The next dependent task is to establish the actual live working directories, release commit, local changes, schema/migration history and payment code. Public API field differences show that GitHub main alone cannot establish these facts.

## Simplest temporary-key connection

1. Open your existing Contabo console or existing SSH session. Use an existing account with read access to the EaziCart source; prefer a non-root account with no sudo access for this audit. There is no need to enable password login, share your password, replace existing keys or restart SSH.
2. In that account's home, create `~/.ssh` with mode 700 if necessary. Append the public-key line from `/workspace/eazicart-access/authorized-key-line.txt` to `~/.ssh/authorized_keys`, preserving existing entries. Keep `authorized_keys` mode 600. This file is a **public** authorization line; the private key remains in the Codex workspace, outside Git and the review archive.
3. From the trusted Contabo console, obtain the public host fingerprint:

   ```sh
   ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
   ```

4. Provide the SSH username, SSH port (usually 22, but confirm yours) and that host fingerprint. After authorization, the workspace can verify the server host key and connect using the temporary key. Strict host verification will remain enabled.

Prepared public-key fingerprint: `SHA256:mGw9NSZ3/vm6RRgCjDbDx2UVkGCyhS0furt6M3e8M0U`.
The prepared authorization line expires at **2026-11-07 19:36:45 UTC** and has OpenSSH `restrict` options to disable forwarding and PTY allocation. These options do not themselves make a shell read-only; account permissions and the approved read-only command scope still apply. No private key or password should be sent in chat.

After the audit, remove the authorized-key line identified by comment `eazicart-codex-audit-20261106`, or let its authorization expire. The temporary key is useful only while this workspace is available.

If you prefer to keep shell access entirely on your side, run the reviewed `scripts/audit-verification-read-only.sh` from your own existing server session and supply its output. It reports paths and hashes without printing environment values, process arguments, private keys or customer rows. Further source comparison can then be limited to the relevant sanitized source files.

## Approved initial scope

- Read applicable AGENTS.md instructions and Git status/diffs, preserving remote changes.
- Inspect selected systemd/process metadata and, if already accessible, Docker container image IDs, working directories and mount paths.
- Confirm the actual web/API release roots and schema definitions. Treat `/opt/eazicart/source` as a candidate until these are established.
- Inspect payment verification and public DTO code; reconcile the candidate in a separate local checkout.

Deployment, service control, production SQL/migrations, membership writes, checkout activation and billing-rule changes remain outside the authorization given so far.
