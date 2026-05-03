-- Migration 0001: Generic Slot Resolver
-- Apply with: drizzle-kit push (or run SQL directly against Neon DB)
-- Safe to run multiple times (all statements use IF NOT EXISTS / DO NOTHING patterns).

-- 1. product_slots: add discriminatorAttributes column
ALTER TABLE product_slots
  ADD COLUMN IF NOT EXISTS discriminator_attributes JSONB;

-- 2. style_calculator_fields: add data-driven layout columns
ALTER TABLE style_calculator_fields
  ADD COLUMN IF NOT EXISTS display_column INTEGER,
  ADD COLUMN IF NOT EXISTS display_position INTEGER,
  ADD COLUMN IF NOT EXISTS display_column_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS visibility_condition JSONB;

-- 3. fence_styles: add panel size config columns (replaces PANEL_SIZE_REGISTRY hardcoding)
ALTER TABLE fence_styles
  ADD COLUMN IF NOT EXISTS panel_increment INTEGER,
  ADD COLUMN IF NOT EXISTS panel_field_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS panel_prefix VARCHAR(10);

-- 4. Backfill: set discriminator_attributes on existing glass-panels slots.
--    Extracts numeric panel width from internalId suffix (e.g. "GP-1200" → size_mm = "1200").
--    Only touches slots with field_name = 'glass-panels' that don't yet have discriminator_attributes.
UPDATE product_slots
SET discriminator_attributes = jsonb_build_object(
  'size_mm',
  -- Extract trailing integer from internalId (e.g. "GP-0250" → "250", "GP-1200" → "1200")
  CAST(CAST(substring(internal_id FROM '[0-9]+$') AS INTEGER) AS TEXT)
)
WHERE field_name = 'glass-panels'
  AND discriminator_attributes IS NULL
  AND internal_id ~ '[0-9]+$';

-- 5. Backfill: set panel size config on fence_styles for glass-pool-spigots.
--    Idempotent — only sets if not already configured.
UPDATE fence_styles
SET
  panel_increment  = COALESCE(panel_increment, 50),
  panel_field_name = COALESCE(panel_field_name, 'glass-panels'),
  panel_prefix     = COALESCE(panel_prefix, 'GP')
WHERE code = 'glass-pool-spigots';

UPDATE fence_styles
SET
  panel_increment  = COALESCE(panel_increment, 50),
  panel_field_name = COALESCE(panel_field_name, 'glass-panels'),
  panel_prefix     = COALESCE(panel_prefix, 'GP')
WHERE code = 'glass-pool-channel';

UPDATE fence_styles
SET
  panel_increment  = COALESCE(panel_increment, 50),
  panel_field_name = COALESCE(panel_field_name, 'glass-panels'),
  panel_prefix     = COALESCE(panel_prefix, 'GP')
WHERE code IN ('glass-bal-spigots', 'glass-bal-channel', 'glass-bal-standoffs', 'custom-frameless');
