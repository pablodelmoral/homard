// Supabase Edge Function: Analyze lifelogs and generate summary + action items
// Strategy: fetch lifelogs from Limitless API, summarize with Mistral if available,
// extract action items, and persist to Supabase.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LIMITLESS_API = "https://api.limitless.ai/v1/lifelogs";

function extractActionItems(markdown: string): string[] {
  const lines = markdown.split("\n");
  const items: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("- [ ]") || trimmed.startsWith("* [ ]")) {
      items.push(trimmed.replace(/^- \[ \]\s*|^\* \[ \]\s*/i, ""));
      continue;
    }

    if (/^(todo|follow up|follow-up|remember to|need to|next step)[:\s]/i.test(trimmed)) {
      items.push(trimmed.replace(/^(todo|follow up|follow-up|remember to|need to|next step)[:\s]*/i, ""));
      continue;
    }
  }

  return Array.from(new Set(items)).filter((t) => t.length > 2);
}

function fallbackSummary(lifelogs: any[]): { summary: string; highlights: any } {
  if (!lifelogs.length) {
    return { summary: "No lifelogs found for this date.", highlights: {} };
  }

  const titles = lifelogs.map((l) => l.title).filter(Boolean);
  const summary = `Summary of ${lifelogs.length} entries: ${titles.join(", ")}`.slice(0, 1000);

  return {
    summary,
    highlights: {
      count: lifelogs.length,
      titles,
    },
  };
}

async function summarizeWithMistral(lifelogs: any[]): Promise<{ summary: string; highlights: any } | null> {
  const apiKey = Deno.env.get("MISTRAL_API_KEY");
  if (!apiKey) return null;

  const content = lifelogs
    .map((l: any) => `Title: ${l.title || "(untitled)"}\n${l.markdown || ""}`)
    .join("\n---\n")
    .slice(0, 8000);

  const prompt = `Summarize the day in 5-8 bullet points, then list any action items.
Return JSON with keys: summary (string), highlights (object with bullets array), action_items (array of strings).\n\n${content}`;

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || "";

  try {
    const parsed = JSON.parse(text);
    return {
      summary: parsed.summary || "",
      highlights: parsed.highlights || {},
    };
  } catch (_e) {
    return { summary: text, highlights: {} };
  }
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date"); // YYYY-MM-DD
    const timezone = url.searchParams.get("timezone") || "America/Montreal";

    if (!date) {
      return new Response(JSON.stringify({ error: "Missing date (YYYY-MM-DD)" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const params = new URLSearchParams();
    params.set("date", date);
    params.set("timezone", timezone);
    params.set("limit", "10");

    const lifelogRes = await fetch(`${LIMITLESS_API}?${params}`, {
      headers: {
        "X-API-Key": Deno.env.get("LIMITLESS_API_KEY") || "",
      },
    });

    if (!lifelogRes.ok) {
      const err = await lifelogRes.text();
      return new Response(err, { status: lifelogRes.status });
    }

    const lifelogData = await lifelogRes.json();
    const lifelogs = lifelogData?.data?.lifelogs ?? [];

    let summaryPayload = await summarizeWithMistral(lifelogs);
    if (!summaryPayload) summaryPayload = fallbackSummary(lifelogs);

    const { summary, highlights } = summaryPayload;

    const markdownBlob = lifelogs.map((l: any) => l.markdown || "").join("\n");
    const actionItems = extractActionItems(markdownBlob);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, serviceKey);

    const { error: summaryError } = await supabase
      .from("limitless_summaries")
      .upsert({
        summary_date: date,
        summary,
        highlights,
      }, { onConflict: "summary_date" });

    if (summaryError) {
      return new Response(JSON.stringify({ error: summaryError.message }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    const insertedItems: any[] = [];
    for (const item of actionItems) {
      const { data: row, error } = await supabase
        .from("action_items")
        .insert({ summary_date: date, title: item })
        .select()
        .single();
      if (!error && row) insertedItems.push(row);
    }

    if (insertedItems.length) {
      const { data: columns } = await supabase
        .from("kanban_columns")
        .select("id")
        .eq("name", "Todo")
        .limit(1);

      const todoColumnId = columns?.[0]?.id;
      if (todoColumnId) {
        for (const item of insertedItems) {
          await supabase.from("kanban_items").insert({
            action_item_id: item.id,
            column_id: todoColumnId,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, summary_date: date, summary, action_items: actionItems }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
