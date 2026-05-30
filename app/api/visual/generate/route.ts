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

    // 3) Verify the output; if a flower outside the list slipped in, regenerate
    //    once with explicit removal feedback. Whatever the verifier still flags
    //    after that is handed to the description step so it can be disclosed to
    //    the customer rather than silently shown.
    let detectedExtras = "";
    try {
      const check = await verifyArrangement(generated, allowedList);
      if (!check.ok && check.extra_ja) {
        generated = await generateProposalImage(media, brief, allowedList, check.extra_ja);
        const recheck = await verifyArrangement(generated, allowedList);
        detectedExtras = recheck.ok ? "" : recheck.extra_ja || "";
      }
    } catch {
      // Verification is best-effort; never block the result on it.
      detectedExtras = "";
    }

    // 4) Describe the final image, comparing it against the whitelist. The
    //    description step re-checks the image and, if any flower/greenery shown
    //    isn't actually in stock, says so explicitly in the customer's language.
    const desc = await describeArrangement(generated, brief, lang, allowedList, detectedExtras);

    const unavailable = (desc.unavailable_ja || detectedExtras).trim();
    const result: ProposalResult = {
      image_data_url: `data:${generated.mimeType};base64,${generated.base64}`,
      description_customer: desc.description_customer,
      description_ja: desc.description_ja,
      flower_meanings_ja: desc.flower_meanings_ja,
      used_flowers_ja: allowedList,
      verified: !unavailable,
      unverified_note_ja: unavailable
        ? `画像には在庫リストに無い花・緑が含まれている可能性があります: ${unavailable}（お客様向けの説明にも「現在ご用意がない」旨を記載しています）`
        : "",
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
