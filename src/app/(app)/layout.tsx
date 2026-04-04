import { Sidebar } from "@/components/nav/sidebar";
import { MobileNav } from "@/components/nav/mobile-nav";
import { ThemeProvider } from "@/lib/theme-context";
import { createClient } from "@/lib/supabase/server";
import { type ThemeId, DEFAULT_THEME } from "@/lib/themes";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let initialTheme: ThemeId = DEFAULT_THEME;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("preferences")
      .eq("id", user.id)
      .single();
    const prefs = (profile?.preferences as Record<string, unknown>) ?? {};
    if (prefs.theme && typeof prefs.theme === "string") {
      initialTheme = prefs.theme as ThemeId;
    }
  }

  return (
    <ThemeProvider initialTheme={initialTheme}>
      <div className="min-h-screen">
        <Sidebar />
        <main className="md:pl-64 pb-16 md:pb-0">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
        <MobileNav />
      </div>
    </ThemeProvider>
  );
}
