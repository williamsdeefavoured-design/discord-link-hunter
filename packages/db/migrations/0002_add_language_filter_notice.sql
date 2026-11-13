-- ==============================================================================
-- Migration: 0002_add_language_filter_notice.sql
-- Project: Discord Link Hunter v2.1
-- Mode: Strictly Additive (Non-destructive)
-- Target: Supabase PostgreSQL (public schema)
-- Description: Add missing language_filter_notice column to search_jobs table
-- ==============================================================================

ALTER TABLE search_jobs ADD COLUMN IF NOT EXISTS language_filter_notice TEXT;

