-- Migration 0016: add next_move_in to turns
-- Tracks the scheduled move-in date for leased units (Vacant-Rented / Notice-Rented).
-- Nullable — most turns won't have one until set manually or synced from AppFolio.

ALTER TABLE public.turns
  ADD COLUMN IF NOT EXISTS next_move_in date;
