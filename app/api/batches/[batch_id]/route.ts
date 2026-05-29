import { isAuthorized } from "@/lib/supabaseServer";
import { getBatch, removeBatch } from "@/lib/supabaseRepo";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ batch_id: string }> }) {
  if (!isAuthorized(request)) return Response.json({ error: "未授权" }, { status: 401 });
  try {
    const { batch_id } = await ctx.params;
    const batch = await getBatch(batch_id);
    return Response.json({ batch });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "读取失败" }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ batch_id: string }> }) {
  if (!isAuthorized(request)) return Response.json({ error: "未授权" }, { status: 401 });
  try {
    const { batch_id } = await ctx.params;
    await removeBatch(batch_id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "删除失败" }, { status: 500 });
  }
}
