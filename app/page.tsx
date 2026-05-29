import Link from "next/link";

export default function Home() {
  const cards = [
    { href: "/recognize", title: "新建/识别接龙", desc: "粘贴微信接龙并自动识别订单" },
    { href: "/batches", title: "历史接龙", desc: "查看保存过的接龙和详情" },
    { href: "/customers", title: "客户管理", desc: "管理客户信息与历史订单" },
    { href: "/analytics", title: "产品分析", desc: "查看 SKU 销量和营收统计" },
    { href: "/performance", title: "业绩分析", desc: "按日期查看销售业绩趋势" },
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold">微信接龙甜品订单系统 MVP</h1>
        <p className="mt-2 text-sm text-zinc-600">
          支持接龙识别、人工修正、批次汇总与客户管理（本地存储）。
        </p>
      </section>
      <section className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-lg font-semibold">{card.title}</p>
            <p className="mt-2 text-sm text-zinc-600">{card.desc}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
