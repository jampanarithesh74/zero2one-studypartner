/**
 * ZERO2ONE EVENTS — FEATURE 6A
 * PARTICIPANT FINAL RESULTS & PERSONAL SCORECARD VIEW
 *
 * Rendered inside EventRoom / LiveRoomPanel when the event concludes.
 * Shows personal rank, points breakdown per activity, and the global leaderboard.
 */

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Trophy, 
  Crown, 
  Sparkles, 
  Award, 
  Medal, 
  CheckCircle2, 
  Layers, 
  HelpCircle, 
  Grid, 
  Puzzle, 
  Flame,
  ArrowRight,
  Share2,
  Check
} from "lucide-react";
import { FinalEventResultsSummary, FinalLeaderboardEntry } from "../../types/finalResults";
import { FinalResultsService } from "../../services/finalResultsService";
import { Participant } from "../ParticipantOnboarding";

interface ParticipantFinalResultsViewProps {
  eventId: string;
  eventTitle: string;
  currentParticipant?: Participant | null;
}

export function ParticipantFinalResultsView({
  eventId,
  eventTitle,
  currentParticipant,
}: ParticipantFinalResultsViewProps) {
  const [summary, setSummary] = useState<FinalEventResultsSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedShare, setCopiedShare] = useState<boolean>(false);

  useEffect(() => {
    if (!eventId) return;

    let isMounted = true;
    setLoading(true);

    const unsub = FinalResultsService.subscribeFinalResults(eventId, (data) => {
      if (isMounted) {
        if (data) {
          setSummary(data);
          setLoading(false);
        } else {
          // Calculate on-demand if snapshot not ready
          FinalResultsService.calculateFinalResults(eventId).then((calculated) => {
            if (isMounted) {
              setSummary(calculated);
              setLoading(false);
            }
          });
        }
      }
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, [eventId]);

  const pId = currentParticipant?.id || "";
  const myEntry: FinalLeaderboardEntry | undefined = summary?.leaderboard.find(
    (e) => e.participantId === pId || (currentParticipant?.name && e.name === currentParticipant.name)
  );

  const handleShare = () => {
    if (!myEntry) return;
    const shareText = `🏆 I scored ${myEntry.totalScore} PTS and placed #${myEntry.rank} in ${eventTitle} on ZERO2ONE Events!`;
    navigator.clipboard.writeText(shareText);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  if (loading || !summary) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4 font-sans">
        <div className="w-16 h-16 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center animate-spin">
          <Trophy size={32} />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-black text-white">Compiling Final Standings</h3>
          <p className="text-xs font-mono text-neutral-400">
            Calculating score tallies across all completed activities...
          </p>
        </div>
      </div>
    );
  }

  const isTop3 = myEntry && myEntry.rank <= 3;

  return (
    <div className="h-full flex flex-col bg-[#111114] border border-neutral-800/90 rounded-2xl overflow-hidden shadow-2xl text-left font-sans">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800 bg-neutral-900/90 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Crown size={16} className="text-amber-400" />
          <h2 className="text-xs font-black uppercase tracking-wider text-white">
            Final Results & Standings
          </h2>
        </div>

        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
          EVENT CONCLUDED
        </span>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6">
        {/* Personal Score Banner */}
        {myEntry ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`p-6 rounded-3xl border relative overflow-hidden space-y-4 shadow-xl ${
              isTop3
                ? "bg-gradient-to-br from-amber-500/20 via-neutral-900 to-neutral-950 border-amber-500/50"
                : "bg-neutral-900/80 border-neutral-800"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-orange-400">
                  YOUR PERSONAL SCORECARD
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  {myEntry.name}
                </h3>
                {myEntry.college && (
                  <p className="text-xs text-neutral-400 font-mono">
                    {myEntry.college}
                  </p>
                )}
              </div>

              {/* Rank Badge */}
              <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-neutral-950 border border-neutral-800 shrink-0">
                <span className="text-[9px] font-mono text-neutral-500 uppercase">FINAL RANK</span>
                <span className="text-2xl font-mono font-black text-orange-400">
                  #{myEntry.rank}
                </span>
                <span className="text-[9px] font-mono text-neutral-400">
                  of {summary.totalParticipants}
                </span>
              </div>
            </div>

            {/* Score Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
              <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800">
                <span className="text-[10px] font-mono text-neutral-400 uppercase block">Total Points</span>
                <span className="text-lg font-mono font-black text-white">
                  {myEntry.totalScore.toLocaleString()}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800">
                <span className="text-[10px] font-mono text-neutral-400 uppercase block">Correct / Solved</span>
                <span className="text-lg font-mono font-black text-emerald-400">
                  {myEntry.totalCorrect}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800 col-span-2 sm:col-span-1">
                <span className="text-[10px] font-mono text-neutral-400 uppercase block">Rounds Played</span>
                <span className="text-lg font-mono font-black text-purple-400">
                  {Object.keys(myEntry.activityScores || {}).length} / {summary.totalActivities}
                </span>
              </div>
            </div>

            {/* Share CTA */}
            <div className="pt-2 flex items-center justify-between border-t border-neutral-800/80">
              <span className="text-xs text-neutral-400 font-sans">
                Great job competing in today's live event!
              </span>
              <button
                type="button"
                onClick={handleShare}
                className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {copiedShare ? <Check size={12} className="text-emerald-400" /> : <Share2 size={12} />}
                <span>{copiedShare ? "Copied!" : "Share Score"}</span>
              </button>
            </div>
          </motion.div>
        ) : null}

        {/* Global Leaderboard Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
              <Trophy size={14} className="text-amber-400" />
              <span>Event Leaderboard</span>
            </h4>
            <span className="text-[11px] font-mono text-neutral-500">
              {summary.totalParticipants} Participants
            </span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {summary.leaderboard.slice(0, 15).map((entry) => {
              const isMe = entry.participantId === pId || (currentParticipant?.name && entry.name === currentParticipant.name);
              const isWinner = entry.rank === 1;

              return (
                <div
                  key={entry.participantId}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    isMe
                      ? "bg-orange-500/10 border-orange-500/40 shadow-md"
                      : isWinner
                      ? "bg-amber-500/10 border-amber-500/30"
                      : "bg-neutral-900/60 border-neutral-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-lg font-mono font-black text-xs flex items-center justify-center ${
                        entry.rank === 1
                          ? "bg-amber-500 text-neutral-950"
                          : entry.rank === 2
                          ? "bg-neutral-300 text-neutral-950"
                          : entry.rank === 3
                          ? "bg-amber-700 text-white"
                          : "bg-neutral-800 text-neutral-400"
                      }`}
                    >
                      {entry.rank}
                    </span>

                    <div>
                      <span className="text-xs font-bold text-white block">
                        {entry.name} {isMe && <span className="text-orange-400 font-mono text-[10px] ml-1">(YOU)</span>}
                      </span>
                      {entry.college && (
                        <span className="text-[10px] text-neutral-500 font-mono block">
                          {entry.college}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <span className="text-xs font-black text-orange-400 block">
                      {entry.totalScore.toLocaleString()} PTS
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      {entry.totalCorrect} correct
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
