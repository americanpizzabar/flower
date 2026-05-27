import { NextResponse } from "next/server";
import { db } from "@vercel/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const allowed = ["color", "stock", "received_at", "price", "photo_url", "note"] as const;
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = $${idx}`);
      vals.push(body[key]);
      idx++;
    }
  }
  if (sets.length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }
  sets.push(`updated_at = now()`);
  vals.push(Number(id));

  const client = await db.connect();
  try {
    const r = await client.query(
      `UPDATE inventory SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      vals,
    );
    if (r.rowCount === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(r.rows[0]);
  } finally {
    client.release();
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await db.connect();
  try {
    const r = await client.query(`DELETE FROM inventory WHERE id = $1`, [Number(id)]);
    return NextResponse.json({ deleted: r.rowCount });
  } finally {
    client.release();
  }
}
