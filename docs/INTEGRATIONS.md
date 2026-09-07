# Integrations: every key, where it goes, what it switches on

All accounts under the gallery identity (wyatt@chasecontemporary.com) so ownership transfers
with the rest of the stack. Every integration is env-gated: the code is deployed and dormant
until its variable exists in Vercel (project chase-engine, Production). Set a variable, redeploy
(or wait for the next deploy), and the feature appears.

Set with: `cd crm && vercel env add NAME production` (paste value) then `vercel --prod`.

## Alerts

| Variable | Switches on | Where to get it |
|---|---|---|
| `SLACK_WEBHOOK_URL` | Floor channel: every inquiry (with claim link), 15-minute unclaimed escalation, money in, morning digest | Slack: the gallery workspace, Apps, Incoming Webhooks, pick the sales channel |
| `CRON_SECRET` | The two cron jobs (`/api/cron/escalate` every 10 min, `/api/cron/digest` 08:00 ET Mon to Sat). Vercel sends it as `Authorization: Bearer` | Any long random string; Vercel reads the same variable |
| `APP_URL` | Links inside alerts and emails (default https://chase-engine.vercel.app) | Set when the engine gets its own domain |

Reps get alerts by email and text when `RESEND_API_KEY` / `TWILIO_*` exist and their
email / mobile is on the Team page.

## Email (Resend)

| Variable | Notes |
|---|---|
| `RESEND_API_KEY` | resend.com, API Keys, full access |
| `MAIL_FROM` | `Chase Contemporary <sales@chasecontemporary.com>`; the domain must be verified in Resend: add the SPF, DKIM and DMARC records it gives you in GoDaddy (Kristine) |
| `MAIL_REPLY_TO` | Optional, default info@chasecontemporary.com |
| `MAIL_BCC` | Optional. A mailbox that receives a copy of every collector email (the audit copy) |

Switches on: Reply / Write in the pipeline drawer and on the collector card (templates:
first reply, follow-up, hold confirmed, selection, details link, invoice with PDF attached,
payment received), Send invoice in Finance, rep alerts, the morning digest. Every send is
logged in `messages` and on the collector timeline. Nothing sends itself to a collector; a
person presses Send.

Until the key exists, every composer offers "Open as draft in my mail" with the same text.

## SMS (Twilio)

| Variable | Notes |
|---|---|
| `TWILIO_ACCOUNT_SID` | Console home |
| `TWILIO_AUTH_TOKEN` | Console home |
| `TWILIO_FROM` | The purchased number, E.164 (`+1310...`). US A2P 10DLC registration is required before carriers deliver; start it the same day, it can take days |

Switches on: the Text lane in the composer (links to the details form, a selection, a pay
link), and text alerts to reps who have a mobile on Team.

## DocuSign

| Variable | Notes |
|---|---|
| `DOCUSIGN_INTEGRATION_KEY` | Apps and Keys, add app, copy Integration Key |
| `DOCUSIGN_USER_ID` | Apps and Keys, your User ID (the API user) |
| `DOCUSIGN_ACCOUNT_ID` | Apps and Keys, API Account ID |
| `DOCUSIGN_PRIVATE_KEY` | Generate RSA keypair in the app, paste the private key (newlines may be `\n`) |
| `DOCUSIGN_BASE` | `demo` (developer sandbox) until DocuSign promotes the key to production, then `prod` |
| `DOCUSIGN_API_BASE` | Only for prod: the account's base URL from Apps and Keys (e.g. `https://na4.docusign.net/restapi`) |
| `DOCUSIGN_CONNECT_SECRET` | Connect, HMAC key, so webhooks are verified |
| `DOCUSIGN_COUNTERSIGNER_EMAIL` | Optional. If set, the gallery countersigns after the collector |

One-time consent: open
`https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=<INTEGRATION_KEY>&redirect_uri=<a redirect URI you added to the app>`
signed in as the API user and click Allow. Connect: add a configuration pointing at
`https://chase-engine.vercel.app/api/docusign-webhook`, JSON, events sent / delivered /
completed / declined / voided, HMAC = the secret above.

Switches on: Send for signature inside any document preview (invoice, certificate). Status
lands in `documents` and on the collector card; the executed PDF is stored on completion.
Production promotion needs 20 successful demo envelopes and a DocuSign review.

## Shopify

| Variable | Notes |
|---|---|
| `SHOPIFY_ADMIN_TOKEN` | Store admin, Settings, Apps and sales channels, Develop apps, create app "Chase Engine", Admin API scopes `read_products, write_products, write_draft_orders, read_draft_orders, read_orders`, install, reveal token (`shpat_...`) |
| `SHOPIFY_API_SECRET` | Same app, API credentials, API secret key (webhook HMAC) |
| `SHOPIFY_STORE` | Default chasecontemporaryshop.myshopify.com |

Switches on: pay links (draft-order invoice URLs) in Finance with the paid webhook settling
the invoice; Push to site as draft in Inventory; sold-sync (a settled work is hidden on the
site the moment it settles; an undo relists it).

## Klaviyo

| Variable | Notes |
|---|---|
| `KLAVIYO_API_KEY` | Settings, API keys, private key with profiles, lists, campaigns, templates read/write |
| `MAILING_ADDRESS` | CAN-SPAM postal address in the campaign footer |

Switches on: audience sync (Audiences page) and campaign push (Campaigns page, after approval).
Sending domain: add Klaviyo's DNS records in GoDaddy as well.

## Sales tax

| Variable | Notes |
|---|---|
| `TAX_NEXUS_STATES` | Comma list of states the gallery collects in (from Kristine / the accountant), e.g. `NY,FL` |
| `TAX_RATE_OVERRIDES` | Optional combined local rates: `NY:8.875,FL:7` |
| `TAXJAR_API_KEY` | Optional. Exact rate by ship-to zip |

Switches on: the suggested tax in the sale wizard's review step. The rep confirms or edits.

## Invoice

| Variable | Notes |
|---|---|
| `WIRE_INSTRUCTIONS` | The full wire block printed on every invoice: bank, ABA, account, beneficiary Zenzeba Group Inc (Kristine) |

## Stripe (parked)

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`: the webhook route exists and is inert. Shopify is
the money lane; leave these unset unless that decision changes.

## Health

`/api/health` is public and reports database up/down and parked inquiries. Point an uptime
monitor at it (BetterStack free tier), alerting to Devyn and Wyatt.
