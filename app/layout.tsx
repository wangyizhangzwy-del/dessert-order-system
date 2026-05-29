import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TopNav } from "@/app/components/TopNav";
import { PasswordGate } from "@/app/components/PasswordGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "微信甜品接龙订单系统",
  description: "识别微信接龙甜品订单",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-50 text-zinc-900">
        <PasswordGate>
          <TopNav />
          <main className="mx-auto w-full max-w-5xl px-4 py-4">{children}</main>
        </PasswordGate>
      </body>
    </html>
  );
}
