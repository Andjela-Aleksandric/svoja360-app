import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface Viewer {
  userId: string;
  email: string;
  role: "coach" | "client";
  fullName: string | null;
  phone: string | null;
  client: { id: string; full_name: string; status: string; start_date: string; phone_e164: string | null } | null;
}

/** The signed-in user with role and (for clients) their client record. Cached per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("id, role, full_name, email, phone").eq("id", user.id).maybeSingle();
  if (!profile) return null;
  let client: Viewer["client"] = null;
  if (profile.role === "client") {
    const { data } = await supabase.from("clients").select("id, full_name, status, start_date, phone_e164").eq("user_id", user.id).maybeSingle();
    client = data ?? null;
  }
  return {
    userId: user.id,
    email: user.email ?? profile.email ?? "",
    role: profile.role,
    fullName: profile.full_name ?? client?.full_name ?? null,
    phone: profile.phone,
    client,
  };
});

export async function requireCoach(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/prijava");
  if (v.role !== "coach") redirect("/klijent");
  return v;
}

export async function requireClient(): Promise<Viewer & { client: NonNullable<Viewer["client"]> }> {
  const v = await getViewer();
  if (!v) redirect("/prijava");
  if (v.role === "coach") redirect("/trener");
  if (!v.client) redirect("/bez-pristupa");
  return v as Viewer & { client: NonNullable<Viewer["client"]> };
}

/** For server actions: throws instead of redirecting. */
export async function assertCoach(): Promise<Viewer> {
  const v = await getViewer();
  if (!v || v.role !== "coach") throw new Error("forbidden");
  return v;
}

export async function assertClient(): Promise<Viewer & { client: NonNullable<Viewer["client"]> }> {
  const v = await getViewer();
  if (!v || v.role !== "client" || !v.client) throw new Error("forbidden");
  return v as Viewer & { client: NonNullable<Viewer["client"]> };
}
