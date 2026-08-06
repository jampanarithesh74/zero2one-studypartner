import { useState } from "react";
import { Users, Radio, MessageSquare } from "lucide-react";
import { EventItem } from "../PublicEventPage";
import { Participant } from "../ParticipantOnboarding";
import { RoomHeader } from "./RoomHeader";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { LiveRoomPanel } from "./LiveRoomPanel";
import { ChatPanel } from "./ChatPanel";
import { AskQuestionModal } from "./AskQuestionModal";

interface EventRoomLayoutProps {
  event: EventItem;
  participants: (Participant & { id: string })[];
  filteredParticipants: (Participant & { id: string })[];
  currentParticipant: Participant & { id: string };
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedDept: string;
  setSelectedDept: (dept: string) => void;
  availableDepts: string[];
  isAdmin?: boolean;
  currentUserEmail?: string | null;
  copied: boolean;
  onBackToEvent: () => void;
  onNavigateHome: () => void;
  onCopyShareLink: () => void;
  onConnectClick: (p: Participant & { id: string }) => void;
}

export function EventRoomLayout({
  event,
  participants,
  filteredParticipants,
  currentParticipant,
  searchQuery,
  setSearchQuery,
  selectedDept,
  setSelectedDept,
  availableDepts,
  isAdmin = false,
  currentUserEmail,
  copied,
  onBackToEvent,
  onNavigateHome,
  onCopyShareLink,
  onConnectClick,
}: EventRoomLayoutProps) {
  const [activeTab, setActiveTab] = useState<"participants" | "live" | "chat">("live");
  const [isAskModalOpen, setIsAskModalOpen] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* 1. Header */}
      <RoomHeader
        event={event}
        participantCount={participants.length}
        isAdmin={isAdmin}
        onOpenAskModal={() => setIsAskModalOpen(true)}
        onBackToEvent={onBackToEvent}
        onNavigateHome={onNavigateHome}
        onCopyShareLink={onCopyShareLink}
        copied={copied}
      />

      {/* 2. Mobile / Tablet Tab Selector (Hidden on Desktop lg:hidden) */}
      <div className="lg:hidden bg-neutral-900/90 border-b border-neutral-800 p-2 sticky top-[73px] z-30">
        <div className="grid grid-cols-3 gap-1 max-w-md mx-auto">
          <button
            type="button"
            onClick={() => setActiveTab("participants")}
            className={`py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
              activeTab === "participants"
                ? "bg-orange-500 text-white border-orange-400 shadow-md"
                : "bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white"
            }`}
          >
            <Users size={13} />
            <span>Members ({participants.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("live")}
            className={`py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
              activeTab === "live"
                ? "bg-orange-500 text-white border-orange-400 shadow-md"
                : "bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white"
            }`}
          >
            <Radio size={13} />
            <span>Live Room</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
              activeTab === "chat"
                ? "bg-orange-500 text-white border-orange-400 shadow-md"
                : "bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white"
            }`}
          >
            <MessageSquare size={13} />
            <span>Chat</span>
          </button>
        </div>
      </div>

      {/* 3. Main Three-Panel Grid Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-6 flex flex-col">
        {/* Desktop View: Three Side-by-Side Panels (25% / 50% / 25%) */}
        <div className="hidden lg:grid lg:grid-cols-12 lg:gap-5 flex-1 min-h-[calc(100vh-160px)]">
          {/* Left Panel: Participants (25% = col-span-3) */}
          <div className="lg:col-span-3 h-full">
            <ParticipantsPanel
              event={event}
              participants={participants}
              filteredParticipants={filteredParticipants}
              currentParticipant={currentParticipant}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedDept={selectedDept}
              setSelectedDept={setSelectedDept}
              availableDepts={availableDepts}
              onConnectClick={onConnectClick}
            />
          </div>

          {/* Center Panel: Live Room (50% = col-span-6) */}
          <div className="lg:col-span-6 h-full">
            <LiveRoomPanel
              event={event}
              currentParticipant={currentParticipant}
              isAdmin={isAdmin}
              onOpenAskModal={() => setIsAskModalOpen(true)}
            />
          </div>

          {/* Right Panel: Chat Room (25% = col-span-3) */}
          <div className="lg:col-span-3 h-full">
            <ChatPanel event={event} />
          </div>
        </div>

        {/* Mobile/Tablet View: Tabbed Layout */}
        <div className="lg:hidden flex-1 min-h-[500px]">
          {activeTab === "participants" && (
            <ParticipantsPanel
              event={event}
              participants={participants}
              filteredParticipants={filteredParticipants}
              currentParticipant={currentParticipant}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedDept={selectedDept}
              setSelectedDept={setSelectedDept}
              availableDepts={availableDepts}
              onConnectClick={onConnectClick}
            />
          )}

          {activeTab === "live" && (
            <LiveRoomPanel
              event={event}
              currentParticipant={currentParticipant}
              isAdmin={isAdmin}
              onOpenAskModal={() => setIsAskModalOpen(true)}
            />
          )}

          {activeTab === "chat" && <ChatPanel event={event} />}
        </div>
      </main>

      {/* Admin Ask Question Modal */}
      {isAdmin && (
        <AskQuestionModal
          isOpen={isAskModalOpen}
          onClose={() => setIsAskModalOpen(false)}
          eventId={event.id}
          currentUserEmail={currentUserEmail}
        />
      )}
    </div>
  );
}
