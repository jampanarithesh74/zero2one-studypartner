import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  onAuthStateChanged,
  signOut,
  User 
} from "firebase/auth";
import { motion } from "motion/react";
import { 
  ArrowLeft, 
  Radio, 
  Lock, 
  Mail, 
  KeyRound, 
  LogIn, 
  AlertCircle, 
  Loader2,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";
import { auth, googleProvider, ALLOWED_ADMIN_EMAILS } from "../../lib/firebase";

export function EventsHostLoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [checkingInitialAuth, setCheckingInitialAuth] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Check if already authenticated with valid organizer credentials
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser: User | null) => {
      if (currentUser) {
        const userEmail = currentUser.email || "";
        const isAdminEmail = ALLOWED_ADMIN_EMAILS.includes(userEmail);
        const isValidDomain = userEmail.endsWith("@anurag.edu.in") || isAdminEmail;

        if (isValidDomain) {
          navigate("/events/host/dashboard", { replace: true });
        }
      }
      setCheckingInitialAuth(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  // Translate Firebase Auth error codes to clean, friendly error messages
  const getFriendlyErrorMessage = (error: any): string => {
    if (!error) return "An unexpected error occurred. Please try again.";
    
    const code = error.code || "";
    const rawMessage = error.message || "";

    switch (code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Invalid email or password. Please verify your credentials and try again.";
      case "auth/invalid-email":
        return "Please enter a valid email address format.";
      case "auth/user-disabled":
        return "This account has been disabled. Please contact the administrator.";
      case "auth/too-many-requests":
        return "Too many unsuccessful attempts. Please wait a few moments before trying again.";
      case "auth/popup-closed-by-user":
        return "Sign-in popup was closed before completing authentication.";
      case "auth/popup-blocked":
        return "Sign-in popup was blocked by your browser. Please allow popups for this site.";
      case "auth/network-request-failed":
        return "Network connection issue. Please check your internet connection.";
      case "auth/operation-not-allowed":
        return "Email/password authentication is not enabled in the Firebase console. Please use Google Sign-In or contact your administrator.";
      default:
        if (rawMessage.includes("Access Denied")) {
          return rawMessage;
        }
        return "Unable to sign in. Please verify your organizer account and try again.";
    }
  };

  // Validate organizer authorization domain
  const validateOrganizerDomain = async (user: User): Promise<boolean> => {
    const userEmail = user.email || "";
    const isAdminEmail = ALLOWED_ADMIN_EMAILS.includes(userEmail);
    const isValidDomain = userEmail.endsWith("@anurag.edu.in") || isAdminEmail;

    if (!isValidDomain) {
      await signOut(auth);
      setErrorMessage("Access Denied: Only verified college accounts (@anurag.edu.in) or authorized administrators are permitted to host events.");
      return false;
    }
    return true;
  };

  // Handle Email + Password Sign In
  const handleEmailPasswordSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("Please enter your organizer email address.");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const isAuthorized = await validateOrganizerDomain(userCredential.user);
      if (isAuthorized) {
        navigate("/events/host/dashboard");
      }
    } catch (error: any) {
      console.warn("Host email sign in error:", error);
      setErrorMessage(getFriendlyErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    setErrorMessage("");
    setIsLoading(true);

    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      const isAuthorized = await validateOrganizerDomain(userCredential.user);
      if (isAuthorized) {
        navigate("/events/host/dashboard");
      }
    } catch (error: any) {
      console.warn("Host Google sign in error:", error);
      if (error?.code !== "auth/popup-closed-by-user") {
        setErrorMessage(getFriendlyErrorMessage(error));
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingInitialAuth) {
    return (
      <div className="min-h-screen bg-[#070709] text-white flex items-center justify-center font-sans">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 size={32} className="text-orange-500 animate-spin" />
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
            Checking Organizer Session...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070709] text-white flex flex-col justify-between selection:bg-orange-500/30 selection:text-orange-200 font-sans">
      {/* Top Navigation Bar */}
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

          <div className="flex items-center gap-2">
            <span className="text-sm font-black tracking-tight text-white uppercase">
              ZERO<span className="text-orange-500">2</span>ONE
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center gap-1">
              <Radio size={10} className="animate-pulse text-orange-500" />
              <span>HOST</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <div className="w-full max-w-md mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6"
          >
            {/* Header / Brand */}
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mx-auto shadow-sm">
                <Lock size={24} />
              </div>

              <div className="space-y-1">
                <div className="text-[10px] font-black text-orange-500 uppercase tracking-widest">
                  ZERO2ONE EVENTS
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
                  HOST AN EVENT
                </h1>
                <p className="text-xs sm:text-sm text-neutral-400 font-normal leading-relaxed max-w-xs mx-auto">
                  Sign in to create and manage your events.
                </p>
              </div>
            </div>

            {/* Error Message Notice */}
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold leading-relaxed flex items-start gap-2.5 shadow-sm"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
                <span className="flex-1">{errorMessage}</span>
              </motion.div>
            )}

            {/* Email / Password Form */}
            <form onSubmit={handleEmailPasswordSignIn} className="space-y-4">
              {/* Email Input */}
              <div className="space-y-1.5 text-left">
                <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail size={13} className="text-orange-500" />
                  <span>Email</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorMessage) setErrorMessage("");
                    }}
                    placeholder="organizer@anurag.edu.in"
                    disabled={isLoading}
                    autoComplete="email"
                    className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-500 text-sm font-medium focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5 text-left">
                <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound size={13} className="text-orange-500" />
                  <span>Password</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMessage) setErrorMessage("");
                    }}
                    placeholder="••••••••"
                    disabled={isLoading}
                    autoComplete="current-password"
                    className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-500 text-sm font-medium focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={15} />
                    <span>Sign In</span>
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative flex items-center justify-center py-0.5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-800" />
              </div>
              <div className="relative px-3 bg-[#0e0e12] text-[10px] font-extrabold text-neutral-500 uppercase tracking-widest">
                OR
              </div>
            </div>

            {/* Google Sign-In Option */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-neutral-850 active:scale-[0.99] border border-neutral-800 hover:border-neutral-700 text-white font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.2c0 2.8.7 5.5 1.9 7.8l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.5C3.7 20.4 7.5 23.5 12 23.5z"
                />
              </svg>
              <span>Sign in with Google</span>
            </button>

            {/* Domain info note */}
            <div className="pt-2 text-center">
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Authorized for faculty, department coordinators, and student organizers (<strong className="text-neutral-400">@anurag.edu.in</strong>).
              </p>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-neutral-900 bg-[#08080a] py-6 text-center text-xs text-neutral-500">
        ZERO2ONE EVENTS &bull; Organizer Authentication
      </footer>
    </div>
  );
}
