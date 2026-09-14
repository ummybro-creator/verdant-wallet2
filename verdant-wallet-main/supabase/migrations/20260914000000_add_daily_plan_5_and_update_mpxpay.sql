-- Migration: Add Daily Plan 5 and update recharge presets
-- =========================================================================
-- Details for Daily Plan 5:
--   Name: Daily Plan 5
--   Code: a5
--   Kind: daily
--   Price: ₹2,000
--   Daily Earning: ₹14,000
--   Duration: 1 day
--   Total Earning: ₹14,000
-- =========================================================================

-- Shift sort order of existing VIP plans to make room for Daily Plan 5 (sort 5)
UPDATE public.plans SET sort = sort + 1 WHERE sort >= 5 AND code NOT IN ('a5');

-- Insert or update Daily Plan 5
INSERT INTO public.plans (code, name, kind, price, daily, days, total, image, sort, active)
VALUES ('a5', 'Daily Plan 5', 'daily', 2000.00, 14000.00, 1, 14000.00, 'butterscotch', 5, true)
ON CONFLICT (code) DO UPDATE SET
  name   = EXCLUDED.name,
  kind   = EXCLUDED.kind,
  price  = EXCLUDED.price,
  daily  = EXCLUDED.daily,
  days   = EXCLUDED.days,
  total  = EXCLUDED.total,
  image  = EXCLUDED.image,
  sort   = EXCLUDED.sort,
  active = EXCLUDED.active;

-- Update recharge presets in app_settings to include 2000
UPDATE public.app_settings
SET recharge_presets = ARRAY[290, 560, 750, 800, 1100, 1400, 2000, 2600, 3300, 5000]
WHERE id = true;
