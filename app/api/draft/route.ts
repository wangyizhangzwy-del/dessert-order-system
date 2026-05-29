import { isAuthorized } from "@/lib/supabaseServer";
import { clearDraft, getDraft, saveDraft } from "@/lib/supabaseRepo";
import { DraftPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "未授权" }, { status: 401 });
  try {
    const draft = await getDraft();
    return Response.json({ draft });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "读取失败" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "未授权" }, { status: 401 });
  try {
    const payload = (await request.json()) as DraftPayload;
    await saveDraft(payload);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "保存失败" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "未授权" }, { status: 401 });
  try {
    await clearDraft();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "清除失败" }, { status: 500 });
  }
}
