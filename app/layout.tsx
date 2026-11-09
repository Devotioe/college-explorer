import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "課徑｜跨校課程推薦地圖",
  description: "清大與政大課程搜尋、個人化推薦、相似課比較與推薦地圖互動原型。",
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
