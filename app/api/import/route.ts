import { isAuthorized } from "@/lib/supabaseServer";
import { importAll } from "@/lib/supabaseRepo";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "未授权" }, { status: 401 });
  try {
    const data = await request.json();
    const result = await importAll(data);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "导入失败" }, { status: 500 });
  }
}
