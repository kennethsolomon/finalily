"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function updateProfile(data: {
  displayName?: string;
  weeklyGoal?: number;
  subjects?: string[];
  preferences?: Record<string, unknown>;
}) {
  const { user } = await getAuthUser();

  const currentPrefs = JSON.parse(user.preferences || "{}") as Record<string, unknown>;

  const ALLOWED_PREF_KEYS = ["theme", "notifications", "studyReminders", "cardFont", "dailyGoal"];
  const safePrefs: Record<string, unknown> = {};
  if (data.preferences) {
    for (const key of Object.keys(data.preferences)) {
      if (ALLOWED_PREF_KEYS.includes(key)) {
        safePrefs[key] = data.preferences[key];
      }
    }
  }

  const mergedPrefs: Record<string, unknown> = {
    ...currentPrefs,
    ...(data.subjects !== undefined && { subjects: data.subjects }),
    ...safePrefs,
  };

  const updateData: Record<string, unknown> = {
    preferences: JSON.stringify(mergedPrefs),
  };
  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.weeklyGoal !== undefined) updateData.weeklyGoal = data.weeklyGoal;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updateData,
  });

  revalidatePath("/settings");
  revalidatePath("/");

  const { aiApiKey: _, ...safeUser } = updated;
  return safeUser;
}

export async function getProfile() {
  const user = await getSessionUser();
  if (!user) return null;

  const { aiApiKey: _, ...safeUser } = user;
  return safeUser;
}

export async function completeOnboarding(data: { subjects: string[]; weeklyGoal?: number }) {
  const { user } = await getAuthUser();

  const currentPrefs = JSON.parse(user.preferences || "{}") as Record<string, unknown>;

  const mergedPrefs: Record<string, unknown> = {
    ...currentPrefs,
    subjects: data.subjects,
    onboardingCompleted: true,
  };

  const updateData: Record<string, unknown> = {
    preferences: JSON.stringify(mergedPrefs),
  };
  if (data.weeklyGoal !== undefined) updateData.weeklyGoal = data.weeklyGoal;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updateData,
  });

  revalidatePath("/");

  const { aiApiKey: _, ...safeUser } = updated;
  return safeUser;
}
