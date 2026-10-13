import Link from "next/link";
import { FileText } from "lucide-react";
import { SITE_NAME } from "@/app/lib/constants";
import { TOOLS } from "@/app/lib/tools";

export function Navbar() {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <nav
        aria-label="Principal"
        className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-4"
      >
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight"
        >
          <FileText className="size-5 text-primary" aria-hidden />
          {SITE_NAME}
        </Link>

        <ul className="flex min-w-0 items-center gap-4 overflow-x-auto text-sm text-muted-foreground">
          {TOOLS.map(({ title, href }) => (
            <li key={href} className="shrink-0">
              <Link href={href} className="transition-colors hover:text-foreground">
                {title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
