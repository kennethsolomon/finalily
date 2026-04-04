"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Mascot } from "@/components/mascot";
import { Home, Library, PlusCircle, User, Flame, BarChart3 } from "lucide-react";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/decks", label: "Library", icon: Library },
  { href: "/decks/new", label: "Create Deck", icon: PlusCircle },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: User },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-background">
      <div className="flex items-center gap-3 px-6 py-5 border-b">
        <Image src="/logo.png" alt="FinaLily" width={36} height={36} className="rounded-lg" />
        <div>
          <h1 className="text-lg font-bold">Finalily</h1>
          <p className="text-xs text-muted-foreground">A study app that actually makes sense.</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-6 py-4 border-t">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mascot expression="winking" size={28} className="shrink-0" />
          <Flame className="h-4 w-4 text-orange-500" />
          <span>Study streak</span>
        </div>
      </div>
    </aside>
  );
}
