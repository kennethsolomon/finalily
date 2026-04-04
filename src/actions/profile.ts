"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) throw new Error("User not found");

  return dbUser;
}

export async function updateProfile(data: {
  displayName?: string;
  weeklyGoal?: number;
  subjects?: string[];
  preferences?: Record<string, unknown>;
}) {
  const user = await getAuthUser();

  const currentPrefs = (user.preferences as Record<string, unknown>) ?? {};

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(data.displayName !== undefined && { displayName: data.displayName }),
      ...(data.weeklyGoal !== undefined && { weeklyGoal: data.weeklyGoal }),
      preferences: {
        ...currentPrefs,
        ...(data.subjects !== undefined && { subjects: data.subjects }),
        ...(data.preferences !== undefined ? data.preferences : {}),
      },
    },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return updated;
}

export async function getProfile() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  return prisma.user.findUnique({ where: { id: user.id } });
}

export async function completeOnboarding(data: { subjects: string[]; weeklyGoal?: number }) {
  const user = await getAuthUser();

  const currentPrefs = (user.preferences as Record<string, unknown>) ?? {};

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(data.weeklyGoal !== undefined && { weeklyGoal: data.weeklyGoal }),
      preferences: {
        ...currentPrefs,
        subjects: data.subjects,
        onboardingCompleted: true,
      },
    },
  });

  revalidatePath("/dashboard");
  return updated;
}
