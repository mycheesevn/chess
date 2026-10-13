"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { fetchMyStats, type ChessStats } from "@/lib/supabase/engagement";

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface AuthCtx {
  user: User | null;
  profile: Profile | null;
  chessStats: ChessStats | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  displayName: string;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [chessStats, setChessStats] = useState<ChessStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string) => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .eq("id", uid)
        .single();
      if (data) setProfile(data as Profile);
      setChessStats(await fetchMyStats(uid));
    } catch {
      /* supabase not configured */
    }
  }, []);

  useEffect(() => {
    // Client-side only: never touch Supabase during SSR/prerender.
    let sub: { unsubscribe: () => void } | null = null;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        setUser(data.session?.user ?? null);
        if (data.session?.user) await loadProfile(data.session.user.id);
        const { data: s } = supabase.auth.onAuthStateChange(
          (_e: string, session: Session | null) => {
            setUser(session?.user ?? null);
            if (session?.user) loadProfile(session.user.id);
            else {
              setProfile(null);
              setChessStats(null);
            }
          }
        );
        sub = s.subscription;
      } catch {
        /* supabase not configured — stay signed out */
      } finally {
        setLoading(false);
      }
    })();
    return () => sub?.unsubscribe();
  }, [loadProfile]);

  const signInWithGoogle = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }, []);

  const signInWithFacebook = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: { redirectTo: window.location.origin },
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await createClient().auth.signInWithPassword({
        email,
        password,
      });
      return { error: error ? error.message : null };
    } catch {
      return { error: "Supabase not configured" };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await createClient().auth.signUp({ email, password });
      return { error: error ? error.message : null };
    } catch {
      return { error: "Supabase not configured" };
    }
  }, []);

  // Apply the display name stashed at signup (it takes precedence over the
  // email-prefix default the DB trigger sets). Email confirmation may delay
  // the first session, hence this runs on every login until the stash is gone.
  useEffect(() => {
    if (!user) return;
    let stashed: string | null = null;
    try {
      stashed = localStorage.getItem("chess-username");
      localStorage.removeItem("chess-username");
    } catch {
      /* storage unavailable */
    }
    const name = stashed?.trim().slice(0, 30);
    if (!name) return;
    try {
      createClient().from("profiles").update({ username: name }).eq("id", user.id);
    } catch {
      /* ignore */
    }
  }, [user]);

  const signOut = useCallback(async () => {
    try {
      await createClient().auth.signOut();
    } catch {
      /* ignore */
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  const displayName = useMemo(() => {
    if (profile?.full_name) return profile.full_name;
    if (profile?.username) return profile.username;
    if (user?.email) return user.email.split("@")[0];
    return "Player";
  }, [profile, user]);

  const value = useMemo(
    () => ({
      user,
      profile,
      chessStats,
      loading,
      signInWithGoogle,
      signInWithFacebook,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      displayName,
    }),
    [user, profile, chessStats, loading, signInWithGoogle, signInWithFacebook, signIn, signUp, signOut, refreshProfile, displayName]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
