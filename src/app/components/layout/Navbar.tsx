import Link from "next/link";
import { FileText } from "lucide-react";
import { NavMenu } from "@/app/components/layout/NavMenu";
import { SITE_NAME } from "@/app/lib/constants";

export function Navbar() {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <nav
        aria-label="Principal"
        className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4"
      >
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight"
        >
          <FileText className="size-5 text-primary" aria-hidden />
          {SITE_NAME}
        </Link>

        <NavMenu />
      </nav>
    </header>
  );
}
