import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";

export const runtime = "edge";
const SOURCE = "https://www.tjsp.jus.br/PrimeiraInstancia/CalculosJudiciais/Comunicado?codigoComunicado=2528";
const YEAR = new Date().getFullYear();
type Attachment = { name: string; url: string };

export async function POST() {
  if (!env.DB) return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 });
  try {
    const page = await fetch(SOURCE, { headers: { "User-Agent": "IndicesTJSP/1.0 (dados publicos)" } }); if (!page.ok) throw new Error(`Fonte oficial respondeu ${page.status}.`);
    let imported = 0, skipped = 0;
    for (const attachment of findAttachments(await page.text())) {
      try {
        const pdf = await fetch(attachment.url); if (!pdf.ok || !(pdf.headers.get("content-type") ?? "").includes("pdf")) { skipped++; continue; }
        const values = await valuesForCurrentYear(await pdf.arrayBuffer()); if (!values.length) { skipped++; continue; }
        const slug = attachment.name.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        await env.DB.batch(values.map((value, month) => env.DB!.prepare("INSERT INTO index_values (index_slug,index_name,reference_year,month,value,source_url,collected_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(index_slug,reference_year,month) DO UPDATE SET value=excluded.value,source_url=excluded.source_url,collected_at=CURRENT_TIMESTAMP").bind(slug, attachment.name, YEAR, month + 1, value, attachment.url)));
        imported++;
      } catch { skipped++; }
    }
    return NextResponse.json({ imported, skipped });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao consultar a fonte." }, { status: 502 }); }
}
function findAttachments(html: string): Attachment[] { return [...html.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({ url: new URL(m[1].replace(/&amp;/g, "&"), SOURCE).href, name: m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() })).filter((x) => /FileFetch|\.pdf/i.test(x.url) && x.name.length > 1); }
async function valuesForCurrentYear(buffer: ArrayBuffer): Promise<number[]> {
  const raw = new Uint8Array(buffer); const text = new TextDecoder("latin1").decode(raw); const chunks = [text];
  for (const match of text.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) { const bytes = Uint8Array.from(match[1], (c) => c.charCodeAt(0)); for (const format of ["deflate", "deflate-raw"] as const) { try { chunks.push(new TextDecoder("latin1").decode(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format))).arrayBuffer())); break; } catch { /* next */ } } }
  const normalized = chunks.join("\n").replace(/\\([()\\])/g, "$1").replace(/\s+/g, " "); const row = normalized.match(new RegExp(`(?:^|\\s)${YEAR}\\s+(.{1,500}?)(?:\\s+${YEAR}(?:\\s|$)|$)`));
  return row ? [...row[1].matchAll(/-?\d{1,3}(?:[.,]\d{1,4})?\s*%/g)].map((m) => Number(m[0].replace("%", "").replace(".", "").replace(",", "."))).filter(Number.isFinite).slice(0, 12) : [];
}
