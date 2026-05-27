import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SeedFlower {
  slug: string;
  names: Record<string, string>;
  meanings: Record<string, string[]>;
  birth_days: { month: number; day: number }[];
  seasons: string[];
  default_color?: string;
  image_url?: string;
  notes?: string;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (process.env.SEED_SECRET && secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const schemaPath = path.join(process.cwd(), "data", "schema.sql");
  const seedPath = path.join(process.cwd(), "data", "flowers-seed.json");
  const schema = await readFile(schemaPath, "utf-8");
  const seedRaw = await readFile(seedPath, "utf-8");
  const flowers: SeedFlower[] = JSON.parse(seedRaw);

  const client = await pool().connect();
  try {
    // Run each schema statement individually
    for (const stmt of schema.split(";").map((s) => s.trim()).filter(Boolean)) {
      await client.query(stmt);
    }

    let inserted = 0;
    for (const f of flowers) {
      const r = await client.query(
        `INSERT INTO flowers (slug, names, meanings, birth_days, seasons, default_color, image_url, notes)
         VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7, $8)
         ON CONFLICT (slug) DO UPDATE SET
           names = EXCLUDED.names,
           meanings = EXCLUDED.meanings,
           birth_days = EXCLUDED.birth_days,
           seasons = EXCLUDED.seasons,
           default_color = EXCLUDED.default_color,
           image_url = COALESCE(EXCLUDED.image_url, flowers.image_url),
           notes = EXCLUDED.notes
         RETURNING id`,
        [
          f.slug,
          JSON.stringify(f.names),
          JSON.stringify(f.meanings),
          JSON.stringify(f.birth_days || []),
          JSON.stringify(f.seasons || []),
          f.default_color || null,
          f.image_url || null,
          f.notes || null,
        ],
      );
      if (r.rowCount) inserted++;
    }
    return NextResponse.json({ ok: true, flowers: inserted });
  } finally {
    client.release();
  }
}
