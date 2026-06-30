import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

/** 轻量 Supabase 读操作，供定时任务 keep-alive，防止 free-tier 项目因 inactivity pause。 */
export async function GET() {
  const timestamp = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    return Response.json(
      { ok: false, connected: false, error: "Supabase 未配置", timestamp },
      { status: 503 }
    );
  }

  try {
    const db = getSupabaseAdmin();
    const { count, error } = await db.from("batches").select("*", { count: "exact", head: true });
    if (error) {
      return Response.json(
        { ok: false, connected: false, error: error.message, timestamp },
        { status: 500 }
      );
    }
    return Response.json({
      ok: true,
      connected: true,
      batchCount: count ?? 0,
      timestamp,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "未知错误";
    return Response.json(
      { ok: false, connected: false, error: message, timestamp },
      { status: 500 }
    );
  }
}
