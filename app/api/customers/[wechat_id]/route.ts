import { isAuthorized } from "@/lib/supabaseServer";
import { updateCustomerAddress } from "@/lib/supabaseRepo";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  ctx: { params: Promise<{ wechat_id: string }> }
) {
  if (!isAuthorized(request)) return Response.json({ error: "未授权" }, { status: 401 });
  try {
    const { wechat_id } = await ctx.params;
    const body = (await request.json()) as { default_address?: string };
    const customer = await updateCustomerAddress(
      decodeURIComponent(wechat_id),
      body.default_address ?? ""
    );
    return Response.json({ customer });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "更新失败" }, { status: 500 });
  }
}
