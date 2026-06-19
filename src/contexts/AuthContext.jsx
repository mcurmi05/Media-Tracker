import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../services/supabase-client.js";
/* eslint-disable react-refresh/only-export-components */


const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Pull the live user from the auth server and update state if it differs
    // from the cached session — corrects stale profile metadata (display name
    // / avatar changed on another device) without waiting for a token refresh.
    const syncServerUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) setUser(data.user);
    };

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session) syncServerUser();
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // A device left logged in caches its session; re-check the server user
    // whenever the tab/app returns to the foreground so profile changes made
    // elsewhere show up promptly.
    const onVisible = () => {
      if (document.visibilityState === "visible") syncServerUser();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Fetch the live user from the auth server (not the cached session), so a
  // confirmed email change is reflected even though the local JWT still holds
  // the old address until its next refresh.
  const refreshUser = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser();
    if (!error) setUser(data.user);
    return data?.user ?? null;
  }, []);

  const value = {
    session,
    user,
    loading,
    signOut,
    refreshUser,
    isAuthenticated: !!session
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};