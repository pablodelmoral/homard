# Supabase setup

## Secrets
- `LIMITLESS_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MISTRAL_API_KEY` (optional, for NLP summary)

## Deploy functions
```bash
supabase functions deploy limitless_ingest
supabase functions deploy daily_analyze
```

## Schedule (choose one)
1) Supabase scheduled function (cron)
2) OpenClaw cron in this chat

Example daily schedule (08:00 Montreal):
```
0 8 * * *
```
