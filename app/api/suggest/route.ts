import { NextResponse } from "next/server";
import { pool, currentSeason } from "@/lib/db";
import { rankSuggestions } from "@/lib/ai";
import type { InventoryItemWithFlower } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const client = await pool().connect();
  try {
    const body = await req.json();
    const month: number | undefined = body.month;
    const day: number | undefined = body.day;
    const keyword: string | undefined = body.keyword;
    const color: string | undefined = body.color;
    const budget: number | undefined = body.budget;
    const todayOnly: boolean = !!body.todayOnly;
    const preferSeasonal: boolean = !!body.preferSeasonal;

    const season = currentSeason();

    const baseSelect = `
      SELECT
        i.id, i.flower_id, i.color, i.stock, i.received_at, i.price,
        i.photo_url, i.note, i.updated_at,
        row_to_json(f.*) AS flower
      FROM inventory i
      JOIN flowers f ON f.id = i.flower_id
      WHERE i.stock > 0
    `;

    let candidates: InventoryItemWithFlower[] = [];

    if (month && day) {
      const where: string[] = [
        `EXISTS (SELECT 1 FROM jsonb_array_elements(f.birth_days) bd WHERE (bd->>'month')::int = $1 AND (bd->>'day')::int = $2)`,
      ];
      const params: unknown[] = [month, day];
      if (todayOnly) where.push(`i.received_at = CURRENT_DATE`);
      const r = await client.query(`${baseSelect} AND ${where.join(" AND ")}`, params);
      candidates = r.rows as InventoryItemWithFlower[];
    }

    if (candidates.length === 0) {
      const where: string[] = [];
      const params: unknown[] = [];
      let idx = 1;
      if (todayOnly) where.push(`i.received_at = CURRENT_DATE`);
      if (color) {
        where.push(`(i.color = $${idx} OR f.default_color = $${idx})`);
        params.push(color);
        idx++;
      }
      if (budget) {
        where.push(`(i.price IS NULL OR i.price <= $${idx})`);
        params.push(budget);
        idx++;
      }
      const whereSql = where.length > 0 ? ` AND ${where.join(" AND ")}` : "";
      const r = await client.query(`${baseSelect}${whereSql}`, params);
      candidates = r.rows as InventoryItemWithFlower[];
    }

    if (preferSeasonal) {
      const seasonal = candidates.filter((c) => c.flower.seasons?.includes(season));
      if (seasonal.length > 0) candidates = seasonal;
    }

    const ranking = await rankSuggestions(
      {
        birthday: month && day ? { month, day } : undefined,
        keyword,
        color,
        budget,
        preferSeasonal,
      },
      candidates,
    );

    const ordered = ranking.ordered_inventory_ids
      .map((id) => candidates.find((c) => c.id === id))
      .filter((x): x is InventoryItemWithFlower => !!x);

    return NextResponse.json({
      matches: ordered.length > 0 ? ordered : candidates,
      comment_ja: ranking.comment_ja,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    client.release();
  }
}
