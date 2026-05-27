import { sql, db } from "@vercel/postgres";
import type { Flower, InventoryItemWithFlower } from "./types";

export async function getAllFlowers(): Promise<Flower[]> {
  const { rows } = await sql<Flower>`SELECT * FROM flowers ORDER BY id`;
  return rows;
}

const INVENTORY_SELECT = `
  SELECT
    i.id, i.flower_id, i.color, i.stock, i.received_at, i.price,
    i.photo_url, i.note, i.updated_at,
    row_to_json(f.*) AS flower
  FROM inventory i
  JOIN flowers f ON f.id = i.flower_id
`;

export async function getInventoryInStock(): Promise<InventoryItemWithFlower[]> {
  const client = await db.connect();
  try {
    const r = await client.query(
      `${INVENTORY_SELECT} WHERE i.stock > 0 ORDER BY i.received_at DESC, i.id DESC`,
    );
    return r.rows as InventoryItemWithFlower[];
  } finally {
    client.release();
  }
}

export async function getInventoryByIds(ids: number[]): Promise<InventoryItemWithFlower[]> {
  if (ids.length === 0) return [];
  const client = await db.connect();
  try {
    const r = await client.query(`${INVENTORY_SELECT} WHERE i.id = ANY($1::int[])`, [ids]);
    return r.rows as InventoryItemWithFlower[];
  } finally {
    client.release();
  }
}

export function flowerDisplayName(flower: Flower, lang = "ja"): string {
  return flower.names[lang] || flower.names.ja || flower.names.en || flower.slug;
}
