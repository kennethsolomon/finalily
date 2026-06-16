import { getSessionUser } from "@/lib/session";

export async function getAuthUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return { user };
}
