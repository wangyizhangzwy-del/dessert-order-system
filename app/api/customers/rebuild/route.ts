import { isAuthorized } from "@/lib/supabaseServer";
import { backfillCustomerAddresses } from "@/lib/supabaseRepo";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "未授权" }, { status: 401 });
  try {
    const result = await backfillCustomerAddresses();
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "回填失败" }, { status: 500 });
  }
}
