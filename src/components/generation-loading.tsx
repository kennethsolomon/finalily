"use client";

import { useState, useEffect } from "react";
import { Mascot, type MascotExpression } from "@/components/mascot";

const EXPRESSIONS: MascotExpression[] = [
  "happy",
  "winking",
  "smug",
  "surprised",
  "happy",
];

const MESSAGES = [
  "Cooking up your cards...",
  "Almost there...",
  "Lil' Bit is thinking hard...",
  "Making them extra good...",
  "Just a few more seconds...",
];

interface GenerationLoadingProps {
  message?: string;
}

export function GenerationLoading({ message }: GenerationLoadingProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % EXPRESSIONS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 py-12">
      <div className="motion-safe:animate-mascot-thinking motion-safe:animate-mascot-pulse-glow rounded-2xl">
        <Mascot
          expression={EXPRESSIONS[index]}
          size={120}
          animate={false}
        />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">
          {message ?? MESSAGES[index]}
        </p>
        <div className="flex items-center justify-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
