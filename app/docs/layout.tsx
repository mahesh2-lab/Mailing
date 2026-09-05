import Link from "next/link";
import { DocsSidebar } from "@/components/docs/sidebar";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      {/* Top Navbar for Mobile & Branding */}
      <header className="sticky top-0 z-50 w-full border-b border-zinc-200/80 bg-white/80 backdrop-blur-md">
        <div className="flex h-14 items-center px-4 md:px-8">
          <Link href="/" className="flex items-center gap-2.5 mr-6">
            <div className="h-7 w-7 rounded-lg bg-zinc-950 flex items-center justify-center text-white">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path>
              </svg>
            </div>
            <span className="font-semibold text-sm tracking-tight text-zinc-950">
              Mailing Docs
            </span>
          </Link>
          
          <div className="ml-auto flex items-center space-x-4">
            <Link href="/" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">
              App
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Left Sidebar (Desktop) */}
        <aside className="fixed top-14 z-30 hidden h-[calc(100vh-3.5rem)] w-full shrink-0 overflow-y-auto border-r border-zinc-200/80 bg-zinc-50/50 py-6 pr-4 md:sticky md:block md:w-64 lg:w-72">
          <DocsSidebar />
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
