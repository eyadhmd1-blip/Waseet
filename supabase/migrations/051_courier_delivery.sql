-- ============================================================
-- Migration 051: Courier / Parcel Delivery Service
-- ============================================================
-- Adds pickup/dropoff address fields and package size to requests.
-- These are optional columns — null for all non-courier requests.
-- ============================================================

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS pickup_address  text,
  ADD COLUMN IF NOT EXISTS dropoff_address text,
  ADD COLUMN IF NOT EXISTS package_size    text;   -- 'small' | 'medium' | 'large'

-- Index for courier requests (admins / future delivery dashboard)
CREATE INDEX IF NOT EXISTS idx_requests_courier
  ON requests (category_slug)
  WHERE category_slug = 'courier';
