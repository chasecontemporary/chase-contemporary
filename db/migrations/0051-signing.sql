-- The signing process needs two things the documents table did not carry: when a signer was
-- last nudged, so nobody is reminded twice in a morning, and an index for the Signing page,
-- which reads by status and date rather than by collector.
alter table documents add column if not exists reminded_at timestamptz;
create index if not exists documents_status_idx on documents (status, created_at desc);
comment on column documents.reminded_at is
  'Last time a signer was nudged through DocuSign. Set by the doc_remind action.';
