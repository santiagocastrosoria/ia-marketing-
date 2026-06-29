-- Opcional: columnas Meta/Instagram en marketing_objectives
-- Solo ejecutar si querés persistir preferencias de canal en el objetivo.
-- El flujo actual funciona sin estas columnas.

ALTER TABLE marketing_objectives
  ADD COLUMN IF NOT EXISTS meta_channel_preference TEXT DEFAULT 'INSTAGRAM_PRIORITY';

ALTER TABLE marketing_objectives
  ADD COLUMN IF NOT EXISTS placement_strategy TEXT;
