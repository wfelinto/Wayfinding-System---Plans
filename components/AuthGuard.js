"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [session, setSession] = useState(null);

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

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  // The login page renders its own full-page layout, with no app shell.
  if (pathname === "/login") {
    return children;
  }

  if (!checked || !session) {
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
