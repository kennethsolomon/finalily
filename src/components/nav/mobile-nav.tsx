"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, PlusCircle, BarChart3, User } from "lucide-react";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/decks", label: "Library", icon: Library },
  { href: "/decks/new", label: "Create", icon: PlusCircle },
  { href: "/analytics", label: "Stats", icon: BarChart3 },
  { href: "/settings", label: "Profile", icon: User },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-3 py-1 text-xs ${
                isActive
                  ? "text-primary font-medium"
                  : "text-muted-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
