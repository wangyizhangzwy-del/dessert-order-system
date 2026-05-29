import { isAuthorized } from "@/lib/supabaseServer";
import { listBatches, upsertBatch } from "@/lib/supabaseRepo";
import { SavedJielong } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "未授权" }, { status: 401 });
  try {
    const batches = await listBatches();
    return Response.json({ batches });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "读取失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "未授权" }, { status: 401 });
  try {
    const jielong = (await request.json()) as SavedJielong;
    const batch = await upsertBatch(jielong);
    return Response.json({ batch });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "保存失败" }, { status: 500 });
  }
}
