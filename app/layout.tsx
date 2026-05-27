import "@/styles/globals.css";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hanakotoba — 多言語花屋アシスタント",
  description: "外国人のお客様にも、その日の在庫から最適な一輪を。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header>
          <nav>
            <Link href="/" className="brand">
              🌸 Hanakotoba
            </Link>
            <Link href="/chat">接客チャット</Link>
            <Link href="/suggest">花を提案</Link>
            <Link href="/inventory">在庫管理</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
