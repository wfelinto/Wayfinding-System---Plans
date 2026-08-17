"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { canAccessUsers, canAccessWayfinding, canAccessFaSignage } from "@/lib/permissions";

export default function AuthGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileChecked, setProfileChecked] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setChecked(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!checked) return;
    if (!session && pathname !== "/login") {
      router.replace("/login");
    } else if (session && pathname === "/login") {
      router.replace("/");
    }
  }, [checked, session, pathname, router]);

  // Ensures every signed-in user has a profiles row (role + FA Signage
  // approval), auto-bootstrapping the very first user as owner. This is
  // awaited (not fire-and-forget) so the resulting role is known before
  // any area-access check runs below — avoids a race where a brand-new
  // user's role isn't loaded yet when the redirect check fires.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setProfileChecked(false);
    fetch("/api/admin/ensure-profile", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        setProfile(json.profile || null);
        setProfileChecked(true);
      })
      .catch(() => {
        if (cancelled) return;
        setProfileChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Area-based access control: redirect away from a section the
  // signed-in user's role doesn't permit.
  useEffect(() => {
    if (!profileChecked || pathname === "/login") return;
    const role = profile?.role;

    if (pathname.startsWith("/users") && !canAccessUsers(role)) {
      router.replace("/");
      return;
    }
    if (pathname.startsWith("/fa-projects") && !canAccessFaSignage(role)) {
      router.replace("/");
      return;
    }
    const isWayfindingRoute =
      pathname.startsWith("/projects") || pathname.startsWith("/editor") || pathname.startsWith("/schedule");
    if (isWayfindingRoute && !canAccessWayfinding(role)) {
      router.replace("/");
    }
  }, [profileChecked, profile, pathname, router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  // The login page renders its own full-page layout, with no app shell.
  if (pathname === "/login") {
    return children;
  }

  if (!checked || !session || !profileChecked) {
    return <div className="min-h-screen flex items-center justify-center text-ink/50">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-black/10 bg-white">
        <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="font-semibold text-lg tracking-tight text-ink">
            Wayfinding Scoping Tool
          </a>
          <nav className="flex items-center gap-6 text-sm text-ink/70">
            <a href="/" className="hover:text-ink">Projects</a>
            {canAccessUsers(profile?.role) && (
              <a href="/users" className="hover:text-ink">Users</a>
            )}
            <span className="text-ink/30">|</span>
            <span className="text-ink/50 hidden sm:inline">{session.user.email}</span>
            <button onClick={handleLogout} className="hover:text-ink">
              Log out
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-[1800px] w-full mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
