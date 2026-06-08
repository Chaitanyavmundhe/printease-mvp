ALTER TABLE print_orders
ADD COLUMN IF NOT EXISTS guest_token_hash text;

ALTER TABLE documents
ADD COLUMN IF NOT EXISTS guest_token_hash text;

ALTER TABLE documents
ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_print_orders_guest_token_hash ON print_orders(guest_token_hash);
CREATE INDEX IF NOT EXISTS idx_documents_guest_token_hash ON documents(guest_token_hash);
CREATE INDEX IF NOT EXISTS idx_documents_expires_at ON documents(expires_at);
