"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeOnboarding } from "@/actions/profile";
import {
  FlaskConical,
  Atom,
  Zap,
  Calculator,
  BookOpen,
  Languages,
  MonitorDot,
  MoreHorizontal,
  CheckCircle2,
} from "lucide-react";

const SUBJECTS = [
  { id: "Biology", label: "Biology", icon: FlaskConical },
  { id: "Chemistry", label: "Chemistry", icon: Atom },
  { id: "Physics", label: "Physics", icon: Zap },
  { id: "Math", label: "Math", icon: Calculator },
  { id: "History", label: "History", icon: BookOpen },
  { id: "Language", label: "Language", icon: Languages },
  { id: "Computer Science", label: "Computer Science", icon: MonitorDot },
  { id: "Other", label: "Other", icon: MoreHorizontal },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [customSubject, setCustomSubject] = useState("");
  const [weeklyGoal, setWeeklyGoal] = useState(5);
  const [loading, setLoading] = useState(false);

  function toggleSubject(id: string) {
    setSelectedSubjects((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function handleComplete() {
    setLoading(true);
    const subjects = selectedSubjects.map((s) =>
      s === "Other" && customSubject.trim() ? customSubject.trim() : s
    );
    try {
      await completeOnboarding({ subjects, weeklyGoal });
      router.push("/decks/new");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-10">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                n === step ? "bg-primary" : n < step ? "bg-primary/40" : "bg-muted"
              )}
            />
          ))}
        </div>

        {step === 1 && (
          <div>
            <h1 className="text-2xl font-semibold text-center mb-1">
              What are you studying?
            </h1>
            <p className="text-sm text-muted-foreground text-center mb-8">
              Select all that apply — you can change this later.
            </p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
              {SUBJECTS.map(({ id, label, icon: Icon }) => {
                const selected = selectedSubjects.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => toggleSubject(id)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors",
                      selected
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="size-5" />
                    {label}
                  </button>
                );
              })}
            </div>

            {selectedSubjects.includes("Other") && (
              <div className="mb-6">
                <Label htmlFor="custom-subject" className="mb-1.5 block">
                  What are you studying?
                </Label>
                <Input
                  id="custom-subject"
                  placeholder="e.g. Economics, Art History…"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                />
              </div>
            )}

            <button
              disabled={selectedSubjects.length === 0}
              onClick={() => setStep(2)}
              className={cn(
                buttonVariants({ variant: "default" }),
                "w-full h-10"
              )}
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-2xl font-semibold text-center mb-1">
              Set your weekly study goal
            </h1>
            <p className="text-sm text-muted-foreground text-center mb-8">
              How many sessions do you want to complete each week?
            </p>

            <div className="flex flex-col items-center gap-6 mb-10">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setWeeklyGoal((g) => Math.max(1, g - 1))}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "size-10 text-lg"
                  )}
                >
                  −
                </button>
                <span className="text-4xl font-bold tabular-nums w-16 text-center">
                  {weeklyGoal}
                </span>
                <button
                  onClick={() => setWeeklyGoal((g) => Math.min(14, g + 1))}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "size-10 text-lg"
                  )}
                >
                  +
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                {weeklyGoal === 1 ? "1 session per week" : `${weeklyGoal} sessions per week`}
              </p>
              <input
                type="range"
                min={1}
                max={14}
                value={weeklyGoal}
                onChange={(e) => setWeeklyGoal(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className={cn(buttonVariants({ variant: "outline" }), "flex-1 h-10")}
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className={cn(buttonVariants({ variant: "default" }), "flex-1 h-10")}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center">
            <CheckCircle2 className="size-16 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-semibold mb-1">Ready to go!</h1>
            <p className="text-sm text-muted-foreground mb-8">
              Here&apos;s a quick summary of your setup.
            </p>

            <div className="rounded-xl border bg-muted/30 p-5 text-left mb-8 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subjects</span>
                <span className="font-medium">
                  {selectedSubjects
                    .map((s) =>
                      s === "Other" && customSubject.trim() ? customSubject.trim() : s
                    )
                    .join(", ") || "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Weekly goal</span>
                <span className="font-medium">{weeklyGoal} sessions</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className={cn(buttonVariants({ variant: "outline" }), "flex-1 h-10")}
              >
                Back
              </button>
              <button
                onClick={handleComplete}
                disabled={loading}
                className={cn(buttonVariants({ variant: "default" }), "flex-1 h-10")}
              >
                {loading ? "Setting up…" : "Create your first deck"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
