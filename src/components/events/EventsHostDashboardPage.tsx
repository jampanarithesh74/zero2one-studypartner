import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { motion } from "motion/react";
import { 
  ArrowLeft, 
  Radio, 
  LogOut, 
  ShieldCheck, 
  User as UserIcon, 
  Mail, 
  Sparkles,
  Loader2,
  Calendar,
  Layers,
  ArrowRight
} from "lucide-react";
import { auth, ALLOWED_ADMIN_EMAILS } from "../../lib/firebase";

export function EventsHostDashboardPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (!user) {
        // Not authenticated: redirect to Host Login
        navigate("/events/host", { replace: true });
        return;
      }

      const email = user.email || "";
      const isAdminEmail = ALLOWED_ADMIN_EMAILS.includes(email);
      const isValidDomain = email.endsWith("@anurag.edu.in") || isAdminEmail;

      if (!isValidDomain) {
        // Unauthorized domain: sign out and redirect
        signOut(auth).then(() => {
          navigate("/events/host", { replace: true });
        });
        return;
      }

      setCurrentUser(user);
      setIsLoadingAuth(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut(auth);
      navigate("/events/host", { replace: true });
    } catch (err) {
      console.warn("Sign out error:", err);
      navigate("/events/host", { replace: true });
    } finally {
      setIsSigningOut(false);
    }
  };

  if (isLoadingAuth || !currentUser) {
    return (
      <div className="min-h-screen bg-[#070709] text-white flex items-center justify-center font-sans">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 size={32} className="text-orange-500 animate-spin" />
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
            Verifying Organizer Session...
          </p>
        </div>
      </div>
    );
  }

  const displayName = currentUser.displayName || currentUser.email?.split("@")[0] || "Organizer";
  const userEmail = currentUser.email || "No email";
  const isSuperAdmin = ALLOWED_ADMIN_EMAILS.includes(userEmail);

  return (
    <div className="min-h-screen bg-[#070709] text-white flex flex-col justify-between selection:bg-orange-500/30 selection:text-orange-200 font-sans">
      {/* Top Bar */}
      <header className="w-full border-b border-neutral-900 bg-[#09090c]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/events")}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-semibold transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            aria-label="Back to Events"
          >
            <ArrowLeft size={14} />
            <span>Back to Events</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-tight text-white uppercase">
                ZERO<span className="text-orange-500">2</span>ONE
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center gap-1">
                <Radio size={10} className="animate-pulse text-orange-500" />
                <span>HOST</span>
              </span>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 text-neutral-400 border border-neutral-800 text-xs font-semibold transition-all cursor-pointer"
              title="Sign Out"
            >
              {isSigningOut ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <LogOut size={13} />
              )}
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="w-full max-w-2xl mx-auto space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8"
          >
            {/* Title & Status Badge */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <ShieldCheck size={14} />
                <span>Authenticated Organizer Session</span>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] font-black text-orange-500 uppercase tracking-widest">
                  ZERO2ONE EVENTS
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
                  HOST DASHBOARD
                </h1>
                <p className="text-sm sm:text-base text-neutral-300 font-medium">
                  Welcome, <span className="text-orange-400 font-bold">{displayName}</span>
                </p>
              </div>
            </div>

            {/* Organizer Status Card */}
            <div className="p-5 rounded-2xl bg-[#14141a] border border-neutral-800 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
                  <UserIcon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white uppercase tracking-tight flex items-center gap-2">
                    <span>{displayName}</span>
                    {isSuperAdmin && (
                      <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 text-[9px] font-extrabold uppercase">
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-400 truncate flex items-center gap-1.5 mt-0.5">
                    <Mail size={12} className="shrink-0 text-neutral-500" />
                    <span>{userEmail}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400">
                <span>Access Status:</span>
                <span className="font-semibold text-emerald-400">You are signed in as an organizer.</span>
              </div>
            </div>

            {/* Next Steps / Scope Info */}
            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 text-center space-y-1.5">
              <p className="text-xs text-neutral-400 leading-relaxed">
                Host authentication is active. Event creation, live dashboard controls, and real-time activities will be connected in upcoming features.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate("/events")}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Return to Events Hub</span>
              </button>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/30 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isSigningOut ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Signing Out...</span>
                  </>
                ) : (
                  <>
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-neutral-900 bg-[#08080a] py-6 text-center text-xs text-neutral-500">
        ZERO2ONE EVENTS // Organizer Portal
      </footer>
    </div>
  );
}
