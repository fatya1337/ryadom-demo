import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Рядом — пространство психотерапевта",
  description:
    "Дневники пациентов, наблюдения между встречами и подготовка к сессиям.",
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/favicon.svg` },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
