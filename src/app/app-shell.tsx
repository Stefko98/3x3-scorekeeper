import Image from "next/image";
import Link from "next/link";
import { LanguageSwitcher } from "./i18n/language-provider";

const modules = [
  "Početna",
  "Turniri",
  "Ekipe",
  "Igrači",
  "Utakmice",
  "Rezultat uživo",
  "Tabele",
  "Statistika",
  "Javni prikaz",
];

const moduleLinks: Record<string, string> = {
  Početna: "/",
  Ekipe: "/teams",
  Igrači: "/players",
  Utakmice: "/matches",
  Turniri: "/tournaments",
  "Rezultat uživo": "/live-score",
  Statistika: "/player-stats",
  Tabele: "/standings",
  "Javni prikaz": "/public-view",
};

type AppShellProps = {
  activeModule: string;
  children: React.ReactNode;
};

export function AppShell({ activeModule, children }: AppShellProps) {
  return (
    <main className="min-h-screen bg-[#0F172A] text-[#F9FAFB]">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="flex flex-col border-b border-white/10 bg-[#111827] px-5 py-4 lg:sticky lg:top-0 lg:h-screen lg:w-52 lg:flex-none lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-4 lg:py-4 2xl:w-64 2xl:px-5 2xl:py-6">
          <Link
            aria-label="Početna strana"
            className="inline-flex select-none items-center rounded-lg outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#F97316]"
            draggable={false}
            href="/"
          >
            <LogoMark />
          </Link>

          <nav className="mt-6 grid grid-cols-2 gap-2 lg:mt-4 lg:grid-cols-1 lg:gap-1.5 2xl:mt-6 2xl:gap-2">
            {modules.map((item) => {
              const href = moduleLinks[item] ?? "#";
              const isActive = item === activeModule;

              return (
                <Link
                  className={`rounded-md border px-3 py-2 text-sm font-semibold transition lg:py-1.5 2xl:py-2 ${
                    isActive
                      ? "border-[#F97316] bg-[#F97316] text-[#111827] shadow-sm"
                      : "border-transparent text-[#CBD5E1] hover:border-white/10 hover:bg-white/5 hover:text-white"
                  }`}
                  href={href}
                  key={item}
                >
                  {item}
                </Link>
              );
            })}
          </nav>

          <LanguageSwitcher />
        </aside>

        <section className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-4 lg:py-4 xl:px-5 2xl:px-8 2xl:py-7">
          {children}
        </section>
      </div>
    </main>
  );
}

function LogoMark() {
  return (
    <div className="flex h-24 w-24 shrink-0 items-center justify-center lg:h-20 lg:w-20 2xl:h-24 2xl:w-24">
      <Image
        alt=""
        className="h-24 w-24 select-none object-contain lg:h-20 lg:w-20 2xl:h-24 2xl:w-24"
        draggable={false}
        height={96}
        priority
        src="/courtflow-logo.png"
        width={96}
      />
    </div>
  );
}
