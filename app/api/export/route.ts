import { isAuthorized } from "@/lib/supabaseServer";
import { exportAll } from "@/lib/supabaseRepo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "未授权" }, { status: 401 });
  try {
    const data = await exportAll();
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "导出失败" }, { status: 500 });
  }
}
