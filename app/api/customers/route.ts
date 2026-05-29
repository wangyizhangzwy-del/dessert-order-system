import { isAuthorized } from "@/lib/supabaseServer";
import { listCustomers } from "@/lib/supabaseRepo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "未授权" }, { status: 401 });
  try {
    const customers = await listCustomers();
    return Response.json({ customers });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "读取失败" }, { status: 500 });
  }
}
