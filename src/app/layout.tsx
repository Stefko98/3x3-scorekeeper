import type { Metadata } from "next";
import { SharedStoreBootstrap } from "./shared-store-bootstrap";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "3x3 Organizator",
  description: "Organizatorska aplikacija za vođenje 3x3 turnira.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sr"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <SharedStoreBootstrap />
        {children}
      </body>
    </html>
  );
}
