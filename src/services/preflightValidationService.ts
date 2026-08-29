import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, ALLOWED_ADMIN_EMAILS } from "../lib/firebase";
import { EventActivity, getEventActivities, ActivityType } from "./eventActivityService";
import { getQuizBuilderData, validateQuizQuestions } from "./quizBuilderService";
import { getCrosswordBuilderData, compileCrosswordGrid } from "./crosswordBuilderService";
import { getRiddleBuilderData, validateRiddleEntries } from "./riddleBuilderService";

export interface PreflightCheckItem {
  id: string;
  category: "metadata" | "room" | "activities" | "security";
  title: string;
  description: string;
  status: "pass" | "fail" | "warning";
  errorMessage?: string;
  details?: string[];
  activityId?: string;
  activityType?: ActivityType;
  order?: number;
}

export interface PreflightValidationSummary {
  isValid: boolean; // true if 0 "fail" items
  checks: PreflightCheckItem[];
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  warningsCount: number;
  activityCount: number;
  quizCount: number;
  crosswordCount: number;
  riddleCount: number;
  estimatedTotalTimeSec: number;
  validatedAt: Date;
}

/**
 * Execute comprehensive Pre-Flight Validation for an event.
 * Reads only required configuration docs (events/{eventId} and its activities subcollections).
 */
export async function runEventPreflightValidation(
  eventId: string,
  currentUserId?: string,
  currentUserEmail?: string
): Promise<PreflightValidationSummary> {
  const checks: PreflightCheckItem[] = [];
  let activityCount = 0;
  let quizCount = 0;
  let crosswordCount = 0;
  let riddleCount = 0;
  let estimatedTotalTimeSec = 0;

  if (!eventId) {
    checks.push({
      id: "event-id",
      category: "metadata",
      title: "Event Identifier",
      description: "Verifies the event reference exists.",
      status: "fail",
      errorMessage: "No event ID was provided for validation.",
    });
    return {
      isValid: false,
      checks,
      totalChecks: 1,
      passedChecks: 0,
      failedChecks: 1,
      warningsCount: 0,
      activityCount: 0,
      quizCount: 0,
      crosswordCount: 0,
      riddleCount: 0,
      estimatedTotalTimeSec: 0,
      validatedAt: new Date(),
    };
  }

  // 1. Fetch Event Document
  let eventData: any = null;
  try {
    const eventDocRef = doc(db, "events", eventId);
    const eventSnap = await getDoc(eventDocRef);

    if (!eventSnap.exists()) {
      checks.push({
        id: "event-doc-exists",
        category: "metadata",
        title: "Event Existence",
        description: "Checks if the event document is stored in Firestore.",
        status: "fail",
        errorMessage: `Event with ID "${eventId}" does not exist.`,
      });
      return {
        isValid: false,
        checks,
        totalChecks: 1,
        passedChecks: 0,
        failedChecks: 1,
        warningsCount: 0,
        activityCount: 0,
        quizCount: 0,
        crosswordCount: 0,
        riddleCount: 0,
        estimatedTotalTimeSec: 0,
        validatedAt: new Date(),
      };
    }

    eventData = { id: eventSnap.id, ...eventSnap.data() };
    checks.push({
      id: "event-doc-exists",
      category: "metadata",
      title: "Event Record Found",
      description: "Event configuration document is loaded and accessible.",
      status: "pass",
    });
  } catch (err: any) {
    checks.push({
      id: "event-doc-exists",
      category: "metadata",
      title: "Event Record Retrieval",
      description: "Verifies Firestore connection and document access.",
      status: "fail",
      errorMessage: err.message || "Failed to retrieve event document.",
    });
    return {
      isValid: false,
      checks,
      totalChecks: 1,
      passedChecks: 0,
      failedChecks: 1,
      warningsCount: 0,
      activityCount: 0,
      quizCount: 0,
      crosswordCount: 0,
      riddleCount: 0,
      estimatedTotalTimeSec: 0,
      validatedAt: new Date(),
    };
  }

  // 2. Ownership & Security Authorization
  const isSuperAdmin = currentUserEmail ? ALLOWED_ADMIN_EMAILS.includes(currentUserEmail) : false;
  if (currentUserId && eventData.ownerId && eventData.ownerId !== currentUserId && !isSuperAdmin) {
    checks.push({
      id: "security-ownership",
      category: "security",
      title: "Organizer Authorization",
      description: "Verifies that the current user owns this event or has administrative privileges.",
      status: "fail",
      errorMessage: "You do not have permission to validate or publish this event.",
    });
  } else {
    checks.push({
      id: "security-ownership",
      category: "security",
      title: "Organizer Authorization",
      description: "Host ownership and publishing privileges verified.",
      status: "pass",
    });
  }

  // 3. Metadata: Event Title
  const title = (eventData.title || eventData.name || "").trim();
  if (!title) {
    checks.push({
      id: "meta-title",
      category: "metadata",
      title: "Event Name",
      description: "Event must have a clear display name for attendees.",
      status: "fail",
      errorMessage: "Event title is missing or empty.",
    });
  } else if (title.length < 2) {
    checks.push({
      id: "meta-title",
      category: "metadata",
      title: "Event Name",
      description: "Event name is too short.",
      status: "fail",
      errorMessage: "Event title must be at least 2 characters long.",
    });
  } else {
    checks.push({
      id: "meta-title",
      category: "metadata",
      title: "Event Name",
      description: `Valid event name: "${title}"`,
      status: "pass",
    });
  }

  // 4. Metadata: Event Code
  const eventCode = (eventData.eventCode || eventData.code || "").trim();
  if (!eventCode) {
    checks.push({
      id: "meta-code",
      category: "metadata",
      title: "Event Access Code",
      description: "Unique alphanumeric code required for attendees to join.",
      status: "fail",
      errorMessage: "Event code is missing.",
    });
  } else {
    checks.push({
      id: "meta-code",
      category: "metadata",
      title: "Event Access Code",
      description: `Active event code: ${eventCode.toUpperCase()}`,
      status: "pass",
    });
  }

  // 5. Room Type Configuration
  const roomType = eventData.roomType;
  if (roomType === "normal" || roomType === "linkedin") {
    checks.push({
      id: "room-type",
      category: "room",
      title: "Room Type Setup",
      description: `Configured as ${roomType === "linkedin" ? "LinkedIn Professional Room" : "Standard Interactive Room"}.`,
      status: "pass",
    });
  } else {
    checks.push({
      id: "room-type",
      category: "room",
      title: "Room Type Setup",
      description: "Room format must be selected before publishing.",
      status: "fail",
      errorMessage: "Room type has not been configured. Please select Normal or LinkedIn room in Room Setup.",
    });
  }

  // 6. Activities Fetch & Sequence Integrity
  let activities: EventActivity[] = [];
  try {
    activities = await getEventActivities(eventId);
    activityCount = activities.length;
  } catch (err: any) {
    checks.push({
      id: "activities-fetch",
      category: "activities",
      title: "Activities Collection",
      description: "Retrieves configured event activity sequence from database.",
      status: "fail",
      errorMessage: err.message || "Failed to load event activities.",
    });
  }

  if (activities.length === 0) {
    checks.push({
      id: "activities-count",
      category: "activities",
      title: "Event Sequence Content",
      description: "An event must contain at least one configured activity to be published.",
      status: "fail",
      errorMessage: "No activities found. Add at least one Quiz, Crossword, or Riddle activity to the sequence before publishing.",
    });
  } else {
    checks.push({
      id: "activities-count",
      category: "activities",
      title: "Event Sequence Content",
      description: `Sequence contains ${activities.length} ${activities.length === 1 ? "activity" : "activities"}.`,
      status: "pass",
    });

    // Validate sequence order numbers
    const orderNumbers = activities.map((a) => a.order);
    const hasDuplicates = new Set(orderNumbers).size !== orderNumbers.length;
    if (hasDuplicates) {
      checks.push({
        id: "sequence-order-integrity",
        category: "activities",
        title: "Sequence Ordering",
        description: "Checks that activities have distinct sequential order indexes.",
        status: "fail",
        errorMessage: "Sequence order numbers contain duplicates. Please save sequence in Activities Manager.",
      });
    } else {
      checks.push({
        id: "sequence-order-integrity",
        category: "activities",
        title: "Sequence Ordering",
        description: `Sequential flow ordered 1 through ${activities.length}.`,
        status: "pass",
      });
    }

    // 7. Validate Each Individual Activity Deeply
    for (let idx = 0; idx < activities.length; idx++) {
      const act = activities[idx];
      const actOrder = act.order || idx + 1;
      const actTitle = act.title || `Activity #${actOrder}`;

      if (act.type === "quiz") {
        quizCount++;
        try {
          const quizData = await getQuizBuilderData(eventId, act.id);
          if (!quizData) {
            checks.push({
              id: `quiz-data-${act.id}`,
              category: "activities",
              activityId: act.id,
              activityType: "quiz",
              order: actOrder,
              title: `Quiz #${actOrder}: "${actTitle}"`,
              description: "Checks quiz question subcollection existence.",
              status: "fail",
              errorMessage: "Quiz activity document or questions subcollection not found.",
            });
            continue;
          }

          const questions = quizData.questions || [];
          if (questions.length === 0) {
            checks.push({
              id: `quiz-questions-${act.id}`,
              category: "activities",
              activityId: act.id,
              activityType: "quiz",
              order: actOrder,
              title: `Quiz #${actOrder}: "${actTitle}"`,
              description: "Requires at least 1 question to run during live session.",
              status: "fail",
              errorMessage: `Quiz has 0 questions. Please add at least 1 question with 4 options in the Quiz Builder.`,
            });
          } else {
            // Validate each question
            const validationErrors = validateQuizQuestions(questions);
            if (validationErrors.length > 0) {
              const errorDetails = validationErrors.flatMap((v) =>
                v.errors.map((e) => `Question ${v.questionNumber}: ${e}`)
              );
              checks.push({
                id: `quiz-questions-${act.id}`,
                category: "activities",
                activityId: act.id,
                activityType: "quiz",
                order: actOrder,
                title: `Quiz #${actOrder}: "${actTitle}"`,
                description: `Contains ${questions.length} questions, but validation found issues.`,
                status: "fail",
                errorMessage: `Quiz has ${validationErrors.length} question(s) with incomplete configuration.`,
                details: errorDetails,
              });
            } else {
              // Calculate estimated time
              const totalSec = questions.reduce((sum, q) => sum + (q.timeLimitSec || 15), 0);
              estimatedTotalTimeSec += totalSec;

              checks.push({
                id: `quiz-questions-${act.id}`,
                category: "activities",
                activityId: act.id,
                activityType: "quiz",
                order: actOrder,
                title: `Quiz #${actOrder}: "${actTitle}"`,
                description: `${questions.length} questions ready (${Math.round(totalSec / 60)} min runtime).`,
                status: "pass",
              });
            }
          }
        } catch (err: any) {
          checks.push({
            id: `quiz-err-${act.id}`,
            category: "activities",
            activityId: act.id,
            activityType: "quiz",
            order: actOrder,
            title: `Quiz #${actOrder}: "${actTitle}"`,
            description: "Error verifying quiz data.",
            status: "fail",
            errorMessage: err.message || "Failed to load and validate quiz questions.",
          });
        }
      } else if (act.type === "crossword") {
        crosswordCount++;
        try {
          const crosswordData = await getCrosswordBuilderData(eventId, act.id);
          if (!crosswordData) {
            checks.push({
              id: `crossword-data-${act.id}`,
              category: "activities",
              activityId: act.id,
              activityType: "crossword",
              order: actOrder,
              title: `Crossword #${actOrder}: "${actTitle}"`,
              description: "Checks crossword configuration subcollection.",
              status: "fail",
              errorMessage: "Crossword activity document not found.",
            });
            continue;
          }

          const entries = crosswordData.entries || [];
          const gridConfig = crosswordData.gridConfig || { gridRows: 12, gridCols: 12 };

          if (entries.length === 0) {
            checks.push({
              id: `crossword-entries-${act.id}`,
              category: "activities",
              activityId: act.id,
              activityType: "crossword",
              order: actOrder,
              title: `Crossword #${actOrder}: "${actTitle}"`,
              description: "Requires at least 1 word clue entry in the puzzle.",
              status: "fail",
              errorMessage: "Crossword has 0 word clues. Add entries in the Crossword Builder.",
            });
          } else {
            const compiled = compileCrosswordGrid(
              gridConfig.gridRows,
              gridConfig.gridCols,
              entries
            );

            if (!compiled.isValid || compiled.validationErrors.length > 0) {
              const errorDetails = compiled.validationErrors.flatMap((v) =>
                v.errors.map((e) => `Entry #${v.entryIndex + 1} (${v.direction.toUpperCase()}): ${e}`)
              );

              checks.push({
                id: `crossword-entries-${act.id}`,
                category: "activities",
                activityId: act.id,
                activityType: "crossword",
                order: actOrder,
                title: `Crossword #${actOrder}: "${actTitle}"`,
                description: `Grid has ${entries.length} entries, but conflicts or boundary errors were detected.`,
                status: "fail",
                errorMessage: `Crossword puzzle has ${compiled.validationErrors.length} validation error(s).`,
                details: errorDetails,
              });
            } else {
              estimatedTotalTimeSec += 180; // Standard 3 min estimate
              checks.push({
                id: `crossword-entries-${act.id}`,
                category: "activities",
                activityId: act.id,
                activityType: "crossword",
                order: actOrder,
                title: `Crossword #${actOrder}: "${actTitle}"`,
                description: `Valid ${gridConfig.gridRows}×${gridConfig.gridCols} grid with ${entries.length} clues (${compiled.acrossCount} across, ${compiled.downCount} down).`,
                status: "pass",
              });
            }
          }
        } catch (err: any) {
          checks.push({
            id: `crossword-err-${act.id}`,
            category: "activities",
            activityId: act.id,
            activityType: "crossword",
            order: actOrder,
            title: `Crossword #${actOrder}: "${actTitle}"`,
            description: "Error verifying crossword grid.",
            status: "fail",
            errorMessage: err.message || "Failed to load and compile crossword entries.",
          });
        }
      } else if (act.type === "riddle") {
        riddleCount++;
        try {
          const riddleData = await getRiddleBuilderData(eventId, act.id);
          if (!riddleData) {
            checks.push({
              id: `riddle-data-${act.id}`,
              category: "activities",
              activityId: act.id,
              activityType: "riddle",
              order: actOrder,
              title: `Riddle #${actOrder}: "${actTitle}"`,
              description: "Checks riddle entries subcollection.",
              status: "fail",
              errorMessage: "Riddle activity document not found.",
            });
            continue;
          }

          const riddles = riddleData.riddles || [];
          if (riddles.length === 0) {
            checks.push({
              id: `riddle-entries-${act.id}`,
              category: "activities",
              activityId: act.id,
              activityType: "riddle",
              order: actOrder,
              title: `Riddle #${actOrder}: "${actTitle}"`,
              description: "Requires at least 1 riddle prompt to run.",
              status: "fail",
              errorMessage: "Riddle activity has 0 riddles. Add at least 1 riddle in the Riddle Builder.",
            });
          } else {
            const validation = validateRiddleEntries(riddles, act.title);
            if (!validation.isValid) {
              const errorDetails: string[] = [];
              validation.globalErrors.forEach((g) => errorDetails.push(`Global: ${g}`));
              validation.errors.forEach((e) => {
                e.errors.forEach((err) => {
                  errorDetails.push(`Riddle #${e.riddleIndex + 1}: ${err}`);
                });
              });

              checks.push({
                id: `riddle-entries-${act.id}`,
                category: "activities",
                activityId: act.id,
                activityType: "riddle",
                order: actOrder,
                title: `Riddle #${actOrder}: "${actTitle}"`,
                description: `Contains ${riddles.length} riddles with validation errors.`,
                status: "fail",
                errorMessage: `Riddle activity has ${errorDetails.length} configuration error(s).`,
                details: errorDetails,
              });
            } else {
              const totalSec = riddles.reduce((sum, r) => sum + (r.timeLimitSec || 20), 0);
              estimatedTotalTimeSec += totalSec;

              checks.push({
                id: `riddle-entries-${act.id}`,
                category: "activities",
                activityId: act.id,
                activityType: "riddle",
                order: actOrder,
                title: `Riddle #${actOrder}: "${actTitle}"`,
                description: `${riddles.length} riddles ready (${Math.round(totalSec / 60)} min runtime).`,
                status: "pass",
              });
            }
          }
        } catch (err: any) {
          checks.push({
            id: `riddle-err-${act.id}`,
            category: "activities",
            activityId: act.id,
            activityType: "riddle",
            order: actOrder,
            title: `Riddle #${actOrder}: "${actTitle}"`,
            description: "Error verifying riddle entries.",
            status: "fail",
            errorMessage: err.message || "Failed to load and validate riddles.",
          });
        }
      }
    }
  }

  const failedChecks = checks.filter((c) => c.status === "fail").length;
  const passedChecks = checks.filter((c) => c.status === "pass").length;
  const warningsCount = checks.filter((c) => c.status === "warning").length;
  const isValid = failedChecks === 0;

  return {
    isValid,
    checks,
    totalChecks: checks.length,
    passedChecks,
    failedChecks,
    warningsCount,
    activityCount,
    quizCount,
    crosswordCount,
    riddleCount,
    estimatedTotalTimeSec,
    validatedAt: new Date(),
  };
}

/**
 * Publish an Event.
 * Atomically updates status to "published" and acceptingParticipants to true.
 * Participants can now join the Waiting Room. (Does NOT start live event).
 */
export async function publishEvent(
  eventId: string,
  currentUserId?: string,
  currentUserEmail?: string
): Promise<{ success: boolean; error?: string }> {
  if (!eventId) {
    return { success: false, error: "Event ID is required." };
  }

  // 1. Run Pre-flight Validation to guarantee readiness
  const validation = await runEventPreflightValidation(eventId, currentUserId, currentUserEmail);
  if (!validation.isValid) {
    const firstFail = validation.checks.find((c) => c.status === "fail");
    return {
      success: false,
      error: firstFail?.errorMessage || `Pre-flight validation failed with ${validation.failedChecks} error(s).`,
    };
  }

  // 2. Perform Atomic Update to Firestore
  try {
    const eventDocRef = doc(db, "events", eventId);
    await updateDoc(eventDocRef, {
      status: "published",
      acceptingParticipants: true,
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (err: any) {
    console.error("Error publishing event:", err);
    return {
      success: false,
      error: err.message || "Failed to publish event. Please verify your internet connection and permissions.",
    };
  }
}

/**
 * Revert a published event back to Draft status (or close participant intake).
 */
export async function unpublishEvent(
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  if (!eventId) {
    return { success: false, error: "Event ID is required." };
  }

  try {
    const eventDocRef = doc(db, "events", eventId);
    await updateDoc(eventDocRef, {
      status: "draft",
      acceptingParticipants: false,
      unpublishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (err: any) {
    console.error("Error unpublishing event:", err);
    return {
      success: false,
      error: err.message || "Failed to revert event to draft status.",
    };
  }
}
