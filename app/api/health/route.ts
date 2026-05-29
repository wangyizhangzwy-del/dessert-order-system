import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

// 诊断端点：检查服务端是否正确配置 Supabase，并尝试统计 batches 行数。
// 不返回任何密钥，仅返回布尔与计数，便于线上排查。
export async function GET() {
  const configured = isSupabaseConfigured();
  const requiresPassword = Boolean(process.env.APP_PASSWORD);
  if (!configured) {
    return Response.json({
      supabaseConfigured: false,
      requiresPassword,
      message: "服务端缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY",
    });
  }
  try {
    const db = getSupabaseAdmin();
    const { count, error } = await db.from("batches").select("*", { count: "exact", head: true });
    if (error) {
      return Response.json(
        { supabaseConfigured: true, requiresPassword, connected: false, error: error.message },
        { status: 500 }
      );
    }
    return Response.json({ supabaseConfigured: true, requiresPassword, connected: true, batchCount: count ?? 0 });
  } catch (e) {
    return Response.json(
      { supabaseConfigured: true, requiresPassword, connected: false, error: e instanceof Error ? e.message : "未知错误" },
      { status: 500 }
    );
  }
}
