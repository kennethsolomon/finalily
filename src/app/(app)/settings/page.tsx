"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { updateProfile } from "@/actions/profile";
import { ThemePicker } from "@/components/theme-picker";
import { requestNotificationPermission, getNotificationPermission } from "@/lib/notifications";
import { Bell } from "lucide-react";
import {
  FlaskConical,
  Atom,
  Zap,
  Calculator,
  BookOpen,
  Languages,
  MonitorDot,
  MoreHorizontal,
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

export default function SettingsPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [weeklyGoal, setWeeklyGoal] = useState(5);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [notificationStatus, setNotificationStatus] = useState<string>("default");
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }
      setAvatarUrl(user.user_metadata?.avatar_url ?? null);
      setNotificationStatus(getNotificationPermission());

      const { getProfile } = await import("@/actions/profile");
      const profile = await getProfile();
      if (profile) {
        setDisplayName((profile as Record<string, unknown>).display_name as string ?? "");
        setWeeklyGoal((profile as Record<string, unknown>).weekly_goal as number ?? 5);
        const prefs = ((profile as Record<string, unknown>).preferences as Record<string, unknown>) ?? {};
        setSelectedSubjects((prefs.subjects as string[]) ?? []);
      }
    }
    load();
  }, [router]);

  function toggleSubject(id: string) {
    setSelectedSubjects((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateProfile({ displayName, weeklyGoal, subjects: selectedSubjects });
      toast.success("Changes saved");
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!newPassword) return;
    setChangingPassword(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    setNewPassword("");
    if (error) {
      toast.error("Failed to update password", { description: error.message });
    } else {
      toast.success("Password updated");
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  const initials = displayName
    ? displayName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <div className="max-w-xl mx-auto space-y-10">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile and study preferences.</p>
      </div>

      {/* Profile */}
      <section className="space-y-4">
        <h2 className="text-base font-medium">Profile</h2>
        <Separator />
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <p className="text-sm text-muted-foreground">Avatar is synced from your login provider.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="display-name">Display name</Label>
          <Input
            id="display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
          />
        </div>
      </section>

      {/* Appearance */}
      <section className="space-y-4">
        <h2 className="text-base font-medium">Appearance</h2>
        <Separator />
        <div>
          <Label className="mb-2 block">Theme</Label>
          <ThemePicker />
        </div>
      </section>

      {/* Notifications */}
      <section className="space-y-4">
        <h2 className="text-base font-medium">Notifications</h2>
        <Separator />
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Bell className="size-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Study reminders</p>
              <p className="text-xs text-muted-foreground">
                {notificationStatus === "granted"
                  ? "Notifications are enabled"
                  : notificationStatus === "denied"
                    ? "Notifications are blocked in your browser"
                    : notificationStatus === "unsupported"
                      ? "Your browser does not support notifications"
                      : "Get reminded to keep your streak alive"}
              </p>
            </div>
          </div>
          {notificationStatus !== "granted" && notificationStatus !== "unsupported" && (
            <button
              onClick={async () => {
                const granted = await requestNotificationPermission();
                setNotificationStatus(granted ? "granted" : "denied");
              }}
              disabled={notificationStatus === "denied"}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Enable
            </button>
          )}
          {notificationStatus === "granted" && (
            <span className="text-xs text-green-600 font-medium">Active</span>
          )}
        </div>
      </section>

      {/* Study */}
      <section className="space-y-4">
        <h2 className="text-base font-medium">Study preferences</h2>
        <Separator />
        <div className="space-y-1.5">
          <Label htmlFor="weekly-goal">Weekly study goal (sessions)</Label>
          <Input
            id="weekly-goal"
            type="number"
            min={1}
            max={14}
            value={weeklyGoal}
            onChange={(e) => setWeeklyGoal(Number(e.target.value))}
            className="w-24"
          />
        </div>
        <div>
          <Label className="mb-2 block">Subjects</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SUBJECTS.map(({ id, label, icon: Icon }) => {
              const selected = selectedSubjects.includes(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleSubject(id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors",
                    selected
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(buttonVariants({ variant: "default" }), "h-9 px-5")}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {/* Account */}
      <section className="space-y-4">
        <h2 className="text-base font-medium">Account</h2>
        <Separator />

        <div className="space-y-2">
          <Label htmlFor="new-password">Change password</Label>
          <div className="flex gap-2">
            <Input
              id="new-password"
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="max-w-xs"
            />
            <button
              onClick={handleChangePassword}
              disabled={changingPassword || !newPassword}
              className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
            >
              {changingPassword ? "Updating…" : "Update"}
            </button>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className={cn(buttonVariants({ variant: "destructive" }), "h-9")}
        >
          Sign out
        </button>
      </section>
    </div>
  );
}
