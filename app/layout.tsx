import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Рядом — рабочий показ проекта",
  description:
    "Интерактивный показ двух кабинетов, результаты разработки и снимки рабочего стенда с общим API.",
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
