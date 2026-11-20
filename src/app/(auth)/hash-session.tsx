"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Invitation and password links sent from the Supabase dashboard land on the Site URL with
 * the session in the URL fragment (#access_token=...&type=invite). The app redirects that
 * visit to the sign-in page and the fragment comes along. Here we pick it up, start the
 * session and send the person on to choose a password.
 */
export function HashSessionHandler() {
  useEffect(() => {
    if (window.location.pathname.startsWith("/nova-lozinka")) return; // handled on that page
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get("error_code") || hash.get("error")) {
      window.location.replace("/prijava?greska=link");
      return;
    }
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    if (!access_token || !refresh_token) return;
    const type = hash.get("type");
    history.replaceState(null, "", window.location.pathname + window.location.search);
    createClient().auth.setSession({ access_token, refresh_token }).then((res: { error: unknown }) => {
      if (res.error) { window.location.replace("/prijava?greska=link"); return; }
      window.location.replace(type === "invite" || type === "recovery" || type === "signup" ? "/nova-lozinka" : "/");
    });
  }, []);
  return null;
}
