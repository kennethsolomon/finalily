"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";

export async function updateProfile(data: {
  displayName?: string;
  weeklyGoal?: number;
  subjects?: string[];
  preferences?: Record<string, unknown>;
}) {
  const { supabase, user } = await getAuthUser();

  const currentPrefs = (user.preferences as Record<string, unknown>) ?? {};

  const ALLOWED_PREF_KEYS = ["theme", "notifications", "studyReminders", "cardFont", "dailyGoal"];
  const safePrefs: Record<string, unknown> = {};
  if (data.preferences) {
    for (const key of Object.keys(data.preferences)) {
      if (ALLOWED_PREF_KEYS.includes(key)) {
        safePrefs[key] = data.preferences[key];
      }
    }
  }

  const updatePayload: Record<string, unknown> = {
    preferences: {
      ...currentPrefs,
      ...(data.subjects !== undefined && { subjects: data.subjects }),
      ...safePrefs,
    },
  };
  if (data.displayName !== undefined) updatePayload.display_name = data.displayName;
  if (data.weeklyGoal !== undefined) updatePayload.weekly_goal = data.weeklyGoal;

  const { data: updated, error } = await supabase
    .from("users")
    .update(updatePayload)
    .eq("id", user.id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/settings");
  revalidatePath("/");
  return updated;
}

export async function getProfile() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return data ?? null;
}

export async function completeOnboarding(data: { subjects: string[]; weeklyGoal?: number }) {
  const { supabase, user } = await getAuthUser();

  const currentPrefs = (user.preferences as Record<string, unknown>) ?? {};

  const updatePayload: Record<string, unknown> = {
    preferences: {
      ...currentPrefs,
      subjects: data.subjects,
      onboardingCompleted: true,
    },
  };
  if (data.weeklyGoal !== undefined) updatePayload.weekly_goal = data.weeklyGoal;

  const { data: updated, error } = await supabase
    .from("users")
    .update(updatePayload)
    .eq("id", user.id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/");
  return updated;
}
