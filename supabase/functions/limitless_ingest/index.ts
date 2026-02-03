// Supabase Edge Function: Pull lifelogs from Limitless API
// Secrets required: LIMITLESS_API_KEY

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const LIMITLESS_API = "https://api.limitless.ai/v1/lifelogs";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date"); // optional YYYY-MM-DD
    const timezone = url.searchParams.get("timezone") || "America/Montreal";

    const params = new URLSearchParams();
    if (date) params.set("date", date);
    params.set("timezone", timezone);
    params.set("limit", "10");

    const res = await fetch(`${LIMITLESS_API}?${params}`, {
      headers: {
        "X-API-Key": Deno.env.get("LIMITLESS_API_KEY") || "",
      },
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(err, { status: res.status });
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
