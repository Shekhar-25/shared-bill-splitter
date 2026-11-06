-- SplitNest schema. All money is stored as integer cents.
-- D1 enforces foreign keys, so every FOREIGN KEY below is active.

CREATE TABLE homes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Stops blank home names even if the API validation is bypassed.
  CONSTRAINT homes_name_not_blank CHECK (length(trim(name)) > 0)
);

-- `seq` is an ever-increasing counter: it is the member creation order.
-- Splits and balances sort by it, so extra cents always go to the earliest members.
CREATE TABLE members (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL,
  home_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Public ids are unique, and shares reference them.
  CONSTRAINT members_id_unique UNIQUE (id),
  -- A member can not belong to a home that does not exist.
  CONSTRAINT members_home_fk FOREIGN KEY (home_id) REFERENCES homes (id) ON DELETE CASCADE,
  CONSTRAINT members_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE INDEX members_home_order_idx ON members (home_id, seq);

CREATE TABLE bills (
  id TEXT PRIMARY KEY,
  home_id TEXT NOT NULL,
  title TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT bills_home_fk FOREIGN KEY (home_id) REFERENCES homes (id) ON DELETE CASCADE,
  -- A bill must be a positive whole number of cents.
  CONSTRAINT bills_total_positive CHECK (typeof(total_cents) = 'integer' AND total_cents > 0),
  CONSTRAINT bills_title_not_blank CHECK (length(trim(title)) > 0)
);

CREATE INDEX bills_home_idx ON bills (home_id, created_at);

-- `payment_key` is the Idempotency-Key that paid the share. It is NULL until paid.
CREATE TABLE shares (
  id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  paid_at TEXT,
  payment_key TEXT,
  CONSTRAINT shares_bill_fk FOREIGN KEY (bill_id) REFERENCES bills (id) ON DELETE CASCADE,
  CONSTRAINT shares_member_fk FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE,
  -- A share can be 0 cents (1 cent split between 3 people) but never negative or fractional.
  CONSTRAINT shares_amount_non_negative CHECK (typeof(amount_cents) = 'integer' AND amount_cents >= 0),
  -- One share per member per bill.
  CONSTRAINT shares_one_per_member UNIQUE (bill_id, member_id),
  -- A share is either unpaid (no time, no key) or fully paid (time and key).
  CONSTRAINT shares_paid_state CHECK ((paid_at IS NULL) = (payment_key IS NULL))
);

CREATE INDEX shares_member_idx ON shares (member_id);
