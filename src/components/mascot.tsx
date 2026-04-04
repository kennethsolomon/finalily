"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

export type MascotExpression =
  | "happy"
  | "winking"
  | "surprised"
  | "sad"
  | "smug"
  | "sleeping";

const ALT_TEXT: Record<MascotExpression, string> = {
  happy: "Lil' Bit smiling happily",
  winking: "Lil' Bit giving a playful wink",
  surprised: "Lil' Bit looking surprised",
  sad: "Lil' Bit looking a bit down",
  smug: "Lil' Bit with a confident smile",
  sleeping: "Lil' Bit snoozing peacefully",
};

interface MascotProps {
  expression?: MascotExpression;
  size?: number;
  className?: string;
  animate?: boolean;
}

export function Mascot({
  expression = "happy",
  size = 80,
  className,
  animate = true,
}: MascotProps) {
  return (
    <div
      className={cn(
        "relative inline-block overflow-hidden rounded-2xl bg-white/80 shadow-sm",
        animate && "motion-safe:animate-mascot-idle",
        className
      )}
    >
      <Image
        src={`/mascot/${expression}.png`}
        alt={ALT_TEXT[expression]}
        width={size}
        height={size}
        className="object-contain"
        priority={size >= 80}
      />
    </div>
  );
}
