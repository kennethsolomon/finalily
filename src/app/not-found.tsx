import Link from "next/link";
import Image from "next/image";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <Image src="/logo.png" alt="FinaLily" width={80} height={80} className="rounded-xl" />
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="text-lg text-muted-foreground">
          This page doesn&apos;t exist. Lil&apos; Bit couldn&apos;t find it either.
        </p>
      </div>
      <Link href="/" className={cn(buttonVariants(), "gap-2")}>
        <Home className="h-4 w-4" />
        Back to Dashboard
      </Link>
    </div>
  );
}
