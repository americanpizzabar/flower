import { NextResponse } from "next/server";
import { chatWithCustomer } from "@/lib/ai";
import { getInventoryInStock, getInventoryByIds } from "@/lib/flowers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message: string = body.message;
    const history: { role: "customer" | "staff"; text: string }[] = body.history || [];

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const inventory = await getInventoryInStock();
    const result = await chatWithCustomer(message, history, inventory);
    const suggested = await getInventoryByIds(result.suggested_inventory_ids || []);

    return NextResponse.json({ ...result, suggested });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
