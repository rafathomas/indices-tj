import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";

export const runtime = "edge";

export async function GET() {
  if (!env.DB) return NextResponse.json({ indices: [] });
  const { results } = await env.DB.prepare("SELECT values_now.index_slug, values_now.index_name, values_now.month, values_now.value, values_now.source_url FROM index_values values_now WHERE values_now.reference_year = (SELECT MAX(reference_year) FROM index_values newer WHERE newer.index_slug = values_now.index_slug) ORDER BY values_now.index_name, values_now.month").all();
  const grouped = new Map<string, { slug: string; name: string; points: unknown[] }>();
  for (const row of results as Array<Record<string, string | number>>) {
    const current = grouped.get(row.index_slug as string) ?? { slug: row.index_slug as string, name: row.index_name as string, points: [] };
    current.points.push({ month: row.month, value: row.value, sourceUrl: row.source_url }); grouped.set(current.slug, current);
  }
  return NextResponse.json({ indices: [...grouped.values()] });
}
