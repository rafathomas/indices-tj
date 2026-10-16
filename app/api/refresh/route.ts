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
  const raw = new Uint8Array(buffer); const chunks: string[] = [];
  for (const bytes of pdfStreams(raw)) for (const format of ["deflate", "deflate-raw"] as const) { try { chunks.push(new TextDecoder("latin1").decode(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format))).arrayBuffer())); break; } catch { /* try the alternate stream format */ } }
  const normalized = chunks.map(pdfText).join("\n").replace(/\s+/g, " "); const row = normalized.match(new RegExp(`(?:^|\\s)${YEAR}\\s+(.{1,500}?)(?:\\s+${YEAR}(?:\\s|$)|$)`));
  return row ? [...row[1].matchAll(/-?\d{1,3}(?:[.,]\d{1,4})?\s*%/g)].map((m) => Number(m[0].replace("%", "").replace(".", "").replace(",", "."))).filter(Number.isFinite).slice(0, 12) : [];
}

function pdfStreams(pdf: Uint8Array) {
  const start = new TextEncoder().encode("stream"); const end = new TextEncoder().encode("endstream"); const streams: Uint8Array[] = [];
  let offset = 0;
  while (offset < pdf.length) {
    const marker = byteIndexOf(pdf, start, offset); if (marker < 0) break;
    let dataStart = marker + start.length; if (pdf[dataStart] === 13) dataStart++; if (pdf[dataStart] === 10) dataStart++;
    const dataEnd = byteIndexOf(pdf, end, dataStart); if (dataEnd < 0) break;
    let contentEnd = dataEnd; while (contentEnd > dataStart && (pdf[contentEnd - 1] === 10 || pdf[contentEnd - 1] === 13)) contentEnd--;
    streams.push(pdf.slice(dataStart, contentEnd)); offset = dataEnd + end.length;
  }
  return streams;
}

function byteIndexOf(haystack: Uint8Array, needle: Uint8Array, from: number) {
  outer: for (let index = from; index <= haystack.length - needle.length; index++) { for (let cursor = 0; cursor < needle.length; cursor++) if (haystack[index + cursor] !== needle[cursor]) continue outer; return index; }
  return -1;
}

// PDFs from the TJSP use kerning arrays such as [(0)-10(,)6(2)-10(0)-10(%)] TJ.
// Joining the literal fragments restores the visible value (0,20%) before matching a year row.
function pdfText(content: string) {
  let output = "";
  for (const operation of content.matchAll(/\[([\s\S]*?)\]\s*TJ|\((?:\\.|[^\\)])*\)\s*Tj/g)) {
    const fragments = operation[1] ?? operation[0];
    for (const fragment of fragments.matchAll(/\(((?:\\.|[^\\)])*)\)/g)) output += fragment[1].replace(/\\([()\\])/g, "$1");
    output += " ";
  }
  return output;
}
