import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getInventoryInStock } from "@/lib/flowers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const filter = url.searchParams.get("filter"); // "today" | "in_stock" | "seasonal" | null

  const client = await pool().connect();
  try {
    if (filter === "today") {
      const r = await client.query(
        `SELECT i.id, i.flower_id, i.color, i.stock, i.received_at, i.price,
                i.photo_url, i.note, i.updated_at, row_to_json(f.*) AS flower
         FROM inventory i JOIN flowers f ON f.id = i.flower_id
         WHERE i.received_at = CURRENT_DATE
         ORDER BY i.id DESC`,
      );
      return NextResponse.json(r.rows);
    }
    if (filter === "all") {
      const r = await client.query(
        `SELECT i.id, i.flower_id, i.color, i.stock, i.received_at, i.price,
                i.photo_url, i.note, i.updated_at, row_to_json(f.*) AS flower
         FROM inventory i JOIN flowers f ON f.id = i.flower_id
         ORDER BY i.received_at DESC, i.id DESC`,
      );
      return NextResponse.json(r.rows);
    }
    const items = await getInventoryInStock();
    return NextResponse.json(items);
  } finally {
    client.release();
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const flower_id = Number(body.flower_id);
  const color: string | null = body.color || null;
  const stock = Number(body.stock || 0);
  const received_at: string = body.received_at || new Date().toISOString().slice(0, 10);
  const price: number | null = body.price != null ? Number(body.price) : null;
  const photo_url: string | null = body.photo_url || null;
  const note: string | null = body.note || null;

  if (!flower_id || Number.isNaN(flower_id)) {
    return NextResponse.json({ error: "flower_id is required" }, { status: 400 });
  }

  const client = await pool().connect();
  try {
    const r = await client.query(
      `INSERT INTO inventory (flower_id, color, stock, received_at, price, photo_url, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [flower_id, color, stock, received_at, price, photo_url, note],
    );
    return NextResponse.json(r.rows[0]);
  } finally {
    client.release();
  }
}
