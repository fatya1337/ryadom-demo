import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Рядом — кабинет психотерапевта",
  description: "Кабинет психотерапевта: истории пациентов, наблюдения между сессиями и подготовка к встречам. Демонстрационный прототип.",
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/favicon.svg` },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
