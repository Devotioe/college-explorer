import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "課徑｜政大成績單與課程推薦",
  description: "政大成績單辨識、修課紀錄確認、個人化課程推薦與學習地圖。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className="antialiased">{children}</body>
    </html>
  );
}
