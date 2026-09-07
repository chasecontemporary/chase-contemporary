# GoDaddy DNS for chasecontemporary.com: email sending (Resend)

For Kristine. Three records, added in GoDaddy > My Products > chasecontemporary.com > DNS >
Add New Record. Nothing existing is changed or removed; these sit alongside the Google
Workspace records. Once saved, the gallery's sales emails (invoices, replies to collectors)
send from @chasecontemporary.com addresses and are authenticated (DKIM + SPF).

| # | Type | Name (Host) | Value | TTL | Priority |
|---|---|---|---|---|---|
| 1 | TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDsT2VXud5SAEQIkd0q/3dMZcfDIpOzUEp+3itZ2bApDE8SlXm04d4Vi3gYOMveTsjj2J8U33mg06PnVUmM4lLMtMHsIkvXZvCCHvvjjqH4lqX1NUDlyU88F7vJQNpvDgKVMRDVMSJ6xq7zW0WOrVPFF9jdz4VXD2h2FA8ZcFDv0wIDAQAB` | 1 hour | (none) |
| 2 | MX | `send` | `feedback-smtp.us-east-1.amazonses.com` | 1 hour | 10 |
| 3 | TXT | `send` | `v=spf1 include:amazonses.com ~all` | 1 hour | (none) |

Notes
- In GoDaddy the Name field takes just the host part (`resend._domainkey`, `send`), not the
  full domain. GoDaddy appends `.chasecontemporary.com` itself.
- Record 1 is one long value with no spaces or line breaks. Paste it whole.
- Records 2 and 3 live on the `send` subdomain, so they do not touch the existing SPF or MX
  for the main domain (Google Workspace mail keeps working exactly as it does now).
- Propagation is usually minutes, sometimes up to an hour. Resend shows "Verified" on the
  domain page when it sees them (resend.com/domains, account wyatt@chasecontemporary.com).

Alternative, faster: on the Resend domain page there is an "Auto configure" button that opens
a GoDaddy sign-in and writes the three records itself. If Kristine is comfortable signing into
GoDaddy on that screen, that is the whole job.

Added in Resend on 2026-09-07 (domain id 648d0ccd-cae3-431a-96ee-e1218ed3be57, region
us-east-1, return-path `send`, click tracking off, receiving off).
