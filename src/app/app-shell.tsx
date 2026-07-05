import Link from "next/link";
import { modules } from "./dashboard-data";

const moduleLinks: Record<string, string> = {
  Dashboard: "/",
  "Live Score": "/live-score",
};

type AppShellProps = {
  activeModule: string;
  children: React.ReactNode;
};

export function AppShell({ activeModule, children }: AppShellProps) {
  return (
    <main className="min-h-screen bg-[#0F172A] text-[#F9FAFB]">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="border-b border-white/10 bg-[#111827] px-5 py-4 lg:w-72 lg:border-b-0 lg:border-r lg:px-6 lg:py-7">
          <div className="flex items-center justify-between gap-4 lg:block">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FACC15]">
                SaaS platforma
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-normal">
                3x3 Tournament Manager
              </h1>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#F97316]/50 bg-[#F97316]/15 text-lg font-black text-[#FACC15]">
              3x3
            </div>
          </div>

          <nav className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-1">
            {modules.map((item) => {
              const href = moduleLinks[item] ?? "#";
              const isActive = item === activeModule;

              return (
                <Link
                  className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-[#F97316] text-[#111827]"
                      : "text-[#CBD5E1] hover:bg-white/5 hover:text-white"
                  }`}
                  href={href}
                  key={item}
                >
                  {item}
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          {children}
        </section>
      </div>
    </main>
  );
}
