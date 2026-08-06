import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { HelpCircle, X, Send, AlertCircle, Sparkles } from "lucide-react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";

interface AskQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  currentUserEmail?: string | null;
  existingQuestion?: string;
}

export function AskQuestionModal({
  isOpen,
  onClose,
  eventId,
  currentUserEmail,
  existingQuestion = "",
}: AskQuestionModalProps) {
  const [questionText, setQuestionText] = useState<string>(existingQuestion);
  const [publishing, setPublishing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  if (!isOpen) return null;

  const trimmed = questionText.trim();
  const isValid = trimmed.length > 0 && trimmed.length <= 300;

  const handlePublish = async () => {
    if (!isValid || publishing) return;

    try {
      setPublishing(true);
      setErrorMsg("");

      const newQuestionId = `q_${Date.now()}`;
      const activeQRef = doc(db, "events", eventId, "liveRoom", "activeQuestion");

      await setDoc(activeQRef, {
        question: trimmed,
        createdAt: serverTimestamp(),
        createdBy: currentUserEmail || "Admin",
        isActive: true,
        questionId: newQuestionId,
      });

      setQuestionText("");
      onClose();
    } catch (err: any) {
      console.error("Error publishing question:", err);
      setErrorMsg(err.message || "Failed to publish question. Please try again.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-lg bg-[#121212] border border-neutral-800 rounded-3xl p-6 shadow-2xl overflow-hidden text-left font-sans"
        >
          {/* Subtle Accent Light */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 blur-3xl rounded-full pointer-events-none" />

          {/* Modal Header */}
          <div className="flex items-center justify-between pb-4 border-b border-neutral-800/80">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-orange-500/15 text-orange-400 border border-orange-500/30">
                <HelpCircle size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-white tracking-tight">
                  Ask a Question
                </h3>
                <p className="text-[11px] text-neutral-400 font-medium">
                  Publish a real-time question to all event participants
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={publishing}
              className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>

          {/* Error Alert if any */}
          {errorMsg && (
            <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Question Input Form */}
          <div className="mt-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-extrabold uppercase tracking-wider text-neutral-300">
                  Question Text
                </label>
                <span
                  className={`text-[11px] font-mono font-bold ${
                    questionText.length > 300
                      ? "text-red-400 font-extrabold"
                      : "text-neutral-500"
                  }`}
                >
                  {questionText.length}/300
                </span>
              </div>

              <textarea
                rows={4}
                value={questionText}
                onChange={(e) => {
                  setQuestionText(e.target.value);
                  if (errorMsg) setErrorMsg("");
                }}
                maxLength={300}
                placeholder="Type your question here (e.g. What is your biggest challenge in founding a startup?)..."
                className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-2xl text-xs text-white placeholder:text-neutral-600 outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/40 transition-all resize-none leading-relaxed font-medium"
              />
            </div>

            <div className="p-3 rounded-2xl bg-neutral-900/80 border border-neutral-800/80 flex items-center gap-2.5 text-[11px] text-neutral-400">
              <Sparkles size={14} className="text-orange-400 shrink-0" />
              <span>
                Publishing this replaces any current question and enables response submission for all live participants instantly.
              </span>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-neutral-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={publishing}
              className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-extrabold transition-all border border-neutral-800 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handlePublish}
              disabled={!isValid || publishing}
              className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black transition-all cursor-pointer shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
            >
              {publishing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <Send size={13} />
                  <span>Publish</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
