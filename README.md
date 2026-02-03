# Homard — Limitless + Supabase Assistant

This repo contains the initial scaffolding for a Limitless → Supabase pipeline with daily analysis and proactive messaging, plus a Kanban board for action items.

## What’s included
- SQL schema for tables (lifelogs, summaries, action items, kanban)
- Supabase Edge Function templates:
  - `limitless_ingest` — pulls lifelogs from Limitless API
  - `daily_analyze` — summarizes and creates action items
- A lightweight scheduler spec (cron or heartbeat)

## Setup (high level)
1. Create tables using `supabase/sql/schema.sql`
2. Add secrets in Supabase:
   - `LIMITLESS_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Deploy edge functions in `supabase/functions`
4. Set up a schedule (Supabase scheduled functions or OpenClaw cron)

## Notes
- This repo is safe to keep public if you never commit secrets.
