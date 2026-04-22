import { NextResponse } from "next/server";
import { z } from "zod";
import { extractTextFromImages } from "@/lib/ocr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  images: z.array(z.object({ imageDataUrl: z.string().min(1) })).min(1).max(8),
  source: z.enum(["photo", "scan"]),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "請提供可辨識的圖片資料。" }, { status: 400 });
  }

  try {
    const result = await extractTextFromImages(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    console.error("OCR failed", err);
    const message = err instanceof Error ? err.message : "OCR failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
