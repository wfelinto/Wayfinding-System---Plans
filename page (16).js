"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f6f4] px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-ink mb-1 text-center">Wayfinding Scoping Tool</h1>
        <p className="text-ink/60 text-sm mb-6 text-center">Sign in to continue</p>
        <form onSubmit={handleSubmit} className="bg-white border border-black/10 rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-black/15 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-black/15 rounded-md px-3 py-2 text-sm"
            />
          </div>
          {error && (
            <p className="text-red-700 bg-red-50 border border-red-200 rounded-md p-3 text-sm">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="text-xs text-ink/40 text-center mt-4">
          Accounts are created by your project admin — there's no self sign-up.
        </p>
      </div>
    </div>
  );
}
