"use client";

import {
  buildDeliveryRouteSummary,
  type DeliveryRouteCustomerInput,
  type DeliveryRouteSummary,
} from "@/lib/deliveryRoute";

export function DeliveryRouteAnalysis({
  customers,
}: {
  customers: DeliveryRouteCustomerInput[] | null | undefined;
}) {
  const summary: DeliveryRouteSummary = buildDeliveryRouteSummary(customers);

  if (!summary.hasDelivery) {
    return (
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">送货路线顺序分析</h2>
        <p className="mt-2 text-sm text-zinc-600">今日无需要配送的路线。</p>
      </div>
    );
  }

  const routeText = summary.routeLabels.join(" → ");

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">送货路线顺序分析</h2>

      {routeText ? (
        <p className="mt-2 break-words text-sm leading-relaxed">
          <span className="font-medium text-zinc-800">路线：</span>
          <span className="text-zinc-700">{routeText}</span>
        </p>
      ) : null}

      {summary.stops.length > 0 ? (
        <div className="mt-3 text-sm text-zinc-700">
          <p className="font-medium text-zinc-800">详情：</p>
          <ul className="mt-1 space-y-1">
            {summary.stops.map((stop) => {
              const names = (stop.customers ?? [])
                .map((c) => c?.wechatId ?? "")
                .filter(Boolean)
                .join("、");
              return (
                <li key={stop.key} className="break-words">
                  {stop.label}（{stop.customers.length}单）：{names || "-"}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {summary.unmatched.length > 0 ? (
        <div className="mt-3 text-sm">
          <p className="font-medium text-amber-800">未匹配地址 / 需人工确认：</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-amber-900">
            {summary.unmatched.map((item, idx) => (
              <li key={`${item.wechatId}_${idx}`} className="break-words">
                {item.wechatId}：{item.rawAddress}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
