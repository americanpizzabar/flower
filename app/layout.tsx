import "@/styles/globals.css";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hanakotoba — 多言語花屋アシスタント",
  description: "外国人のお客様にも、その日の花でぴったりの一輪を。",
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
            <Link href="/consult">イメージで提案</Link>
            <Link href="/show">花を見せる</Link>
            <Link href="/interpret">通訳</Link>
            <Link href="/welcome">店舗紹介</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
