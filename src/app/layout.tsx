import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "3x3 Tournament Manager",
  description: "SaaS platforma za organizaciju i live scoring 3x3 turnira.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sr"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
