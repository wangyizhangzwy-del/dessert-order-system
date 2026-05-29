"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "首页" },
  { href: "/recognize", label: "新建/识别" },
  { href: "/batches", label: "历史接龙" },
  { href: "/customers", label: "客户管理" },
  { href: "/analytics", label: "产品分析" },
  { href: "/performance", label: "业绩分析" },
  { href: "/backup", label: "数据备份" },
];

export function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-3">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap ${
                active ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
