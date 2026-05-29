"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function BatchDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  useEffect(() => {
    router.replace(`/recognize?batch_id=${params.id}`);
  }, [params.id, router]);
  return <div className="rounded-xl bg-white p-4 shadow-sm">正在打开历史接龙...</div>;
}
