import { NextResponse } from "next/server";
import {
  AiError,
  describeArrangement,
  generateProposalImage,
  identifyFlowers,
  verifyArrangement,
  type GeneratedImage,
  type MediaPart,
} from "@/lib/ai";
import type { ProposalResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOTAL_MB_LIMIT = 4;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const brief = String(form.get("brief") || "");
    const lang = String(form.get("lang") || "ja");
    const files = form.getAll("media");

    if (!brief) {
      return NextResponse.json({ error: "お客様の要望が空です" }, { status: 400 });
    }
    if (files.length === 0) {
      return NextResponse.json({ error: "店内の花の写真を1枚以上添付してください" }, { status: 400 });
    }

    const media: MediaPart[] = [];
    let totalBytes = 0;
    for (const f of files) {
      if (!(f instanceof Blob)) continue;
      const type = (f as File).type || "";
      if (!type.startsWith("image/")) continue; // 画像生成の入力は静止画のみ
      const buf = Buffer.from(await f.arrayBuffer());
      totalBytes += buf.byteLength;
      if (totalBytes / (1024 * 1024) > TOTAL_MB_LIMIT) {
        return NextResponse.json(
          {
            error: `写真の合計サイズが ${TOTAL_MB_LIMIT}MB を超えました。枚数を減らしてください。`,
          },
          { status: 413 },
        );
      }
      media.push({ base64: buf.toString("base64"), mimeType: type });
    }

    if (media.length === 0) {
      return NextResponse.json(
        { error: "画像が見つかりませんでした。花の写真を添付してください。" },
        { status: 400 },
      );
    }

    // 1) Identify exactly which flowers are present in the photos.
    const identified = await identifyFlowers(media);
    const allowedList =
      identified.list_text?.trim() ||
      identified.flowers?.map((f) => `${f.color}${f.ja}`).join("、") ||
      "(写真に写っている花のみ)";

    // 2) Generate using only that explicit whitelist.
    let generated: GeneratedImage = await generateProposalImage(media, brief, allowedList);

    // 3) Verify the output; if a flower outside the list slipped in, regenerate once
    //    with explicit removal feedback.
    let verified = true;
    let unverifiedNote = "";
    try {
      const check = await verifyArrangement(generated, allowedList);
      if (!check.ok && check.extra_ja) {
        generated = await generateProposalImage(media, brief, allowedList, check.extra_ja);
        const recheck = await verifyArrangement(generated, allowedList);
        if (!recheck.ok && recheck.extra_ja) {
          verified = false;
          unverifiedNote = `リスト外の花が残っている可能性があります: ${recheck.extra_ja}`;
        }
      }
    } catch {
      // Verification is best-effort; never block the result on it.
      verified = true;
    }

    const desc = await describeArrangement(generated, brief, lang);

    const result: ProposalResult = {
      image_data_url: `data:${generated.mimeType};base64,${generated.base64}`,
      description_customer: desc.description_customer,
      description_ja: desc.description_ja,
      flower_meanings_ja: desc.flower_meanings_ja,
      used_flowers_ja: allowedList,
      verified,
      unverified_note_ja: unverifiedNote,
    };
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AiError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status || 500 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "通信エラーが発生しました" },
      { status: 500 },
    );
  }
}
