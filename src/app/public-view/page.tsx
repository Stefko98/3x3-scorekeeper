import type { Metadata } from "next";
import { AppShell } from "../app-shell";
import { PublicViewClient } from "./public-view-client";

export const metadata: Metadata = {
  title: "Javni prikaz | 3x3 Organizator",
  description: "Prikaz rezultata za 3x3 turnir bez unosa podataka.",
};

export default function PublicViewPage() {
  return (
    <AppShell activeModule="Javni prikaz">
      <PublicViewClient />
    </AppShell>
  );
}
