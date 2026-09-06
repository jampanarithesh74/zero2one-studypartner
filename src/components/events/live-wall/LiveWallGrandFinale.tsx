/**
 * ZERO2ONE EVENTS — FEATURE 6A
 * LIVE WALL: GRAND FINALE & FINAL RESULTS PODIUM COMPONENT
 *
 * Full-screen projector presentation for the completed live event.
 * Features a grand 3-tier winner podium, complete event leaderboard table,
 * cross-activity score breakdowns, and event statistics summary.
 */

import { useState } from "react";
import { motion } from "motion/react";
import { 
  Trophy, 
  Crown, 
  Sparkles, 
  Award, 
  Medal, 
  Flame, 
  Users, 
  Layers, 
  CheckCircle2, 
  Download, 
  Copy, 
  Check, 
  BarChart3,
  ExternalLink
} from "lucide-react";
import { FinalEventResultsSummary, FinalLeaderboardEntry } from "../../../types/finalResults";
import { FinalResultsService } from "../../../services/finalResultsService";

interface LiveWallGrandFinaleProps {
  summary: FinalEventResultsSummary | null;
  eventTitle: string;
  isHost?: boolean;
}

export function LiveWallGrandFinale({
  summary,
  eventTitle,
  isHost = false,
}: LiveWallGrandFinaleProps) {
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  if (!summary) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 max-w-2xl mx-auto text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center shadow-2xl animate-spin">
          <Trophy size={40} />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-white">Aggregating Final Results</h2>
          <p className="text-sm font-mono text-neutral-400">
            Calculating aggregate scores across all event activities...
          </p>
        </div>
      </div>
    );
  }

  const { podium, leaderboard, totalParticipants, totalActivities, totalSubmissionsCount, highestScore, averageScore } = summary;
  const first = podium.first;
  const second = podium.second;
  const third = podium.third;

  const handleCopyResults = () => {
    try {
      const text = FinalResultsService.generateResultsCSV(summary);
      navigator.clipboard.writeText(text);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {
      console.warn("Clipboard copy failed:", e);
    }
  };

  const handleExportCSV = () => {
    FinalResultsService.downloadCSV(summary);
  };

  return (
    <div className="w-full h-full flex flex-col justify-between p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-purple-500/15 border border-amber-500/30 rounded-3xl p-6 backdrop-blur-md shadow-2xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono font-black uppercase tracking-widest flex items-center gap-1.5">
              <Crown size={14} className="text-amber-400" />
              EVENT CONCLUDED
            </span>
            <span className="text-xs font-mono text-neutral-400">
              Official Final Results
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
            {eventTitle || summary.eventTitle}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400">
            Congratulations to all participants! Here is the final leaderboard standings across all {totalActivities} rounds.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleCopyResults}
            className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-mono text-neutral-300 flex items-center gap-2 transition-all cursor-pointer shadow-md"
            title="Copy CSV to clipboard"
          >
            {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copiedLink ? "Copied CSV" : "Copy Results"}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 3-Tier Podium Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 items-end pt-4 pb-2">
        {/* 2nd Place (Silver) */}
        {second ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center p-6 rounded-3xl bg-neutral-900/80 border border-neutral-700/80 backdrop-blur-md text-center space-y-3 relative shadow-xl order-2 md:order-1"
          >
            <div className="w-14 h-14 rounded-2xl bg-neutral-300 text-neutral-950 flex items-center justify-center font-mono font-black text-xl shadow-lg border-2 border-white/40">
              <Medal size={28} />
            </div>

            <span className="px-3 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300 text-[10px] font-mono font-bold uppercase tracking-wider">
              2ND PLACE • SILVER
            </span>

            <div>
              <h3 className="text-lg font-black text-white tracking-tight">{second.name}</h3>
              {second.college && (
                <span className="text-xs text-neutral-400 font-mono block truncate max-w-[200px] mx-auto">
                  {second.college}
                </span>
              )}
            </div>

            <div className="px-4 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-base font-mono font-black text-neutral-200">
              {second.totalScore.toLocaleString()} PTS
            </div>

            <div className="text-[11px] font-mono text-neutral-400">
              {second.totalCorrect} correct answers/words
            </div>
          </motion.div>
        ) : (
          <div className="hidden md:block order-2 md:order-1" />
        )}

        {/* 1st Place (Gold Champion) */}
        {first ? (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center p-8 rounded-3xl bg-gradient-to-b from-amber-500/20 via-neutral-900/90 to-neutral-950 border-2 border-amber-500/60 backdrop-blur-md text-center space-y-4 relative shadow-2xl shadow-amber-500/10 order-1 md:order-2 md:-translate-y-4"
          >
            <div className="absolute -top-6 px-4 py-1.5 rounded-full bg-amber-500 text-neutral-950 font-black text-xs uppercase tracking-widest flex items-center gap-1.5 shadow-xl">
              <Crown size={14} />
              GRAND CHAMPION
            </div>

            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 text-neutral-950 flex items-center justify-center font-mono font-black text-3xl shadow-2xl border-2 border-amber-300">
              <Trophy size={40} />
            </div>

            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">{first.name}</h2>
              {first.college && (
                <span className="text-xs text-amber-200/80 font-mono block truncate max-w-[240px] mx-auto">
                  {first.college} {first.department ? `• ${first.department}` : ""}
                </span>
              )}
            </div>

            <div className="px-6 py-2 rounded-2xl bg-neutral-950 border border-amber-500/40 text-xl font-mono font-black text-amber-400 shadow-inner">
              {first.totalScore.toLocaleString()} PTS
            </div>

            <div className="text-xs font-mono text-neutral-300 flex items-center gap-2">
              <Sparkles size={14} className="text-amber-400" />
              <span>{first.totalCorrect} Total Correct / Solved</span>
            </div>
          </motion.div>
        ) : (
          <div className="order-1 md:order-2" />
        )}

        {/* 3rd Place (Bronze) */}
        {third ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center p-6 rounded-3xl bg-neutral-900/80 border border-amber-900/50 backdrop-blur-md text-center space-y-3 relative shadow-xl order-3"
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-800 text-white flex items-center justify-center font-mono font-black text-xl shadow-lg border-2 border-amber-600/40">
              <Award size={28} />
            </div>

            <span className="px-3 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-amber-400 text-[10px] font-mono font-bold uppercase tracking-wider">
              3RD PLACE • BRONZE
            </span>

            <div>
              <h3 className="text-lg font-black text-white tracking-tight">{third.name}</h3>
              {third.college && (
                <span className="text-xs text-neutral-400 font-mono block truncate max-w-[200px] mx-auto">
                  {third.college}
                </span>
              )}
            </div>

            <div className="px-4 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-base font-mono font-black text-amber-500">
              {third.totalScore.toLocaleString()} PTS
            </div>

            <div className="text-[11px] font-mono text-neutral-400">
              {third.totalCorrect} correct answers/words
            </div>
          </motion.div>
        ) : (
          <div className="hidden md:block order-3" />
        )}
      </div>

      {/* Complete Rankings Table */}
      <div className="p-6 rounded-3xl bg-neutral-900/70 border border-neutral-800 backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-orange-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              Overall Standings (Top {Math.min(leaderboard.length, 20)})
            </h3>
          </div>
          <span className="text-xs font-mono text-neutral-400">
            {totalParticipants} Registered Competitors
          </span>
        </div>

        <div className="overflow-x-auto max-h-[300px] overflow-y-auto pr-1">
          <table className="w-full text-left text-xs font-sans">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400 font-mono text-[10px] uppercase tracking-wider">
                <th className="py-2.5 px-3">Rank</th>
                <th className="py-2.5 px-3">Participant</th>
                <th className="py-2.5 px-3">Institution / College</th>
                <th className="py-2.5 px-3 text-center">Correct</th>
                <th className="py-2.5 px-3 text-right">Total Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-850">
              {leaderboard.slice(0, 20).map((entry) => {
                const isTop3 = entry.rank <= 3;
                return (
                  <tr
                    key={entry.participantId}
                    className={`hover:bg-neutral-850/50 transition-colors ${
                      entry.rank === 1
                        ? "bg-amber-500/5 text-amber-200"
                        : entry.rank === 2
                        ? "bg-neutral-800/20"
                        : entry.rank === 3
                        ? "bg-amber-900/10"
                        : "text-neutral-300"
                    }`}
                  >
                    <td className="py-3 px-3 font-mono font-bold">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs ${
                          entry.rank === 1
                            ? "bg-amber-500 text-neutral-950 font-black"
                            : entry.rank === 2
                            ? "bg-neutral-300 text-neutral-950 font-black"
                            : entry.rank === 3
                            ? "bg-amber-700 text-white font-black"
                            : "bg-neutral-800 text-neutral-400"
                        }`}
                      >
                        {entry.rank}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-white block">{entry.name}</span>
                      {entry.department && (
                        <span className="text-[10px] text-neutral-500 font-mono block">
                          {entry.department}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-neutral-400">
                      {entry.college || "—"}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-emerald-400">
                      {entry.totalCorrect}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-orange-400 text-sm">
                      {entry.totalScore.toLocaleString()} PTS
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Event Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-850 text-center">
          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block">
            TOTAL ATTENDEES
          </span>
          <span className="text-base sm:text-lg font-mono font-black text-white">
            {totalParticipants}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-850 text-center">
          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block">
            ROUNDS COMPLETED
          </span>
          <span className="text-base sm:text-lg font-mono font-black text-orange-400">
            {totalActivities}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-850 text-center">
          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block">
            TOTAL RESPONSES
          </span>
          <span className="text-base sm:text-lg font-mono font-black text-emerald-400">
            {totalSubmissionsCount}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-850 text-center">
          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block">
            AVERAGE SCORE
          </span>
          <span className="text-base sm:text-lg font-mono font-black text-purple-400">
            {averageScore} PTS
          </span>
        </div>
      </div>
    </div>
  );
}
