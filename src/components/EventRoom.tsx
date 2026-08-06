import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { EventItem } from "./PublicEventPage";
import { Participant, getLinkedinProfileUrl } from "./ParticipantOnboarding";
import { EventRoomLayout } from "./EventRoom/EventRoomLayout";

interface EventRoomProps {
  event: EventItem;
  currentParticipant: Participant & { id: string };
  isAdmin?: boolean;
  currentUserEmail?: string | null;
  onBackToEvent: () => void;
  onNavigateHome: () => void;
}

const COMMON_DEPTS = ["All", "CSE", "AIML", "DS", "IT", "ECE", "EEE", "MECH", "CIVIL"];

export function EventRoom({
  event,
  currentParticipant,
  isAdmin = false,
  currentUserEmail,
  onBackToEvent,
  onNavigateHome,
}: EventRoomProps) {
  const [participants, setParticipants] = useState<(Participant & { id: string })[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedDept, setSelectedDept] = useState<string>("All");
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Subscribe to real-time participants subcollection
  useEffect(() => {
    setLoading(true);
    const participantsRef = collection(db, "events", event.id, "participants");
    const q = query(participantsRef, orderBy("joinedAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: (Participant & { id: string })[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Participant & { id: string });
        });
        setParticipants(list);
        setLoading(false);
      },
      (error) => {
        console.warn("Ordered participants query error, falling back:", error);
        const fallbackUnsub = onSnapshot(
          collection(db, "events", event.id, "participants"),
          (snapshot) => {
            const list: (Participant & { id: string })[] = [];
            snapshot.forEach((doc) => {
              list.push({ id: doc.id, ...doc.data() } as Participant & { id: string });
            });
            setParticipants(list);
            setLoading(false);
          }
        );
        return () => fallbackUnsub();
      }
    );

    return () => unsubscribe();
  }, [event.id]);

  // Extract unique departments dynamically from real participant list
  const availableDepts = useMemo(() => {
    const set = new Set<string>(COMMON_DEPTS);
    participants.forEach((p) => {
      if (p.department) {
        const deptUpper = p.department.trim().toUpperCase();
        if (deptUpper.length <= 15) {
          set.add(deptUpper);
        }
      }
    });
    return Array.from(set);
  }, [participants]);

  const isNormalRoom = event.roomType === "normal";

  // Realtime search & department filtering
  const filteredParticipants = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return participants.filter((p) => {
      const isNormalParticipant = isNormalRoom || p.roomType === "normal";

      // 1. Department Filter (Only for LinkedIn rooms)
      if (!isNormalRoom && selectedDept !== "All") {
        const deptUpper = (p.department || "").toUpperCase();
        if (!deptUpper.includes(selectedDept)) {
          return false;
        }
      }

      // 2. Search Text Query
      if (!q) return true;

      const nameMatch = p.name?.toLowerCase().includes(q);
      if (isNormalParticipant) {
        return nameMatch;
      }

      const collegeMatch = p.college?.toLowerCase().includes(q);
      const deptMatch = p.department?.toLowerCase().includes(q);
      const yearMatch = p.year?.toLowerCase().includes(q);

      return nameMatch || collegeMatch || deptMatch || yearMatch;
    });
  }, [participants, searchQuery, selectedDept, isNormalRoom]);

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleConnectClick = (participant: Participant) => {
    const url = getLinkedinProfileUrl(participant);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <EventRoomLayout
      event={event}
      participants={participants}
      filteredParticipants={filteredParticipants}
      currentParticipant={currentParticipant}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      selectedDept={selectedDept}
      setSelectedDept={setSelectedDept}
      availableDepts={availableDepts}
      isAdmin={isAdmin}
      currentUserEmail={currentUserEmail}
      copied={copiedLink}
      onBackToEvent={onBackToEvent}
      onNavigateHome={onNavigateHome}
      onCopyShareLink={handleCopyShareLink}
      onConnectClick={handleConnectClick}
    />
  );
}
