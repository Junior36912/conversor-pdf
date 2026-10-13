"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { TOOL_GROUPS } from "@/app/lib/tools";
import { cn } from "@/app/lib/utils";

/** Menu "Ferramentas": fecha ao navegar, com Esc ou ao clicar fora. */
export function NavMenu() {
  const pathname = usePathname();
  // Guardamos em qual rota o menu foi aberto; mudar de rota o fecha sem precisar de effect.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpenAt(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenAt(null);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="tools-menu"
        onClick={() => setOpenAt(open ? null : pathname)}
        className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Ferramentas
        <ChevronDown
          className={cn("size-4 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <div
          id="tools-menu"
          className="absolute top-full left-0 z-20 mt-2 max-h-[calc(100vh-5rem)] w-[min(92vw,56rem)] overflow-y-auto rounded-xl border bg-popover p-4 shadow-lg"
        >
          <div className="grid gap-6 sm:grid-cols-3">
            {TOOL_GROUPS.map((group) => (
              <div key={group.id}>
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {group.title}
                </p>
                <ul className="space-y-0.5">
                  {group.tools.map(({ title, href, icon: Icon }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <Icon className="size-4 text-primary" aria-hidden />
                        {title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
