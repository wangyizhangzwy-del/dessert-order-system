import { isAuthorized } from "@/lib/supabaseServer";
import { getSettings, saveSettings } from "@/lib/supabaseRepo";
import { AppSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "未授权" }, { status: 401 });
  try {
    const settings = await getSettings();
    return Response.json({ settings });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "读取失败" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "未授权" }, { status: 401 });
  try {
    const settings = (await request.json()) as AppSettings;
    await saveSettings(settings);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "保存失败" }, { status: 500 });
  }
}
