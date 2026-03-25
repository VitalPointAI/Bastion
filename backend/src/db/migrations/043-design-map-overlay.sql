-- Migration 043: Add map_overlay to operational_designs
-- Phase 56: Visual Operational Approach Editor
ALTER TABLE operational_designs
  ADD COLUMN IF NOT EXISTS map_overlay JSONB DEFAULT '{"symbols":[],"controlMeasures":[]}'::jsonb;
