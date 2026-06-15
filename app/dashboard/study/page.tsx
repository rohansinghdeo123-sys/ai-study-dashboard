"use client";

import { useAuth } from "@/context/AuthContext";
import ChatThinkingLogo from "@/components/brand/ChatThinkingLogo";
import ArtifactCanvas, { ARTIFACT_UNAVAILABLE_MESSAGE } from "@/components/study/ArtifactCanvas";
import RevisionModeTabs from "@/components/study/RevisionModeTabs";
import {
  AlertState,
  AppIcon,
  EmptyState,
  IconButton,
  LoadingState,
  type AppIconName,
} from "@/components/ui/Polished";
import { apiFetch, apiJson, invalidateApiCache } from "@/lib/apiClient";
import { normalizeSubscriptGlyphs, tokenizeStudyText } from "@/lib/studyChemistry";
import { useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";

type CoachRole = "user" | "coach";
type AgentStageId = "received" | "understanding" | "drafting" | "reviewing" | "formatting" | "delivering";
type AgentStageStatus = "pending" | "active" | "done";
type StudyMode = "coach" | "revision" | "exam" | "history";
type RevisionType = "summary" | "explain" | "keypoints";
type RevisionPanel = RevisionType | "artifact";
type ExamPanel = "mcq" | "probable" | "practice" | "review";
type ArtifactType = "concept_map" | "flip_cards" | "formula_lab" | "mistake_cards";
type LearningIntent = "concept" | "exam" | "revision" | "practice" | "planning" | "curiosity";
type LearningLevel = "beginner" | "intermediate" | "advanced";
type EmotionalState = "steady" | "confused" | "anxious" | "curious" | "confident";
type LearningSpeed = "slow" | "balanced" | "fast";
type AdaptiveAnswerBlockKind = "explanation" | "example" | "formula" | "mistake" | "checkpoint" | "recall";

interface AdaptiveAnswerBlock {
  kind: AdaptiveAnswerBlockKind | string;
  title: string;
  content: string;
}

interface CoachMessage {
  role: CoachRole;
  content: string;
  timestamp: string;
  blocks?: AdaptiveAnswerBlock[];
  sources?: CoachSources;
  socratic?: boolean;
  attachments?: DisplayAttachment[];
}

interface StudyConversation {
  id: string;
  sessionId?: string;
  title: string;
  updatedAt: string;
  chapter: string;
  topic: string;
  messages: CoachMessage[];
  pinned?: boolean;
  archived?: boolean;
  titleLocked?: boolean;
}

interface CoachCitation {
  id: string;
  label: string;
  source: string;
  section_id?: string;
  excerpt?: string;
  kind?: string;
}

interface CoachSources {
  grounded: boolean;
  indicator?: string;
  answer_basis?: string;
  retrieval_policy?: string;
  material_supported?: boolean;
  source_count?: number;
  citations: CoachCitation[];
}

interface DisplayAttachment {
  name: string;
  mime_type: string;
  size_bytes: number;
}

interface PendingAttachment extends DisplayAttachment {
  id: string;
  data_url: string;
}

interface AgentStageState {
  id: AgentStageId;
  agent: string;
  title: string;
  detail: string;
  status: AgentStageStatus;
}

interface AgentStagePayload {
  type: "agent_stage";
  stage: AgentStageId;
  status: AgentStageStatus;
  agent?: string;
  title?: string;
  detail?: string;
}

interface AnswerDeltaPayload {
  type: "answer_delta";
  delta: string;
}

interface TurnEventPayload {
  type: "turn_event";
  event: string;
  turn_id?: string;
  answer?: string;
  blocks?: AdaptiveAnswerBlock[];
  sources?: CoachSources;
  socratic?: boolean;
  metadata?: Record<string, unknown>;
}

type StreamProcessResult =
  | { kind: "none" }
  | { kind: "delta"; value: string }
  | { kind: "answer"; value: string };

interface RevisionTool {
  id: RevisionType;
  title: string;
  detail: string;
  mode: "summary" | "explain" | "keypoints";
  prompt: (topic: string) => string;
}

interface ArtifactNode {
  id: string;
  label: string;
  description?: string;
  kind?: "core" | "property" | "related" | "prerequisite";
}

interface ArtifactEdge {
  from: string;
  to: string;
  label?: string;
}

interface FlipCard {
  front: string;
  back: string;
  tag?: string;
}

interface FormulaItem {
  label: string;
  formula: string;
  variables?: string[];
  hint?: string;
}

interface MistakeItem {
  mistake: string;
  correction: string;
  frequency?: string;
}

interface StudyArtifact {
  type: ArtifactType;
  title: string;
  subtitle?: string;
  nodes?: ArtifactNode[];
  edges?: ArtifactEdge[];
  cards?: FlipCard[];
  formulas?: FormulaItem[];
  mistakes?: MistakeItem[];
  empty_note?: string;
}

interface StudyArtifactResponse {
  available?: boolean;
  source: string;
  section_id: string;
  subject?: string;
  chapter?: string;
  topic?: string;
  generated_at?: string;
  title: string;
  subtitle?: string;
  student_goal?: string;
  quality?: {
    key_points?: number;
    formulas?: number;
    mistakes?: number;
  };
  artifacts: StudyArtifact[];
}

interface MentorProfile {
  intent: LearningIntent;
  level: LearningLevel;
  emotion: EmotionalState;
  confidence: number;
  speed: LearningSpeed;
  curiosityDepth: number;
  answerStyle: string;
  nextMove: string;
  shouldTest: boolean;
  weakSignals: string[];
}

interface ExamQuestion {
  id: string;
  question: string;
  options: string[];
  correct: string;
  explanation?: string;
  source?: string;
}

interface ProbableQuestion {
  id: string;
  marks: number;
  question: string;
  source?: string;
}

type SpeechRecognitionEventLike = {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const CHAPTERS = [
  {
    label: "Hydrocarbon",
    value: "hydrocarbon",
    topics: [
      { label: "Alkanes", value: "alkanes" },
      { label: "Alkenes", value: "alkenes" },
      { label: "Alkynes", value: "alkynes" },
      { label: "Aromatic Hydrocarbons", value: "aromatics" },
    ],
  },
  {
    label: "Basic Concepts of Chemistry",
    value: "matter",
    topics: [
      { label: "Definition of Chemistry", value: "chemistry_definition" },
      { label: "Alchemy and Iatrochemistry", value: "historical_alchemy" },
      { label: "Ancient Indian Chemistry", value: "ancient_indian_chemistry" },
      { label: "Role and Importance of Chemistry", value: "importance_of_chemistry" },
      { label: "Matter Definition", value: "matter_definition" },
      { label: "Properties of Matter", value: "properties_of_matter" },
      { label: "States of Matter", value: "states_of_matter" },
      { label: "Solid State", value: "solid_state" },
      { label: "Liquid State", value: "liquid_state" },
      { label: "Gaseous State", value: "gaseous_state" },
      { label: "Interconversion of States", value: "interconversion_of_states" },
      { label: "Classification of Matter", value: "classification_of_matter" },
    ],
  },
];

const REVISION_TOOLS: RevisionTool[] = [
  {
    id: "summary",
    title: "Summary",
    detail: "A clean revision note from the selected chapter data.",
    mode: "summary",
    prompt: (topic) => `Create simple revision notes for ${topic} from the selected study material only.`,
  },
  {
    id: "explain",
    title: "Deep Dive",
    detail: "A deeper teacher-style explanation while staying grounded in the material.",
    mode: "explain",
    prompt: (topic) => `Deeply explain ${topic} from the selected study material only, with examples if available in the data.`,
  },
  {
    id: "keypoints",
    title: "Quick Recall",
    detail: "High-yield recall bullets for fast exam revision.",
    mode: "keypoints",
    prompt: (topic) => `Extract the most important key points for ${topic} from the selected study material only.`,
  },
];

const ARTIFACT_TABS: Array<{ id: ArtifactType; label: string; icon: AppIconName }> = [
  { id: "flip_cards", label: "Cards", icon: "copy" },
  { id: "mistake_cards", label: "Mistakes", icon: "check" },
];

const EXAM_TABS: Array<{ id: ExamPanel; label: string; detail: string; icon: AppIconName }> = [
  { id: "mcq", label: "MCQ", detail: "Attempt grounded multiple-choice questions.", icon: "check" },
  { id: "probable", label: "Probable", detail: "Review likely theory questions from the chapter.", icon: "book" },
  { id: "practice", label: "Practice", detail: "Use the same question set as a quick drill.", icon: "study" },
  { id: "review", label: "Review", detail: "Check score, explanations, and sources.", icon: "analytics" },
];

const STUDY_MODES: Array<{ id: StudyMode; label: string; detail: string; icon: AppIconName }> = [
  { id: "coach", label: "Chat", detail: "Ask doubts and continue your study conversation.", icon: "study" },
  { id: "revision", label: "Revision", detail: "Open summaries, explanations, recall notes, and study tools.", icon: "book" },
];

const STAGE_ORDER: AgentStageId[] = ["received", "understanding", "drafting", "reviewing", "formatting", "delivering"];

function normalizeTopicValue(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function findChapterValueForTopic(topicValue: string) {
  const normalizedTopic = normalizeTopicValue(topicValue);
  return CHAPTERS.find((chapter) => chapter.topics.some((item) => item.value === normalizedTopic))?.value || "";
}

const MATERIAL_NOT_FOUND_MESSAGE = "I could not find this in your study material. Please upload or select the correct chapter/data.";
const TUTOR_TEMPORARY_ERROR_MESSAGE = "I could not complete that response right now. Please try again.";

const DATA_GROUNDED_TUTOR_GUARDRAIL = [
  "You are AgentifyAI's study tutor working inside a data-grounded learning app.",
  "Use only the uploaded or ingested study material, selected subject, selected chapter, selected topic, and retrieved context supplied by the backend.",
  "Do not use outside knowledge, generic LLM memory, or guesses.",
  "If the retrieved context does not contain the answer, reply exactly: I could not find this in your study material. Please upload or select the correct chapter/data.",
  "Preserve conversation continuity. Follow-up words like this, it, explain again, simplify, more examples, and simple words refer to the previous user question and previous tutor answer unless the student clearly changes topic.",
  "Never switch topic unless the student clearly asks for a new topic.",
  "Keep answers exam-focused, clear, and traceable to the study material.",
].join(" ");

const REASONING_FIRST_TUTOR_GUARDRAIL = [
  "You are AgentifyAI's reasoning-first private tutor for school students.",
  "Understand the student's intent, resolve follow-up context, choose the best teaching strategy, and then answer.",
  "Use conversation memory and reliable subject reasoning naturally. Do not behave like a keyword-search bot.",
  "Use retrieved study material only when the student asks for notes, textbook, syllabus, uploaded data, or source-grounded verification.",
  "If source grounding is explicitly requested and the material is unavailable, explain that clearly and ask for the missing material.",
  "Preserve conversation continuity. Follow-up words like this, it, explain again, simplify, more examples, and simple words refer to the previous user question and previous tutor answer unless the student clearly changes topic.",
  "Remain subject-agnostic, calm, accurate, student-friendly, and clear.",
].join(" ");

function safeJsonResponse(response: Response) {
  return response.json().catch(() => null);
}

function isBackendFailureText(value: unknown) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return true;
  return [
    "knowledge base error",
    "section '",
    "not found in any knowledge source",
    "ai service encountered an error",
    "no response generated",
    "no revision generated",
    "option unavailable",
    "not enough context",
    "insufficient context",
    "insufficient study material",
    "not present in the data",
    "not in your study material",
    "could not find this in your study material",
  ].some((marker) => text.includes(marker));
}

function getUsableBackendAnswer(data: unknown) {
  if (!data || typeof data !== "object") return "";
  const answer = String((data as { answer?: unknown }).answer || "").trim();
  return isBackendFailureText(answer) ? "" : answer;
}

function getCoachSafeAnswer(value: unknown) {
  const answer = String(value || "").trim();
  if (!answer) return TUTOR_TEMPORARY_ERROR_MESSAGE;
  if (answer.toLowerCase().includes("could not find this in your study material")) {
    return MATERIAL_NOT_FOUND_MESSAGE;
  }
  return isBackendFailureText(answer) ? TUTOR_TEMPORARY_ERROR_MESSAGE : answer;
}

function isFollowUpPrompt(value: string) {
  const lower = value.toLowerCase().trim();
  if (!lower) return false;
  const followUpPatterns = [
    /\b(this|that|it|these|those|same topic|above|previous|last answer|your answer)\b/,
    /\b(simple words|simplify|explain again|again|more examples?|another example|explain more|in short|make it easy)\b/,
    /\b(can you explain|please explain|what does it mean|why is that|how so)\b/,
  ];
  return followUpPatterns.some((pattern) => pattern.test(lower));
}

function significantTerms(value: string) {
  const stopWords = new Set([
    "define", "explain", "simple", "words", "please", "can", "you", "this", "that", "what", "why", "how",
    "the", "and", "with", "from", "into", "about", "again", "more", "example", "examples", "tell", "me",
  ]);
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 4 && !stopWords.has(term))
    .slice(0, 8);
}

function getPreviousStudyContext(history: CoachMessage[]) {
  const previousUser = [...history].reverse().find((message) => message.role === "user" && message.content.trim());
  const previousCoach = [...history].reverse().find((message) => message.role === "coach" && message.content.trim());
  const previousQuestion = previousUser?.content.trim() || "";
  const previousAnswer = previousCoach?.content.trim() || "";
  return {
    previousQuestion,
    previousAnswer,
    anchorTerms: significantTerms(`${previousQuestion} ${previousAnswer}`),
  };
}

function buildTutorContextMessage(prompt: string, history: CoachMessage[]) {
  const previous = getPreviousStudyContext(history);
  const followUp = isFollowUpPrompt(prompt) && Boolean(previous.previousQuestion || previous.previousAnswer);

  if (!followUp) {
    return {
      message: prompt,
      isFollowUp: false,
      previousQuestion: previous.previousQuestion,
      previousAnswer: previous.previousAnswer,
      anchorTerms: significantTerms(prompt),
    };
  }

  return {
    message: [
      "The student is asking a follow-up. Resolve the reference from the recent conversation before answering.",
      `Current follow-up: ${prompt}`,
      previous.previousQuestion ? `Previous user question: ${previous.previousQuestion}` : "",
      previous.previousAnswer ? `Previous tutor answer: ${previous.previousAnswer.slice(0, 1400)}` : "",
      "Continue the previous lesson naturally unless the student clearly asks to change topic.",
    ].filter(Boolean).join("\n"),
    isFollowUp: true,
    previousQuestion: previous.previousQuestion,
    previousAnswer: previous.previousAnswer,
    anchorTerms: previous.anchorTerms,
  };
}

function normalizeCorrectOption(correctValue: unknown, options: string[]) {
  const correct = String(correctValue || "").trim();
  const letter = correct.slice(0, 1).toUpperCase();
  if (/^[A-D]$/.test(letter)) return letter;
  const optionIndex = options.findIndex((option) => option.trim().toLowerCase() === correct.toLowerCase());
  return optionIndex >= 0 ? String.fromCharCode(65 + optionIndex) : "";
}

function normalizeExamQuestion(raw: unknown, index: number, fallbackSource: string): ExamQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const question = String(record.question || record.text || "").trim();
  const options = Array.isArray(record.options)
    ? record.options.map((option) => String(option || "").trim()).filter(Boolean).slice(0, 4)
    : [];
  const correct = normalizeCorrectOption(record.correct ?? record.correct_answer ?? record.answer, options);
  const explanation = String(record.explanation || record.ai_explanation || "").trim();
  const source = String(record.source || record.reference || record.topic || record.section_id || fallbackSource || "").trim();

  if (!question || options.length !== 4 || !correct || !explanation) return null;
  if (isBackendFailureText(question) || options.some((option) => isBackendFailureText(option)) || isBackendFailureText(explanation)) return null;

  return {
    id: String(record.id || `Q${index + 1}`),
    question,
    options,
    correct,
    explanation,
    source,
  };
}

function normalizeProbableQuestion(raw: unknown, index: number, fallbackSource: string): ProbableQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const question = String(record.question || record.text || "").trim();
  if (!question || isBackendFailureText(question)) return null;
  return {
    id: String(record.id || `P${index + 1}`),
    marks: Number(record.marks || (index < 2 ? 3 : 5)),
    question,
    source: String(record.source || record.reference || record.topic || record.section_id || fallbackSource || "").trim(),
  };
}

function isUsableArtifactResponse(data: unknown): data is StudyArtifactResponse {
  if (!data || typeof data !== "object") return false;
  const response = data as StudyArtifactResponse;
  return Array.isArray(response.artifacts) && response.artifacts.some((item) => artifactHasContent(item));
}

function hasAny(value: string, words: string[]) {
  return words.some((word) => value.includes(word));
}

function inferMentorProfile(prompt: string, history: CoachMessage[]): MentorProfile {
  const lower = prompt.toLowerCase();
  const recentText = history.slice(-8).map((message) => message.content).join(" ").toLowerCase();
  const combined = `${recentText} ${lower}`;

  const intent: LearningIntent = hasAny(lower, ["exam", "mcq", "marks", "test", "paper", "answer format", "important question"])
    ? "exam"
    : hasAny(lower, ["revise", "revision", "summary", "formula", "key point", "quick notes"])
      ? "revision"
      : hasAny(lower, ["practice", "quiz", "ask me", "question me"])
        ? "practice"
        : hasAny(lower, ["plan", "schedule", "roadmap", "timetable"])
          ? "planning"
          : hasAny(lower, ["why", "how", "real life", "application", "deeper"])
            ? "curiosity"
            : "concept";

  const level: LearningLevel = hasAny(lower, ["basic", "basics", "simple", "first time", "beginner", "meaning", "what is"])
    ? "beginner"
    : hasAny(lower, ["advanced", "deep", "edge case", "mechanism", "real-world", "application"])
      ? "advanced"
      : intent === "exam"
        ? "intermediate"
        : "intermediate";

  const emotion: EmotionalState = hasAny(combined, ["confused", "stuck", "don't understand", "dont understand", "not clear", "again"])
    ? "confused"
    : hasAny(combined, ["worried", "scared", "panic", "exam tomorrow", "stress"])
      ? "anxious"
      : hasAny(lower, ["why", "how", "curious", "deeper"])
        ? "curious"
        : hasAny(lower, ["i know", "i understand", "got it", "easy"])
          ? "confident"
          : "steady";

  const speed: LearningSpeed = hasAny(lower, ["quick", "short", "fast", "brief"])
    ? "fast"
    : hasAny(lower, ["slow", "step by step", "slowly", "detail"])
      ? "slow"
      : "balanced";

  const weakSignals = [
    hasAny(combined, ["confused", "stuck", "not clear"]) ? "confusion" : "",
    hasAny(combined, ["wrong", "mistake", "incorrect"]) ? "mistake pattern" : "",
    hasAny(combined, ["again", "repeat", "re-explain"]) ? "needs reinforcement" : "",
  ].filter(Boolean);

  const confidence = emotion === "confused" ? 38 : emotion === "anxious" ? 45 : emotion === "confident" ? 82 : 66;
  const curiosityDepth = level === "advanced" || intent === "curiosity" ? 78 : level === "beginner" ? 35 : 55;
  const answerStyle =
    intent === "exam"
      ? "exam strategy, traps, and marks-ready structure"
      : intent === "revision"
        ? "quick recall notes with formulas and checkpoints"
        : level === "beginner"
          ? "simple explanation with analogy and one check question"
          : level === "advanced"
            ? "deep explanation with applications and edge cases"
            : "structured concept breakdown with examples";

  const nextMove =
    emotion === "confused"
      ? "slow down, simplify, then ask a tiny check question"
      : intent === "practice"
        ? "test understanding and review the answer"
        : intent === "exam"
          ? "teach scoring pattern and common traps"
          : "explain, connect, and decide whether to test";

  return {
    intent,
    level,
    emotion,
    confidence,
    speed,
    curiosityDepth,
    answerStyle,
    nextMove,
    shouldTest: emotion === "confused" || intent === "practice" || intent === "exam",
    weakSignals,
  };
}

function buildMentorDirective(profile: MentorProfile) {
  return [
    REASONING_FIRST_TUTOR_GUARDRAIL,
    "Act as a world-class private school tutor, not a static chatbot.",
    `Detected intent: ${profile.intent}. Student level: ${profile.level}. Emotional state: ${profile.emotion}.`,
    `Use this style: ${profile.answerStyle}. Learning speed: ${profile.speed}.`,
    `Next move: ${profile.nextMove}.`,
    "Adapt every follow-up using the conversation context. If the student seems confused, simplify and ask one small check question.",
    "If exam intent is detected, include scoring points, common traps, and time-saving structure.",
    "If curiosity is high, add one real-world connection after the core answer.",
    "End with one useful next step, not generic motivation.",
  ].join(" ");
}

function getHistoryStorageKey(userId?: string) {
  return `agentify-study-history-${userId || "guest"}`;
}

function createConversationId() {
  return `study-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function titleFromMessages(messages: CoachMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === "user")?.content.trim();
  if (!firstUserMessage) return "New study conversation";
  return firstUserMessage.length > 54 ? `${firstUserMessage.slice(0, 54)}...` : firstUserMessage;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeServerMessage(value: unknown): CoachMessage | null {
  if (!isPlainRecord(value)) return null;
  const role = value.role === "user" ? "user" : value.role === "coach" ? "coach" : null;
  if (!role) return null;
  return {
    role,
    content: String(value.content || ""),
    timestamp: String(value.timestamp || ""),
    ...(Array.isArray(value.blocks) ? { blocks: value.blocks as AdaptiveAnswerBlock[] } : {}),
    ...(isPlainRecord(value.sources) ? { sources: value.sources as unknown as CoachSources } : {}),
    ...(typeof value.socratic === "boolean" ? { socratic: value.socratic } : {}),
  };
}

function normalizeServerConversation(value: unknown): StudyConversation | null {
  if (!isPlainRecord(value)) return null;
  const id = String(value.id || "").trim();
  if (!id) return null;
  const messages = Array.isArray(value.messages)
    ? value.messages.map(normalizeServerMessage).filter((message): message is CoachMessage => Boolean(message))
    : [];
  return {
    id,
    sessionId: String(value.sessionId || ""),
    title: String(value.title || "New study conversation").slice(0, 72),
    updatedAt: String(value.updatedAt || new Date().toISOString()),
    chapter: String(value.chapter || "Open tutor"),
    topic: String(value.topic || "Any subject"),
    messages,
    pinned: Boolean(value.pinned),
    archived: Boolean(value.archived),
    titleLocked: Boolean(value.titleLocked),
  };
}

function mergeConversations(primary: StudyConversation[], secondary: StudyConversation[]) {
  const seen = new Set<string>();
  const merged: StudyConversation[] = [];
  for (const conversation of [...primary, ...secondary]) {
    if (!conversation?.id || seen.has(conversation.id)) continue;
    seen.add(conversation.id);
    merged.push(conversation);
  }
  return merged
    .sort((left, right) => {
      const pinnedDelta = Number(Boolean(right.pinned)) - Number(Boolean(left.pinned));
      if (pinnedDelta) return pinnedDelta;
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    })
    .slice(0, 40);
}

function getConversationDeleteKeys(conversation: Pick<StudyConversation, "id" | "sessionId">) {
  return [conversation.id, conversation.sessionId].filter((value): value is string => Boolean(value));
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as Window & typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
}

function getArtifactByType(response: StudyArtifactResponse | null, type: ArtifactType) {
  return response?.artifacts.find((artifact) => artifact.type === type) || null;
}

function artifactHasContent(artifact: StudyArtifact | null) {
  if (!artifact) return false;
  if (artifact.type === "concept_map") return Boolean(artifact.nodes?.length);
  if (artifact.type === "flip_cards") return Boolean(artifact.cards?.length);
  if (artifact.type === "formula_lab") return Boolean(artifact.formulas?.length);
  if (artifact.type === "mistake_cards") return Boolean(artifact.mistakes?.length);
  return false;
}

function firstArtifactTab(response: StudyArtifactResponse | null): ArtifactType {
  return ARTIFACT_TABS.find((tab) => artifactHasContent(getArtifactByType(response, tab.id)))?.id || "flip_cards";
}

function cleanSpeechText(value: string) {
  return value
    .replace(/[#*_`>-]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 900)
    .trim();
}

function resolveTutorVoice() {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const preferred = [
    "Google UK English Female",
    "Google US English",
    "Microsoft Zira",
    "Microsoft Hazel",
    "Samantha",
  ];
  for (const name of preferred) {
    const match = voices.find((voice) => voice.name.includes(name));
    if (match) return match;
  }
  return voices.find((voice) => voice.lang.startsWith("en")) || voices[0] || null;
}

function speakTutorResponse(value: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const speechText = cleanSpeechText(value);
  if (!speechText) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(speechText);
  const voice = resolveTutorVoice();
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || "en-IN";
  utterance.rate = 0.94;
  utterance.pitch = 1.02;
  utterance.volume = 0.92;
  window.speechSynthesis.speak(utterance);
}

function createStages(): AgentStageState[] {
  return [
    {
      id: "received",
      agent: "Coach",
      title: "Understanding your question",
      detail: "Preparing the right learning route.",
      status: "pending",
    },
    {
      id: "understanding",
      agent: "Coach",
      title: "Checking context",
      detail: "Using your recent lesson context when it helps.",
      status: "pending",
    },
    {
      id: "drafting",
      agent: "Coach",
      title: "Preparing your answer",
      detail: "Building a clear explanation for your question.",
      status: "pending",
    },
    {
      id: "reviewing",
      agent: "Coach",
      title: "Verifying the answer",
      detail: "Checking clarity, accuracy, and the teaching level.",
      status: "pending",
    },
    {
      id: "formatting",
      agent: "Coach",
      title: "Writing your answer",
      detail: "Streaming the response in a clean study format.",
      status: "pending",
    },
    {
      id: "delivering",
      agent: "Coach",
      title: "Finishing",
      detail: "Finalizing your response.",
      status: "pending",
    },
  ];
}

function applyStageUpdate(stages: AgentStageState[], update: AgentStagePayload) {
  const activeIndex = STAGE_ORDER.indexOf(update.stage);

  return stages.map((stage) => {
    const stageIndex = STAGE_ORDER.indexOf(stage.id);
    let status = stage.status;

    if (update.status === "active") {
      if (stageIndex < activeIndex) status = "done";
      if (stageIndex === activeIndex) status = "active";
      if (stageIndex > activeIndex) status = "pending";
    } else if (stage.id === update.stage) {
      status = update.status;
    }

    return {
      ...stage,
      status,
      agent: stage.id === update.stage && update.agent ? update.agent : stage.agent,
      title: stage.id === update.stage && update.title ? update.title : stage.title,
      detail: stage.id === update.stage && update.detail ? update.detail : stage.detail,
    };
  });
}

function stripDataPrefix(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^data:\s?/i, "").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function looksLikeBase64(value: string) {
  const compact = value.trim().replace(/\s/g, "");
  return compact.length > 40 && compact.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(compact);
}

function decodeBase64Utf8(value: string) {
  const binary = window.atob(value.trim().replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function parseStagePayload(value: string): AgentStagePayload | null {
  const payload = stripDataPrefix(value);
  if (!payload.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(payload) as Partial<AgentStagePayload>;
    if (
      parsed.type === "agent_stage" &&
      parsed.stage &&
      parsed.status &&
      STAGE_ORDER.includes(parsed.stage) &&
      ["pending", "active", "done"].includes(parsed.status)
    ) {
      return parsed as AgentStagePayload;
    }
  } catch {
    return null;
  }

  return null;
}

function parseAnswerDeltaPayload(value: string): AnswerDeltaPayload | null {
  const payload = stripDataPrefix(value);
  if (!payload.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(payload) as Partial<AnswerDeltaPayload>;
    if (parsed.type === "answer_delta" && typeof parsed.delta === "string") {
      return parsed as AnswerDeltaPayload;
    }
  } catch {
    return null;
  }

  return null;
}

function parseTurnEventPayload(value: string): TurnEventPayload | null {
  const payload = stripDataPrefix(value);
  if (!payload.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(payload) as Partial<TurnEventPayload>;
    if (parsed.type === "turn_event" && typeof parsed.event === "string") {
      return parsed as TurnEventPayload;
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeAnswerPayload(value: string) {
  const payload = stripDataPrefix(value);
  if (!payload || payload === "[DONE]" || payload.startsWith("{")) return "";

  if (looksLikeBase64(payload)) {
    try {
      return decodeBase64Utf8(payload);
    } catch {
      return payload;
    }
  }

  return payload;
}

function renderInlineChemistry(value: string) {
  return tokenizeStudyText(value).map((part, index) => {
    if (part.kind === "hybridization") {
      return (
        <span key={index} className="study-formula-token">
          sp<sup>{part.superscript}</sup>
        </span>
      );
    }

    if (part.kind === "variable_power") {
      return (
        <span key={index} className="study-formula-token">
          {part.value}<sup>{part.superscript}</sup>
        </span>
      );
    }

    if (part.kind === "text") {
      return <span key={index}>{part.value}</span>;
    }

    return (
      <span key={index} className="study-formula-token">
        {part.atoms.map((atom, atomIndex) => (
          <span key={`${index}-${atomIndex}`}>
            {atom.symbol}
            {atom.subscript ? <sub>{atom.subscript}</sub> : null}
          </span>
        ))}
        {part.superscript ? <sup>{part.superscript}</sup> : null}
      </span>
    );
  });
}

function readableArtifactText(value?: string) {
  if (!value) return "";
  const normalized = normalizeSubscriptGlyphs(value).replace(/\s+/g, " ").trim();
  const letters = normalized.match(/[A-Za-z]/g) || [];
  const uppercaseLetters = letters.filter((letter) => letter === letter.toUpperCase() && letter !== letter.toLowerCase()).length;
  const lowercaseLetters = letters.length - uppercaseLetters;
  const readsLikeShouting = letters.length > 3 && uppercaseLetters > lowercaseLetters * 1.7;
  const preservedAcronyms = new Set(["DNA", "RNA", "ATP", "IUPAC", "MCQ"]);

  if (readsLikeShouting) {
    const softened = normalized.replace(/\b[A-Z][A-Z-]{1,}\b/g, (word) => {
      if (preservedAcronyms.has(word)) return word;
      return word.toLowerCase();
    });

    return softened.replace(/(^|[.!?]\s+)([a-z])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
  }

  if (
    normalized.length > 3 &&
    !/[a-z]/.test(normalized) &&
    /[A-Z]/.test(normalized) &&
    !/[0-9=]/.test(normalized)
  ) {
    const lowered = normalized.toLowerCase();
    return lowered.replace(/(^|[.!?]\s+)([a-z])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
  }

  return normalized;
}

function CoachAnswer({
  value,
  streaming = false,
  adaptiveBlocks = [],
}: {
  value: string;
  streaming?: boolean;
  adaptiveBlocks?: AdaptiveAnswerBlock[];
}) {
  const blocks = adaptiveBlocks.length
    ? adaptiveBlocks.map((block) => ({
        kind: block.kind || "explanation",
        title: String(block.title || "").trim(),
        lines: String(block.content || "").split("\n").map((line) => line.trim()).filter(Boolean),
      }))
    : value.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean).map((block) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        const firstLine = lines[0] || "";
        const markdownHeading = firstLine.match(/^#{1,6}\s+(.*)$/);
        const heading = markdownHeading
          ? markdownHeading[1]
          : firstLine.endsWith(":") && firstLine.length <= 72
            ? firstLine.replace(/:$/, "")
            : "";

        return {
          kind: "explanation",
          title: heading,
          lines: heading ? lines.slice(1) : lines,
        };
      });

  if (!blocks.length) return null;

  return (
    <div className="study-answer-flow">
      {blocks.map((block, blockIndex) => {
        const heading = block.title;
        const body = block.lines;

        return (
          <section key={`${heading || "answer"}-${blockIndex}`} className={`study-answer-text-block is-${block.kind}`}>
            {heading ? (
              <h3 className="study-answer-heading">{heading}</h3>
            ) : null}
            <div className="study-answer-body">
              {body.map((line, lineIndex) => {
                const bullet = line.match(/^[-*]\s+(.*)$/);
                const isLastLine = streaming && blockIndex === blocks.length - 1 && lineIndex === body.length - 1;
                if (bullet) {
                  return (
                    <div key={lineIndex} className="study-answer-list-item">
                      <span aria-hidden="true">-</span>
                      <p className="min-w-0">
                        {renderInlineChemistry(bullet[1].replace(/^#{1,6}\s+/, ""))}
                        {isLastLine ? <span className="study-stream-cursor" aria-hidden="true" /> : null}
                      </p>
                    </div>
                  );
                }
                return (
                  <p key={lineIndex}>
                    {renderInlineChemistry(line.replace(/^#{1,6}\s+/, ""))}
                    {isLastLine ? <span className="study-stream-cursor" aria-hidden="true" /> : null}
                  </p>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ArtifactLoadingState() {
  return (
    <div className="study-artifact-loading" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="study-mini-pulse" />
        <div>
          <p className="text-sm font-semibold text-slate-900">Building interactive study tools</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Preparing tap-to-reveal cards and mistake checks from your chapter.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3">
        <span className="polished-skeleton h-3 w-5/6 rounded-full" />
        <span className="polished-skeleton h-3 w-2/3 rounded-full" />
        <span className="polished-skeleton h-24 rounded-[1.4rem]" />
      </div>
    </div>
  );
}

function RevisionLoadingState({ title }: { title: string }) {
  return (
    <div className="study-artifact-loading" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="study-mini-pulse" />
        <div>
          <p className="text-sm font-semibold text-slate-900">Preparing {title.toLowerCase()}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Turning the selected topic into clean, readable revision notes.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3">
        <span className="polished-skeleton h-3 w-5/6 rounded-full" />
        <span className="polished-skeleton h-3 w-3/4 rounded-full" />
        <span className="polished-skeleton h-3 w-2/3 rounded-full" />
        <span className="polished-skeleton h-20 rounded-[1.4rem]" />
      </div>
    </div>
  );
}

function ConceptMapArtifact({ artifact }: { artifact: StudyArtifact }) {
  const nodes = artifact.nodes || [];
  const core = nodes.find((node) => node.kind === "core") || nodes[0];
  const relatedNodes = nodes.filter((node) => node.id !== core?.id);
  const edges = artifact.edges || [];

  if (!core) {
    return <ArtifactEmptyNote detail={artifact.empty_note || "Concept map data is not available for this topic yet."} />;
  }

  return (
    <div className="study-concept-map">
      <div className="study-concept-stage">
        <div className="study-concept-core">
          <span className="agentify-muted-label">Core idea</span>
          <h3>{renderInlineChemistry(readableArtifactText(core.label))}</h3>
          {core.description ? <p>{renderInlineChemistry(readableArtifactText(core.description))}</p> : null}
        </div>
        <div className="study-concept-node-grid">
          {relatedNodes.map((node, index) => (
            <article key={node.id} className={`study-concept-node is-${node.kind || "property"}`}>
              <div className="study-node-topline">
                <span className="study-node-kind">{readableArtifactText(node.kind || "link")}</span>
                <span className="study-node-index">{String(index + 1).padStart(2, "0")}</span>
              </div>
              <h4>{renderInlineChemistry(readableArtifactText(node.label))}</h4>
              {node.description ? <p>{renderInlineChemistry(readableArtifactText(node.description))}</p> : null}
            </article>
          ))}
        </div>
      </div>
      {edges.length ? (
        <div className="study-artifact-routes">
          {edges.slice(0, 4).map((edge, index) => (
            <span key={`${edge.from}-${edge.to}-${index}`}>
              {renderInlineChemistry(edge.label || "connects")}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FlipCardsArtifact({ artifact }: { artifact: StudyArtifact }) {
  const [openCards, setOpenCards] = useState<Record<number, boolean>>({});
  const cards = artifact.cards || [];
  const openedCount = Object.values(openCards).filter(Boolean).length;
  const progress = cards.length ? Math.round((openedCount / cards.length) * 100) : 0;

  if (!cards.length) {
    return <ArtifactEmptyNote detail={artifact.empty_note || "No flash cards are available for this topic yet."} />;
  }

  return (
    <div className="study-flip-deck">
      <div className="study-artifact-progress">
        <div>
          <span className="agentify-muted-label">Recall deck</span>
          <strong>{openedCount}/{cards.length} revealed</strong>
        </div>
        <div className="study-artifact-progress-bar" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="study-flip-grid">
        {cards.map((card, index) => {
          const open = Boolean(openCards[index]);
          return (
            <button
              key={`${card.front}-${index}`}
              type="button"
              aria-pressed={open}
              onClick={() => setOpenCards((current) => ({ ...current, [index]: !current[index] }))}
              className={`study-flip-card ${open ? "is-open" : ""}`}
            >
            <span className="study-flip-card-head">
                <span className="study-flip-tag">{readableArtifactText(card.tag || "recall")}</span>
                <span>{index + 1}/{cards.length}</span>
              </span>
              <span className="study-flip-front">{renderInlineChemistry(readableArtifactText(card.front))}</span>
              <span className="study-flip-back">{renderInlineChemistry(readableArtifactText(open ? card.back : "Tap to reveal the answer"))}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FormulaLabArtifact({ artifact }: { artifact: StudyArtifact }) {
  const [mass, setMass] = useState("");
  const [volume, setVolume] = useState("");
  const formulas = artifact.formulas || [];
  const densityFormula = formulas.find((formula) => /density/i.test(formula.formula) && /mass/i.test(formula.formula) && /volume/i.test(formula.formula));
  const massValue = Number(mass);
  const volumeValue = Number(volume);
  const densityValue = Number.isFinite(massValue) && Number.isFinite(volumeValue) && volumeValue > 0 ? massValue / volumeValue : null;

  if (!formulas.length) {
    return <ArtifactEmptyNote detail={artifact.empty_note || "This topic does not need a formula lab yet."} />;
  }

  return (
    <div className="study-formula-lab">
      <div className="study-formula-lab-head">
        <span className="study-artifact-icon">
          <AppIcon name="analytics" />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900">Formula board</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Scan the pattern, variables, and shortcut hint before using the calculator.</p>
        </div>
      </div>
      <div className="study-formula-grid">
        {formulas.map((formula, index) => (
          <article key={`${formula.formula}-${index}`} className="study-formula-card">
            <div className="flex items-start justify-between gap-3">
              <span className="agentify-muted-label">{renderInlineChemistry(formula.label)}</span>
              <span className="study-node-index">{String(index + 1).padStart(2, "0")}</span>
            </div>
            <p className="study-formula-expression">{renderInlineChemistry(formula.formula)}</p>
            {formula.variables?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {formula.variables.map((variable) => (
                  <span key={variable} className="agentify-chip capitalize">{renderInlineChemistry(variable)}</span>
                ))}
              </div>
            ) : null}
            {formula.hint ? <p className="mt-3 text-xs leading-5 text-slate-500">{renderInlineChemistry(formula.hint)}</p> : null}
          </article>
        ))}
      </div>

      {densityFormula ? (
        <div className="study-density-mini-lab">
          <div>
            <p className="text-sm font-semibold text-slate-900">Try density once</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Enter any mass and volume to see the relationship instantly.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label>
              <span>Mass</span>
              <input value={mass} onChange={(event) => setMass(event.target.value)} inputMode="decimal" placeholder="e.g. 20" />
            </label>
            <label>
              <span>Volume</span>
              <input value={volume} onChange={(event) => setVolume(event.target.value)} inputMode="decimal" placeholder="e.g. 5" />
            </label>
            <div className="study-density-result">
              <span>Density</span>
              <strong>{densityValue === null ? "--" : densityValue.toFixed(2)}</strong>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MistakeCardsArtifact({ artifact }: { artifact: StudyArtifact }) {
  const mistakes = artifact.mistakes || [];

  if (!mistakes.length) {
    return <ArtifactEmptyNote detail={artifact.empty_note || "No mistake cards are available for this topic yet."} />;
  }

  return (
    <div className="study-mistake-stack">
      <div className="study-mistake-banner">
        <span className="study-artifact-icon">
          <AppIcon name="check" />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900">Mistake shield</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">These are the traps to check before an exam answer is final.</p>
        </div>
      </div>
      <div className="study-mistake-list">
        {mistakes.map((item, index) => (
          <article key={`${item.mistake}-${index}`} className="study-mistake-card">
            <div className="flex items-start justify-between gap-3">
              <span className="agentify-muted-label">Trap {index + 1}</span>
              {item.frequency ? <span className="study-frequency-chip">{item.frequency}</span> : null}
            </div>
            <p className="mt-3 font-semibold leading-6 text-slate-900">{renderInlineChemistry(readableArtifactText(item.mistake))}</p>
            <div className="mt-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/8 p-3 text-sm leading-6 text-slate-600">
              <span className="font-bold text-emerald-700">Correct idea: </span>
              {renderInlineChemistry(readableArtifactText(item.correction))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ArtifactEmptyNote({ detail }: { detail: string }) {
  return (
    <div className="study-artifact-empty">
      <AppIcon name="book" className="h-5 w-5" />
      <p>{detail}</p>
    </div>
  );
}

function ArtifactViewer({
  response,
  activeTab,
  onTabChange,
}: {
  response: StudyArtifactResponse;
  activeTab: ArtifactType;
  onTabChange: (tab: ArtifactType) => void;
}) {
  const availableTabs = ARTIFACT_TABS.filter((tab) => getArtifactByType(response, tab.id));
  const selectedTab = availableTabs.some((tab) => tab.id === activeTab) ? activeTab : availableTabs[0]?.id || "flip_cards";
  const artifact = getArtifactByType(response, selectedTab);
  const cardCount = getArtifactByType(response, "flip_cards")?.cards?.length || 0;
  const mistakeCount = getArtifactByType(response, "mistake_cards")?.mistakes?.length || 0;
  const activeLabel = ARTIFACT_TABS.find((tab) => tab.id === selectedTab)?.label || "Study tool";

  if (!artifact) {
    return <ArtifactEmptyNote detail="Study tools could not be prepared for this topic." />;
  }

  return (
    <div className="study-artifact-viewer">
      <aside className="study-artifact-brief">
        <div className="study-artifact-brief-head">
          <span className="study-artifact-icon">
            <AppIcon name="spark" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold capitalize tracking-normal text-slate-500">{readableArtifactText(response.source.replace("_", " "))}</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-950">{renderInlineChemistry(readableArtifactText(response.title))}</h3>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-500">
          Use these interactive tools to remember the idea, then check common mistakes before exams.
        </p>
        <div className="study-artifact-metrics">
          <span>
            <strong>{cardCount}</strong>
            <small>recall cards</small>
          </span>
          <span>
            <strong>{mistakeCount}</strong>
            <small>mistake checks</small>
          </span>
        </div>
        <div className="study-artifact-checklist" aria-label="Study tool quality signals">
          <span><AppIcon name="check" /> Tap cards to reveal answers</span>
          <span><AppIcon name="check" /> Check common exam mistakes</span>
        </div>
      </aside>

      <div className="study-artifact-tabs" role="tablist" aria-label="Interactive study tool views">
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selectedTab === tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`study-artifact-tab ${selectedTab === tab.id ? "is-active" : ""}`}
          >
            <AppIcon name={tab.icon} className="h-3.5 w-3.5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <section className="study-artifact-stage">
        <div className="mb-4">
          <p className="agentify-label">{activeLabel} workspace</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-950">{renderInlineChemistry(readableArtifactText(artifact.title))}</h3>
          {artifact.subtitle ? <p className="mt-1 text-sm leading-6 text-slate-500">{renderInlineChemistry(readableArtifactText(artifact.subtitle))}</p> : null}
        </div>
        {artifact.type === "concept_map" ? <ConceptMapArtifact artifact={artifact} /> : null}
        {artifact.type === "flip_cards" ? <FlipCardsArtifact artifact={artifact} /> : null}
        {artifact.type === "formula_lab" ? <FormulaLabArtifact artifact={artifact} /> : null}
        {artifact.type === "mistake_cards" ? <MistakeCardsArtifact artifact={artifact} /> : null}
      </section>
    </div>
  );
}

function InlineAgentActivity({ stages, compact }: { stages: AgentStageState[]; compact: boolean }) {
  const activeStage =
    stages.find((stage) => stage.status === "active") ||
    stages.find((stage) => stage.status === "pending") ||
    stages[stages.length - 1];
  const completedCount = stages.filter((stage) => stage.status === "done").length;
  const isComplete = completedCount === stages.length;

  return (
    <div className="study-inline-activity" aria-live="polite">
      <span className={`study-mini-pulse ${isComplete ? "is-complete" : ""}`} />
      <span className="min-w-0">
        <span className="study-inline-activity-line">
          {isComplete ? "Answer ready" : activeStage.title}
        </span>
        {!compact && !isComplete ? <span className="study-inline-activity-detail">{activeStage.detail}</span> : null}
      </span>
    </div>
  );
}

function StarterPromptCard({
  label,
  title,
  detail,
  onClick,
}: {
  label: string;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={detail}
      className="study-starter-chip group inline-flex min-h-10 items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-2.5 text-left text-sm font-bold text-slate-700 shadow-[0_14px_36px_rgba(15,23,42,0.05)] transition duration-300 hover:-translate-y-0.5 hover:border-[#0E7490]/28 hover:bg-white hover:text-[#0E7490] hover:shadow-[0_22px_54px_rgba(14,116,144,0.11)]"
    >
      <span className="rounded-xl bg-[#0E7490]/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#0E7490]">{label}</span>
      <span>{title}</span>
    </button>
  );
}

function AttachmentChips({ attachments, onRemove }: { attachments: DisplayAttachment[]; onRemove?: (name: string) => void }) {
  if (!attachments.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <span key={`${attachment.name}-${attachment.size_bytes}`} className="study-attachment-chip">
          <AppIcon name="plus" className="h-3 w-3" />
          <span className="max-w-48 truncate">{attachment.name}</span>
          {onRemove ? (
            <button type="button" onClick={() => onRemove(attachment.name)} aria-label={`Remove ${attachment.name}`}>
              <AppIcon name="x" className="h-3 w-3" />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function StudentPromptCard({
  content,
  timestamp,
  attachments = [],
  onEdit,
}: {
  content: string;
  timestamp: string;
  attachments?: DisplayAttachment[];
  onEdit: () => void;
}) {
  return (
    <div className="flex justify-end">
      <article className="study-user-message max-w-[760px] rounded-[1.55rem] rounded-tr-md bg-[linear-gradient(135deg,#0F172A,#0E7490)] px-5 py-4 text-white shadow-[0_20px_54px_rgba(14,116,144,0.20)]">
        <div className="study-user-message-meta mb-2 flex items-center justify-end gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/66">
          <span>You</span>
          {timestamp ? <span>{timestamp}</span> : null}
        </div>
        <p className="whitespace-pre-wrap text-[15px] leading-7 text-white/95">{content}</p>
        {attachments.length ? <div className="mt-3"><AttachmentChips attachments={attachments} /></div> : null}
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={onEdit} className="text-xs font-semibold text-white/70 transition hover:text-white">
            Edit and retry
          </button>
        </div>
      </article>
    </div>
  );
}

function SourceDrawer({ sources }: { sources?: CoachSources }) {
  if (!sources) return null;
  if (!sources.grounded || !sources.citations?.length) {
    return sources.indicator ? (
      <div className="study-source-note mb-4">
        <span>{sources.indicator}</span>
      </div>
    ) : null;
  }

  return (
    <details className="study-source-drawer mb-4">
      <summary>
        <span className="study-source-indicator">{sources.indicator || "Based on your notes"}</span>
        <span>{sources.citations.length} source{sources.citations.length === 1 ? "" : "s"}</span>
      </summary>
      <div className="study-source-list">
        {sources.citations.map((source) => (
          <article key={source.id}>
            <p>{source.label}</p>
            <span>{source.source}{source.section_id ? ` / ${source.section_id}` : ""}</span>
            {source.excerpt ? <small>{source.excerpt}</small> : null}
          </article>
        ))}
      </div>
    </details>
  );
}

function TutorActionDock({
  answer,
  canRegenerate,
  onPrompt,
  onRegenerate,
  onDirectAnswer,
}: {
  answer: string;
  canRegenerate: boolean;
  onPrompt: (prompt: string) => void;
  onRegenerate: () => void;
  onDirectAnswer?: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const primaryActions = [
    {
      label: "Simplify",
      prompt: "Explain the previous answer more simply, like I am learning it for the first time.",
    },
    {
      label: "Practice",
      prompt: "Ask me one practice question from the concept we just discussed, wait for my answer, then evaluate it.",
    },
    {
      label: "Exam answer",
      prompt: "Turn the previous answer into an exam-ready answer with marks-style structure.",
    },
  ];
  const secondaryActions = [
    {
      label: "Example",
      prompt: "Give me one real-life example connected to the concept we just discussed, step by step.",
    },
    {
      label: "Mistake check",
      prompt: "What mistake might I make in this concept, and how do I avoid it?",
    },
  ];
  const download = () => {
    const blob = new Blob([answer], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "agentifyai-study-notes.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-6 border-t border-slate-200/80 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        {primaryActions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => onPrompt(action.prompt)}
            className="rounded-full border border-slate-200 bg-white/78 px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:-translate-y-0.5 hover:border-[#0E7490]/30 hover:text-[#0E7490] hover:shadow-[0_12px_32px_rgba(14,116,144,0.10)]"
          >
            {action.label}
          </button>
        ))}
        {onDirectAnswer ? (
          <button type="button" onClick={onDirectAnswer} className="rounded-full border border-[#0E7490]/25 bg-[#0E7490]/8 px-3.5 py-2 text-xs font-bold text-[#0E7490] transition hover:bg-[#0E7490]/14">
            Direct answer
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setMoreOpen((current) => !current)}
          aria-expanded={moreOpen}
          className="rounded-full border border-slate-200 bg-white/70 px-3.5 py-2 text-xs font-bold text-slate-500 transition hover:border-[#0E7490]/30 hover:text-[#0E7490]"
        >
          More
        </button>
      </div>
      {moreOpen ? (
        <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/70 bg-white/62 p-2 shadow-[0_18px_42px_rgba(15,23,42,0.06)] backdrop-blur-xl">
          {secondaryActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => {
                setMoreOpen(false);
                onPrompt(action.prompt);
              }}
              className="rounded-full border border-slate-200/80 bg-white/56 px-3.5 py-2 text-xs font-semibold text-slate-500 transition hover:border-[#0E7490]/25 hover:text-[#0E7490]"
            >
              {action.label}
            </button>
          ))}
          {canRegenerate ? (
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                onRegenerate();
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/56 px-3.5 py-2 text-xs font-semibold text-slate-500 transition hover:border-[#0E7490]/25 hover:text-[#0E7490]"
            >
              <AppIcon name="spark" className="h-3.5 w-3.5" />
              <span>Regenerate</span>
            </button>
          ) : null}
          <CopyButton value={answer} />
          <button type="button" onClick={download} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/56 px-3.5 py-2 text-xs font-semibold text-slate-500 transition hover:border-[#0E7490]/25 hover:text-[#0E7490]">
            <AppIcon name="download" className="h-3.5 w-3.5" />
            <span>Download notes</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TutorResponseCard({
  coachName,
  content,
  blocks,
  timestamp,
  topicLabel,
  stages,
  showActivity,
  activityCollapsed,
  streaming,
  canRegenerate,
  onPrompt,
  onRegenerate,
  onDirectAnswer,
  sources,
  socratic,
}: {
  coachName: string;
  content: string;
  blocks?: AdaptiveAnswerBlock[];
  timestamp: string;
  topicLabel: string;
  stages: AgentStageState[];
  showActivity: boolean;
  activityCollapsed: boolean;
  streaming: boolean;
  canRegenerate: boolean;
  onPrompt: (prompt: string) => void;
  onRegenerate: () => void;
  onDirectAnswer: () => void;
  sources?: CoachSources;
  socratic?: boolean;
}) {
  const pending = !content.trim();
  const showDeliveryLogo = pending || streaming;

  return (
    <div className="flex justify-start">
      <div className="study-message-row study-message-row-complete grid w-full grid-cols-1">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
            <p className="font-semibold text-slate-950">{coachName}</p>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-emerald-600">
              Tutor
            </span>
            <span className="rounded-full border border-slate-200/70 bg-white/58 px-2.5 py-1 text-[10px] font-bold text-slate-500">
              {topicLabel}
            </span>
            {timestamp ? <span className="text-xs font-medium text-slate-400">{timestamp}</span> : null}
          </div>

          <article className="study-tutor-response px-1 py-2 sm:px-2">
            {showActivity ? (
              <div className={pending ? "" : "mb-3"}>
                <InlineAgentActivity stages={stages} compact={activityCollapsed && !pending} />
              </div>
            ) : null}

            {showDeliveryLogo ? (
              <div className={`study-response-status ${pending ? "is-pending" : "is-streaming"}`} aria-live="polite">
                <ChatThinkingLogo
                  state={pending ? "thinking" : "streaming"}
                  size={pending ? 76 : 68}
                  className="study-response-status-logo"
                  label=""
                />
                <span className="study-response-status-copy">
                  <span className="study-response-status-title">
                    {pending ? `${coachName} is preparing your answer` : `${coachName} is writing your answer`}
                  </span>
                  <span className="study-response-status-detail">
                    {pending ? "Preparing the right learning route." : "Delivering the answer with your selected study context."}
                  </span>
                </span>
              </div>
            ) : null}

            {pending ? (
              <div className="study-stream-placeholder" />
            ) : (
              <>
                <SourceDrawer sources={sources} />
                <div className="study-answer-stream">
                  <CoachAnswer value={content} streaming={streaming} adaptiveBlocks={blocks} />
                </div>
                {!streaming ? (
                  <TutorActionDock
                    answer={content}
                    canRegenerate={canRegenerate}
                    onPrompt={onPrompt}
                    onRegenerate={onRegenerate}
                    onDirectAnswer={socratic ? onDirectAnswer : undefined}
                  />
                ) : null}
              </>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  label,
  detail,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  detail: string;
  icon: AppIconName;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-active={active ? "true" : "false"}
      onClick={onClick}
      title={detail}
      className="study-mode-button"
    >
      <span className="study-mode-icon">
        <AppIcon name={icon} className="h-3.5 w-3.5" />
      </span>
      <span>{label}</span>
    </button>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!value}
      title={copied ? "Copied" : "Copy to clipboard"}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/75 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-[#0E7490]/30 hover:text-[#0E7490] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <AppIcon name={copied ? "check" : "copy"} className="h-3.5 w-3.5" />
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

function getTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function clampStudyMetric(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("File could not be read."));
    reader.readAsDataURL(file);
  });
}

function getRelativeConversationTime(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return days < 7 ? `${days}d` : `${Math.round(days / 7)}w`;
}

function CoachHistorySidebar({
  conversations,
  currentConversationId,
  search,
  onSearchChange,
  onSelect,
  onNewChat,
  onCollapse,
  showArchived,
  onToggleArchived,
  onClearHistory,
  canClearHistory,
  onRename,
  onPin,
  onArchive,
  onDelete,
}: {
  conversations: StudyConversation[];
  currentConversationId: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (conversation: StudyConversation) => void;
  onNewChat: () => void;
  onCollapse: () => void;
  showArchived: boolean;
  onToggleArchived: () => void;
  onClearHistory: () => void;
  canClearHistory: boolean;
  onRename: (conversation: StudyConversation) => void;
  onPin: (conversation: StudyConversation) => void;
  onArchive: (conversation: StudyConversation) => void;
  onDelete: (conversation: StudyConversation) => void;
}) {
  return (
    <aside className="study-coach-sidebar flex min-h-0 shrink-0 flex-col" aria-label="Tutor chat history">
      <div className="study-sidebar-toolbar flex items-center justify-between gap-3">
        <p>Chat history</p>
        <button type="button" className="study-sidebar-icon" onClick={onCollapse} title="Hide history sidebar" aria-label="Hide history sidebar">
          <AppIcon name="panelLeft" />
        </button>
      </div>

      <div className="mt-3 grid gap-1.5">
        <button type="button" onClick={onNewChat} className="study-sidebar-action">
          <AppIcon name="plus" />
          <span>New chat</span>
        </button>
        <label className="study-sidebar-search">
          <AppIcon name="search" />
          <span className="sr-only">Search conversations</span>
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search" />
        </label>
      </div>

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 px-2">
          <p className="study-sidebar-section-label !px-0">{showArchived ? "Archived chats" : "Chats"}</p>
          <button type="button" onClick={onToggleArchived} className="text-[11px] font-semibold text-slate-400 transition hover:text-[#0E7490]">
            {showArchived ? "Back" : "Archived"}
          </button>
        </div>
        <div className="study-sidebar-conversations mt-2 min-h-0 flex-1 overflow-y-auto">
          {conversations.length ? conversations.map((conversation) => (
            <div key={conversation.id} className={`study-sidebar-thread-row ${conversation.id === currentConversationId ? "is-active" : ""}`}>
              <button
                type="button"
                onClick={() => onSelect(conversation)}
                className="study-sidebar-thread"
                title={conversation.title}
              >
                <span className="truncate">{conversation.pinned ? "Pinned / " : ""}{conversation.title}</span>
                <small>{getRelativeConversationTime(conversation.updatedAt)}</small>
              </button>
              <details className="study-sidebar-thread-menu">
                <summary aria-label={`Manage ${conversation.title}`}>...</summary>
                <div>
                  <button type="button" onClick={() => onRename(conversation)}>Rename</button>
                  <button type="button" onClick={() => onPin(conversation)}>{conversation.pinned ? "Unpin" : "Pin"}</button>
                  <button type="button" onClick={() => onArchive(conversation)}>{conversation.archived ? "Restore" : "Archive"}</button>
                  <button type="button" className="is-danger" onClick={() => onDelete(conversation)}>Delete</button>
                </div>
              </details>
            </div>
          )) : (
            <p className="study-sidebar-empty">{search ? "No matching chats" : showArchived ? "No archived chats." : "Your study chats will appear here."}</p>
          )}
        </div>
      </div>

      <div className="study-sidebar-footer">
        <div className="study-sidebar-memory">
          <AppIcon name="spark" />
          <div>
            <p>Lesson memory active</p>
            <span>Follow-up context stays connected</span>
          </div>
        </div>
        <button type="button" onClick={onClearHistory} disabled={!canClearHistory} className="study-sidebar-clear">
          <AppIcon name="trash" />
          <span>Clear history</span>
        </button>
      </div>
    </aside>
  );
}

export default function StudyPage() {
  const { profile, userId, authLoading, loading, getAuthHeaders } = useAuth() as ReturnType<typeof useAuth> & { authLoading?: boolean };
  const searchParams = useSearchParams();
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
  const initialTopic = searchParams.get("topic") || "alkanes";
  const initialChapter = searchParams.get("chapter") || findChapterValueForTopic(initialTopic) || "hydrocarbon";

  const [chapter, setChapter] = useState(initialChapter);
  const [topic, setTopic] = useState(initialTopic);
  const [mode, setMode] = useState<StudyMode>("coach");
  const [coachName, setCoachName] = useState("Aria");
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [conversations, setConversations] = useState<StudyConversation[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [revisionSetupOpen, setRevisionSetupOpen] = useState(true);
  const [historySearch, setHistorySearch] = useState("");
  const [showArchivedChats, setShowArchivedChats] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState(createConversationId);
  const [input, setInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [composerMenuOpen, setComposerMenuOpen] = useState(false);
  const [socraticMode, setSocraticMode] = useState(true);
  const [strictAttachmentGrounding, setStrictAttachmentGrounding] = useState(false);
  const [loadingAnswer, setLoadingAnswer] = useState(false);
  const [stages, setStages] = useState(createStages);
  const [showPipeline, setShowPipeline] = useState(false);
  const [activityCollapsed, setActivityCollapsed] = useState(false);
  const [error, setError] = useState("");
  const [revisionContent, setRevisionContent] = useState<Record<RevisionType, string>>({ summary: "", explain: "", keypoints: "" });
  const [revisionLoading, setRevisionLoading] = useState<Record<RevisionType, boolean>>({ summary: false, explain: false, keypoints: false });
  const [revisionError, setRevisionError] = useState("");
  const [artifact, setArtifact] = useState<StudyArtifactResponse | null>(null);
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [artifactError, setArtifactError] = useState("");
  const [activeArtifactTab, setActiveArtifactTab] = useState<ArtifactType>("flip_cards");
  const [activeRevisionPanel, setActiveRevisionPanel] = useState<RevisionPanel>("summary");
  const [activeExamPanel, setActiveExamPanel] = useState<ExamPanel>("mcq");
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);
  const [probableQuestions, setProbableQuestions] = useState<ProbableQuestion[]>([]);
  const [examAnswers, setExamAnswers] = useState<Record<string, string>>({});
  const [examRetryCount, setExamRetryCount] = useState(0);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [examLoading, setExamLoading] = useState(false);
  const [examSaving, setExamSaving] = useState(false);
  const [examError, setExamError] = useState("");
  const [speechSupported, setSpeechSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const composerMenuRef = useRef<HTMLDivElement>(null);
  const composerMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const composerFirstActionRef = useRef<HTMLButtonElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const activityCollapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activityCollapseScheduledRef = useRef(false);
  const revisionCacheRef = useRef(new Map<string, string>());
  const artifactCacheRef = useRef(new Map<string, StudyArtifactResponse>());
  const workspaceResetEpochRef = useRef(0);
  const deletedConversationIdsRef = useRef(new Set<string>());
  const examStartedAtRef = useRef<string | null>(null);
  const examGenerationLatencyRef = useRef(0);
  const examAnswerSelectionsRef = useRef<Record<string, string>>({});

  const authBusy = loading || authLoading;
  const selectedChapter = CHAPTERS.find((item) => item.value === chapter) || CHAPTERS[0];
  const selectedTopic = selectedChapter.topics.find((item) => item.value === topic) || selectedChapter.topics[0];
  const selectedTopicValue = selectedTopic.value;
  const revisionSelectionKey = `${selectedChapter.value}:${selectedTopicValue}`;
  const displayName = profile?.name || "Student";
  const examScore = examQuestions.reduce((score, question) => score + (examAnswers[question.id] === question.correct ? 1 : 0), 0);
  const answeredExamCount = examQuestions.filter((question) => examAnswers[question.id]).length;
  const activeRevisionTool = activeRevisionPanel === "artifact" ? null : REVISION_TOOLS.find((tool) => tool.id === activeRevisionPanel) || REVISION_TOOLS[0];
  const progressPercent = examQuestions.length ? Math.round((answeredExamCount / examQuestions.length) * 100) : 0;
  const revisionHasState = Boolean(
    revisionContent.summary
      || revisionContent.explain
      || revisionContent.keypoints
      || artifact
      || revisionError
      || artifactError
      || artifactLoading
      || Object.values(revisionLoading).some(Boolean),
  );
  const examHasState = Boolean(
    examQuestions.length
      || probableQuestions.length
      || Object.keys(examAnswers).length
      || examSubmitted
      || examLoading
      || examSaving
      || examError,
  );
  const canClearCurrentWorkspace = mode === "coach"
    ? Boolean(conversations.length || messages.length || pendingAttachments.length || loadingAnswer || error)
    : mode === "revision"
      ? revisionHasState
      : mode === "exam"
        ? examHasState
        : false;
  const filteredConversations = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (Boolean(conversation.archived) !== showArchivedChats) return false;
      const searchable = `${conversation.title} ${conversation.chapter} ${conversation.topic}`.toLowerCase();
      return !query || searchable.includes(query);
    }).sort((left, right) => Number(Boolean(right.pinned)) - Number(Boolean(left.pinned)));
  }, [conversations, historySearch, showArchivedChats]);

  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setSidebarOpen(false);
      setRevisionSetupOpen(false);
    }
  }, []);

  const starterPrompts = useMemo(
    () => [
      {
        label: "Explain",
        title: "Explain a concept",
        detail: "Get a simple explanation with one clear example.",
        prompt: "Explain matter from the basics with one simple example.",
      },
      {
        label: "Doubt",
        title: "Solve a doubt",
        detail: "Ask any confusing question and get a step-by-step answer.",
        prompt: "Why are alkenes more reactive than alkanes? Explain it simply.",
      },
      {
        label: "Practice",
        title: "Test me",
        detail: "Try one question, answer it, and get feedback.",
        prompt: "Ask me one intelligent practice question about states of matter, wait for my answer, then evaluate it.",
      },
    ],
    [],
  );

  useEffect(() => {
    if (selectedChapter.value !== chapter) {
      setChapter(selectedChapter.value);
      return;
    }
    if (selectedTopic.value !== topic) {
      setTopic(selectedTopic.value);
    }
  }, [chapter, topic, selectedChapter, selectedTopic]);

  useEffect(() => {
    if (!composerMenuOpen) return;
    const focusFrame = window.requestAnimationFrame(() => composerFirstActionRef.current?.focus());

    const handlePointerDown = (event: MouseEvent) => {
      if (!composerMenuRef.current?.contains(event.target as Node)) {
        setComposerMenuOpen(false);
      }
    };
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setComposerMenuOpen(false);
        composerMenuTriggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [composerMenuOpen]);

  useEffect(() => {
    workspaceResetEpochRef.current += 1;
    setRevisionContent({
      summary: revisionCacheRef.current.get(`${revisionSelectionKey}:summary`) || "",
      explain: revisionCacheRef.current.get(`${revisionSelectionKey}:explain`) || "",
      keypoints: revisionCacheRef.current.get(`${revisionSelectionKey}:keypoints`) || "",
    });
    setRevisionLoading({ summary: false, explain: false, keypoints: false });
    setRevisionError("");
    setArtifact(artifactCacheRef.current.get(revisionSelectionKey) || null);
    setArtifactLoading(false);
    setArtifactError("");
    setActiveArtifactTab("flip_cards");
    setExamQuestions([]);
    setProbableQuestions([]);
    setExamAnswers({});
    setExamRetryCount(0);
    setExamSubmitted(false);
    setExamLoading(false);
    setExamSaving(false);
    setExamError("");
    examStartedAtRef.current = null;
    examGenerationLatencyRef.current = 0;
    examAnswerSelectionsRef.current = {};
  }, [revisionSelectionKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, showPipeline]);

  useEffect(() => {
    return () => {
      if (activityCollapseTimerRef.current) {
        clearTimeout(activityCollapseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechRecognitionCtor()) && typeof window !== "undefined" && Boolean(window.speechSynthesis));
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.getVoices();
    const handleVoicesChanged = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
      window.speechSynthesis.cancel();
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    let localConversations: StudyConversation[] = [];
    try {
      const stored = localStorage.getItem(getHistoryStorageKey(userId));
      const parsed = stored ? JSON.parse(stored) : [];
      localConversations = Array.isArray(parsed) ? parsed.slice(0, 40) : [];
      setConversations(localConversations);
    } catch {
      setConversations([]);
    }

    if (authBusy) return;
    async function loadServerConversations() {
      try {
        const payload = await apiJson<{ conversations?: unknown[] }>(`${backendURL}/coach/conversations/${userId}`, {
          headers: await getAuthHeaders(),
          cacheKey: `coach-conversations:${userId}`,
          cacheTtlMs: 15000,
          retries: 1,
          timeoutMs: 7000,
        });
        if (!active) return;
        const serverConversations = Array.isArray(payload.conversations)
          ? payload.conversations.map(normalizeServerConversation).filter((item): item is StudyConversation => Boolean(item))
          : [];
        const deletedIds = deletedConversationIdsRef.current;
        const filteredServerConversations = serverConversations.filter((conversation) => (
          !getConversationDeleteKeys(conversation).some((key) => deletedIds.has(key))
        ));
        const filteredLocalConversations = localConversations.filter((conversation) => (
          !getConversationDeleteKeys(conversation).some((key) => deletedIds.has(key))
        ));
        const merged = mergeConversations(filteredServerConversations, filteredLocalConversations);
        setConversations(merged);
        localStorage.setItem(getHistoryStorageKey(userId), JSON.stringify(merged));
      } catch {
        // Local history remains available if the backend is still waking up.
      }
    }

    void loadServerConversations();
    return () => {
      active = false;
    };
  }, [authBusy, backendURL, getAuthHeaders, userId]);

  useEffect(() => {
    if (!userId || !messages.length) return;
    setConversations((current) => {
      const previous = current.find((item) => item.id === currentConversationId);
      const conversation: StudyConversation = {
        id: currentConversationId,
        sessionId: previous?.sessionId || `coach-${userId}-${currentConversationId}`,
        title: previous?.titleLocked ? previous.title : titleFromMessages(messages),
        updatedAt: new Date().toISOString(),
        chapter: "Open tutor",
        topic: "Any subject",
        messages,
        pinned: previous?.pinned,
        archived: previous?.archived,
        titleLocked: previous?.titleLocked,
      };
      const next = [
        conversation,
        ...current.filter((item) => item.id !== currentConversationId),
      ].slice(0, 40);
      localStorage.setItem(getHistoryStorageKey(userId), JSON.stringify(next));
      return next;
    });
  }, [currentConversationId, messages, userId]);

  useEffect(() => {
    if (!userId || authBusy) return;
    let active = true;

    async function loadCoach() {
      try {
        const data = await apiJson<{ profile?: { coach_name?: string } }>(`${backendURL}/coach/${userId}`, {
          headers: await getAuthHeaders(),
          cacheKey: `coach-profile:${userId}`,
          cacheTtlMs: 60000,
          retries: 1,
          timeoutMs: 7000,
        });
        if (!active) return;
        setCoachName(data?.profile?.coach_name || "Aria");
      } catch {
        if (active) setCoachName("Aria");
      }
    }

    void loadCoach();
    return () => {
      active = false;
    };
  }, [authBusy, backendURL, getAuthHeaders, userId]);

  const resetActivityCollapse = () => {
    if (activityCollapseTimerRef.current) {
      clearTimeout(activityCollapseTimerRef.current);
      activityCollapseTimerRef.current = null;
    }
    activityCollapseScheduledRef.current = false;
    setActivityCollapsed(false);
  };

  const scheduleActivityCollapse = () => {
    if (activityCollapseScheduledRef.current) return;
    activityCollapseScheduledRef.current = true;
    if (activityCollapseTimerRef.current) {
      clearTimeout(activityCollapseTimerRef.current);
    }
    activityCollapseTimerRef.current = setTimeout(() => {
      setActivityCollapsed(true);
      activityCollapseTimerRef.current = null;
    }, 2000);
  };

  const handleStagePayload = (payload: AgentStagePayload) => {
    setStages((current) => applyStageUpdate(current, payload));
    setShowPipeline(true);
  };

  const appendLastCoachMessage = (delta: string) => {
    setMessages((current) => {
      const next = [...current];
      const last = next[next.length - 1];
      if (last?.role === "coach") {
        next[next.length - 1] = {
          ...last,
          content: `${last.content}${delta}`,
          timestamp: getTime(),
        };
      }
      return next;
    });
  };

  const updateLastCoachMessage = (content: string, blocks?: AdaptiveAnswerBlock[], sources?: CoachSources, socratic?: boolean) => {
    setMessages((current) => {
      const next = [...current];
      const last = next[next.length - 1];
      if (last?.role === "coach") {
        next[next.length - 1] = {
          ...last,
          content,
          timestamp: getTime(),
          ...(blocks ? { blocks } : {}),
          ...(sources ? { sources } : {}),
          ...(typeof socratic === "boolean" ? { socratic } : {}),
        };
      }
      return next;
    });
  };

  const processSseEvent = (raw: string): StreamProcessResult => {
    const turnEvent = parseTurnEventPayload(raw);
    if (turnEvent) {
      if (turnEvent.event === "turn.started") {
        setShowPipeline(true);
        return { kind: "none" };
      }
      if (turnEvent.event === "answer.completed") {
        const safeAnswer = getCoachSafeAnswer(turnEvent.answer || "");
        updateLastCoachMessage(safeAnswer, turnEvent.blocks || [], turnEvent.sources, turnEvent.socratic);
        setShowPipeline(false);
        return { kind: "answer", value: safeAnswer };
      }
      return { kind: "none" };
    }

    const stagePayload = parseStagePayload(raw);
    if (stagePayload) {
      handleStagePayload(stagePayload);
      return { kind: "none" };
    }

    const deltaPayload = parseAnswerDeltaPayload(raw);
    if (deltaPayload) {
      appendLastCoachMessage(deltaPayload.delta);
      scheduleActivityCollapse();
      return { kind: "delta", value: deltaPayload.delta };
    }

    const payload = stripDataPrefix(raw);
    if (payload === "[DONE]") {
      setShowPipeline(false);
      return { kind: "none" };
    }

    const answer = normalizeAnswerPayload(raw);
    if (answer) {
      const safeAnswer = getCoachSafeAnswer(answer);
      updateLastCoachMessage(safeAnswer);
      setShowPipeline(false);
      return { kind: "answer", value: safeAnswer };
    }

    return { kind: "none" };
  };

  const sendMessage = async (override?: string, options?: { fromVoice?: boolean; replaceLastAssistant?: boolean; directAnswer?: boolean }) => {
    const typedPrompt = (override ?? input).trim();
    const prompt = typedPrompt || (pendingAttachments.length ? "Please explain the attached study material." : "");
    if (!prompt || !userId || authBusy || loadingAnswer) return;
    const attachmentsForTurn = [...pendingAttachments];
    const groundAttachmentsOnly = Boolean(strictAttachmentGrounding && attachmentsForTurn.length);
    const contextMessages =
      options?.replaceLastAssistant && messages[messages.length - 1]?.role === "coach"
        ? messages.slice(0, -1)
        : messages;
    const adaptiveProfile = inferMentorProfile(prompt, contextMessages);
    const tutorContext = buildTutorContextMessage(prompt, contextMessages);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setInput("");
    setPendingAttachments([]);
    setStrictAttachmentGrounding(false);
    setComposerMenuOpen(false);
    setError("");
    setLoadingAnswer(true);
    setShowPipeline(true);
    resetActivityCollapse();
    setStages(createStages().map((stage) => (stage.id === "received" ? { ...stage, status: "active" } : stage)));
    let finalAnswer = "";

    setMessages((current) => {
      if (options?.replaceLastAssistant && current[current.length - 1]?.role === "coach") {
        const next = [...current];
        next[next.length - 1] = { role: "coach", content: "", timestamp: "" };
        return next;
      }

      return [
        ...current,
        {
          role: "user",
          content: prompt,
          timestamp: getTime(),
          attachments: attachmentsForTurn.map(({ name, mime_type, size_bytes }) => ({ name, mime_type, size_bytes })),
        },
        { role: "coach", content: "", timestamp: "" },
      ];
    });

    try {
      const res = await apiFetch(`${backendURL}/coach/chat/stream`, {
        method: "POST",
        headers: await getAuthHeaders(),
        signal: controller.signal,
        timeoutMs: 12000,
        body: JSON.stringify({
          user_id: userId,
          message: prompt,
          original_message: prompt,
          grounding_context_prompt: tutorContext.message,
          mode: "coach",
          intent: adaptiveProfile.intent,
          session_id: `coach-${userId}-${currentConversationId}`,
          attachments: attachmentsForTurn,
          direct_answer: Boolean(options?.directAnswer),
          socratic_mode: socraticMode,
          mentor_directive: buildMentorDirective(adaptiveProfile),
          system_guardrail: REASONING_FIRST_TUTOR_GUARDRAIL,
          retrieval_required: groundAttachmentsOnly,
          strict_grounding: groundAttachmentsOnly,
          fallback_to_general_knowledge: !groundAttachmentsOnly,
          required_not_found_response: MATERIAL_NOT_FOUND_MESSAGE,
          subject: "",
          chapter: "",
          topic: "",
          section_id: "general",
          student_state: {
            knowledge_level: adaptiveProfile.level,
            emotional_state: adaptiveProfile.emotion,
            confidence: adaptiveProfile.confidence,
            learning_speed: adaptiveProfile.speed,
            curiosity_depth: adaptiveProfile.curiosityDepth,
          },
          adaptive_strategy: {
            answer_style: adaptiveProfile.answerStyle,
            next_move: adaptiveProfile.nextMove,
            should_test: adaptiveProfile.shouldTest,
            weak_signals: adaptiveProfile.weakSignals,
          },
          learning_context: {
            scope: "open_tutor_reasoning_first",
            selected_subject: "",
            selected_chapter: "",
            selected_topic: "",
            section_id: "general",
            is_follow_up: tutorContext.isFollowUp,
            previous_user_question: tutorContext.previousQuestion,
            previous_ai_answer: tutorContext.previousAnswer,
            anchor_terms: tutorContext.anchorTerms,
            recent_messages: contextMessages.slice(-10),
            saved_conversations: conversations.length,
            answer_policy: "Reason first from reliable subject knowledge, lesson memory, and conversation context. Retrieve study material when the student's question explicitly needs source-grounded verification.",
          },
        }),
      });

      if (!res.ok) throw new Error(`Coach failed: ${res.status}`);
      if (!res.body) {
        const text = normalizeAnswerPayload(await res.text());
        finalAnswer = getCoachSafeAnswer(text);
        updateLastCoachMessage(finalAnswer);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        events.forEach((event) => {
          const result = processSseEvent(event);
          if (result.kind === "answer") finalAnswer = result.value;
          if (result.kind === "delta") finalAnswer += result.value;
        });
      }

      if (buffer.trim()) {
        const result = processSseEvent(buffer);
        if (result.kind === "answer") finalAnswer = result.value;
        if (result.kind === "delta") finalAnswer += result.value;
      }

      if (isBackendFailureText(finalAnswer)) {
        finalAnswer = getCoachSafeAnswer(finalAnswer);
        updateLastCoachMessage(finalAnswer);
      }
    } catch (caught) {
      if ((caught as Error).name !== "AbortError") {
        setError("The tutor could not complete that response. Please try again.");
        finalAnswer = TUTOR_TEMPORARY_ERROR_MESSAGE;
        updateLastCoachMessage(finalAnswer);
      }
    } finally {
      setLoadingAnswer(false);
      setShowPipeline(false);
      if (options?.fromVoice && finalAnswer) speakTutorResponse(finalAnswer);
    }
  };

  const stopGenerating = () => {
    abortRef.current?.abort();
    setLoadingAnswer(false);
    setShowPipeline(false);
    resetActivityCollapse();
    setMessages((current) => {
      const next = [...current];
      const last = next[next.length - 1];
      if (last?.role === "coach" && !last.content.trim()) {
        next[next.length - 1] = {
          ...last,
          content: "Stopped. Edit your question or regenerate when you are ready.",
          timestamp: getTime(),
        };
      }
      return next;
    });
  };

  const regenerateLastAnswer = () => {
    const lastPrompt = [...messages].reverse().find((message) => message.role === "user")?.content.trim();
    if (!lastPrompt || loadingAnswer) return;
    void sendMessage(lastPrompt, { replaceLastAssistant: true });
  };

  const startNewChat = () => {
    abortRef.current?.abort();
    setCurrentConversationId(createConversationId());
    setMessages([]);
    setInput("");
    setPendingAttachments([]);
    setStrictAttachmentGrounding(false);
    setComposerMenuOpen(false);
    setError("");
    setShowPipeline(false);
    resetActivityCollapse();
    setStages(createStages);
    setMode("coach");
  };

  const clearChat = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setCurrentConversationId(createConversationId());
    setMessages([]);
    setInput("");
    setPendingAttachments([]);
    setStrictAttachmentGrounding(false);
    setComposerMenuOpen(false);
    setError("");
    setLoadingAnswer(false);
    setShowPipeline(false);
    resetActivityCollapse();
    setStages(createStages);
  };

  const clearRevisionWorkspace = () => {
    workspaceResetEpochRef.current += 1;
    REVISION_TOOLS.forEach((tool) => {
      revisionCacheRef.current.delete(`${revisionSelectionKey}:${tool.id}`);
    });
    artifactCacheRef.current.delete(revisionSelectionKey);
    if (userId) invalidateApiCache(`artifact:${userId}:${revisionSelectionKey}`);
    setRevisionContent({ summary: "", explain: "", keypoints: "" });
    setRevisionLoading({ summary: false, explain: false, keypoints: false });
    setRevisionError("");
    setArtifact(null);
    setArtifactLoading(false);
    setArtifactError("");
    setActiveArtifactTab("flip_cards");
    setActiveRevisionPanel("summary");
  };

  const clearExamWorkspace = () => {
    workspaceResetEpochRef.current += 1;
    setExamQuestions([]);
    setProbableQuestions([]);
    setExamAnswers({});
    setExamRetryCount(0);
    setExamSubmitted(false);
    setExamLoading(false);
    setExamSaving(false);
    setExamError("");
    setActiveExamPanel("mcq");
    examStartedAtRef.current = null;
    examGenerationLatencyRef.current = 0;
    examAnswerSelectionsRef.current = {};
  };

  const clearAllCoachHistory = () => {
    const currentSessionId = userId ? `coach-${userId}-${currentConversationId}` : currentConversationId;
    const currentConversation: StudyConversation = {
      id: currentConversationId,
      sessionId: currentSessionId,
      title: titleFromMessages(messages),
      updatedAt: new Date().toISOString(),
      chapter: "Open tutor",
      topic: "Any subject",
      messages,
    };
    const targets = mergeConversations(
      conversations,
      messages.length ? [currentConversation] : [],
    );
    const shouldConfirm = Boolean(targets.length || messages.length || pendingAttachments.length || loadingAnswer || error);
    if (!shouldConfirm) return;

    const confirmed = window.confirm(
      "Clear all Study Lab chat history and messages? Your profile, XP, analytics, and saved exam records stay untouched.",
    );
    if (!confirmed) return;

    targets.forEach(markConversationDeleted);
    abortRef.current?.abort();
    abortRef.current = null;
    setCurrentConversationId(createConversationId());
    setMessages([]);
    setConversations([]);
    setInput("");
    setPendingAttachments([]);
    setStrictAttachmentGrounding(false);
    setComposerMenuOpen(false);
    setError("");
    setLoadingAnswer(false);
    setShowPipeline(false);
    resetActivityCollapse();
    setStages(createStages);
    if (userId) {
      localStorage.setItem(getHistoryStorageKey(userId), JSON.stringify([]));
      invalidateApiCache(`coach-conversations:${userId}`);
    }
    void Promise.allSettled(targets.map((conversation) => deleteConversationFromBackend(conversation)));
  };

  const clearCurrentWorkspace = () => {
    if (!canClearCurrentWorkspace) return;
    if (mode === "coach") {
      clearAllCoachHistory();
      return;
    }

    const shouldConfirm = mode === "revision"
      ? revisionHasState
      : mode === "exam"
        ? examHasState
        : false;

    if (shouldConfirm) {
      const confirmed = window.confirm(
        mode === "revision"
            ? "Clear generated revision notes and artifacts from this workspace? Your saved profile, XP, and analytics stay untouched."
            : "Clear this exam workspace, generated questions, and current answers? Your saved profile, XP, and analytics stay untouched.",
      );
      if (!confirmed) return;
    }

    if (mode === "revision") {
      clearRevisionWorkspace();
      return;
    }
    if (mode === "exam") {
      clearExamWorkspace();
      return;
    }
    clearChat();
  };

  const updateConversationList = (updater: (items: StudyConversation[]) => StudyConversation[]) => {
    setConversations((current) => {
      const next = updater(current);
      if (userId) localStorage.setItem(getHistoryStorageKey(userId), JSON.stringify(next));
      return next;
    });
  };

  const markConversationDeleted = (conversation: Pick<StudyConversation, "id" | "sessionId">) => {
    getConversationDeleteKeys(conversation).forEach((key) => deletedConversationIdsRef.current.add(key));
  };

  const deleteConversationFromBackend = async (conversation: Pick<StudyConversation, "id" | "sessionId">) => {
    if (!userId) return;
    const conversationId = conversation.sessionId || conversation.id;
    if (!conversationId) return;
    try {
      await apiFetch(`${backendURL}/coach/conversations/${userId}/${encodeURIComponent(conversationId)}`, {
        method: "DELETE",
        headers: await getAuthHeaders(),
        timeoutMs: 7000,
      });
      invalidateApiCache(`coach-conversations:${userId}`);
    } catch {
      // Local deletion remains immediate; backend sync can be retried by clearing again.
    }
  };

  const syncConversationPatch = async (conversation: StudyConversation, patch: Partial<Pick<StudyConversation, "title" | "pinned" | "archived" | "titleLocked">>) => {
    if (!userId) return;
    try {
      await apiFetch(`${backendURL}/coach/conversations/${userId}/${encodeURIComponent(conversation.sessionId || conversation.id)}`, {
        method: "PATCH",
        headers: await getAuthHeaders(),
        timeoutMs: 5000,
        body: JSON.stringify(patch),
      });
      invalidateApiCache(`coach-conversations:${userId}`);
    } catch {
      // Local state remains the immediate fallback; backend sync can recover on the next saved turn.
    }
  };

  const renameConversation = (conversation: StudyConversation) => {
    const title = window.prompt("Rename this chat", conversation.title)?.trim();
    if (!title) return;
    updateConversationList((items) => items.map((item) => (
      item.id === conversation.id ? { ...item, title: title.slice(0, 72), titleLocked: true } : item
    )));
    void syncConversationPatch(conversation, { title: title.slice(0, 72), titleLocked: true });
  };

  const togglePinConversation = (conversation: StudyConversation) => {
    updateConversationList((items) => items.map((item) => (
      item.id === conversation.id ? { ...item, pinned: !item.pinned } : item
    )));
    void syncConversationPatch(conversation, { pinned: !conversation.pinned });
  };

  const toggleArchiveConversation = (conversation: StudyConversation) => {
    updateConversationList((items) => items.map((item) => (
      item.id === conversation.id ? { ...item, archived: !item.archived } : item
    )));
    void syncConversationPatch(conversation, { archived: !conversation.archived });
    if (conversation.id === currentConversationId && !conversation.archived) startNewChat();
  };

  const deleteConversation = (conversation: StudyConversation) => {
    const confirmed = window.confirm(
      "Delete this Study Lab conversation and all its messages? Your profile, XP, analytics, and saved exam records stay untouched.",
    );
    if (!confirmed) return;

    markConversationDeleted(conversation);
    updateConversationList((items) => items.filter((item) => item.id !== conversation.id));
    if (conversation.id === currentConversationId) {
      clearChat();
    }
    if (userId) invalidateApiCache(`coach-conversations:${userId}`);
    void deleteConversationFromBackend(conversation);
  };

  const editQuestion = (content: string) => {
    setInput(content);
    window.setTimeout(() => inputRef.current?.focus(), 20);
  };

  const handleAttachmentSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    setComposerMenuOpen(false);
    if (!files.length) return;
    if (pendingAttachments.length + files.length > 5) {
      setError("Attach up to 5 images, screenshots, text files, or PDFs at a time.");
      return;
    }

    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"]);
    const next: PendingAttachment[] = [];
    for (const file of files) {
      const maxBytes = file.type.startsWith("image/") ? 4 * 1024 * 1024 : 6 * 1024 * 1024;
      if (!allowed.has(file.type) || file.size > maxBytes) {
        setError(`${file.name} is not supported or is too large.`);
        continue;
      }
      try {
        next.push({
          id: `${file.name}-${file.size}-${Date.now()}`,
          name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          data_url: await readFileAsDataUrl(file),
        });
      } catch {
        setError(`${file.name} could not be read.`);
      }
    }
    if (next.length) {
      setPendingAttachments((current) => [...current, ...next]);
      setError("");
    }
  };

  const removePendingAttachment = (name: string) => {
    setPendingAttachments((current) => {
      const next = current.filter((attachment) => attachment.name !== name);
      if (!next.length) setStrictAttachmentGrounding(false);
      return next;
    });
  };

  const resumeConversation = (conversation: StudyConversation) => {
    setCurrentConversationId(conversation.id);
    const savedChapter = CHAPTERS.find((item) => item.value === conversation.chapter);
    if (savedChapter) {
      setChapter(savedChapter.value);
      setTopic(savedChapter.topics.some((item) => item.value === conversation.topic) ? conversation.topic : savedChapter.topics[0].value);
    }
    setMessages(conversation.messages || []);
    setMode("coach");
    setShowPipeline(false);
    resetActivityCollapse();
    window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
  };

  const startVoiceInput = () => {
    if (!speechSupported || loadingAnswer) return;
    const SpeechRecognition = getSpeechRecognitionCtor();
    if (!SpeechRecognition) return;
    recognitionRef.current?.stop();
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-IN";
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() || "";
      setListening(false);
      if (transcript) void sendMessage(transcript, { fromVoice: true });
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  };

  const stopVoiceInput = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const runRevision = async (tool: RevisionTool) => {
    if (!userId || authBusy) return;
    const requestEpoch = workspaceResetEpochRef.current;
    const cacheKey = `${revisionSelectionKey}:${tool.id}`;
    const cached = revisionCacheRef.current.get(cacheKey);
    setMode("revision");
    setActiveRevisionPanel(tool.id);
    setRevisionError("");
    if (cached) {
      setRevisionContent((current) => ({ ...current, [tool.id]: cached }));
      return;
    }
    setRevisionLoading((current) => ({ ...current, [tool.id]: true }));
    setRevisionContent((current) => ({ ...current, [tool.id]: "" }));
    try {
      const data = await apiJson<{ answer?: unknown }>(`${backendURL}/section-ai`, {
        method: "POST",
        headers: await getAuthHeaders(),
        retries: 1,
        // Revision is a grounded LLM generation that runs ~15-22s when the
        // backend is warm; the old 24s ceiling raced it and surfaced a false
        // "material not found". 45s leaves comfortable margin.
        timeoutMs: 45000,
        body: JSON.stringify({
          question: tool.prompt(selectedTopic.label),
          section_id: selectedTopicValue,
          session_id: `revision-${userId}-${selectedTopicValue}-${tool.id}`,
          mode: tool.mode,
          difficulty: "medium",
          subject: "Chemistry",
          chapter: selectedChapter.label,
          topic: selectedTopic.label,
          strict_grounding: true,
          retrieval_required: true,
          fallback_to_general_knowledge: false,
          system_guardrail: DATA_GROUNDED_TUTOR_GUARDRAIL,
          required_not_found_response: MATERIAL_NOT_FOUND_MESSAGE,
        }),
      });
      const backendAnswer = getUsableBackendAnswer(data);
      const nextContent = backendAnswer || MATERIAL_NOT_FOUND_MESSAGE;
      if (requestEpoch !== workspaceResetEpochRef.current) return;
      if (backendAnswer) revisionCacheRef.current.set(cacheKey, backendAnswer);
      setRevisionContent((current) => ({ ...current, [tool.id]: nextContent }));
    } catch {
      if (requestEpoch !== workspaceResetEpochRef.current) return;
      setRevisionError(MATERIAL_NOT_FOUND_MESSAGE);
      setRevisionContent((current) => ({ ...current, [tool.id]: MATERIAL_NOT_FOUND_MESSAGE }));
    } finally {
      if (requestEpoch === workspaceResetEpochRef.current) {
        setRevisionLoading((current) => ({ ...current, [tool.id]: false }));
      }
    }
  };

  const generateArtifact = async () => {
    if (!userId || authBusy || artifactLoading) return;
    const requestEpoch = workspaceResetEpochRef.current;
    const cached = artifactCacheRef.current.get(revisionSelectionKey);
    setMode("revision");
    setActiveRevisionPanel("artifact");
    setArtifactError("");
    setActiveArtifactTab("flip_cards");
    if (cached) {
      setArtifact(cached);
      setActiveArtifactTab(firstArtifactTab(cached));
      return;
    }
    setArtifact(null);
    setArtifactLoading(true);
    try {
      const data = await apiJson<StudyArtifactResponse>(`${backendURL}/artifacts/generate`, {
        method: "POST",
        headers: await getAuthHeaders(),
        retries: 1,
        timeoutMs: 12000,
        body: JSON.stringify({
          section_id: selectedTopicValue,
          topic: selectedTopic.label,
          subject: "Chemistry",
          chapter: selectedChapter.label,
          artifact_type: "auto",
          strict_grounding: true,
          retrieval_required: true,
          fallback_to_general_knowledge: false,
          system_guardrail: DATA_GROUNDED_TUTOR_GUARDRAIL,
          required_not_found_response: MATERIAL_NOT_FOUND_MESSAGE,
        }),
      });
      if (requestEpoch !== workspaceResetEpochRef.current) return;
      if (isUsableArtifactResponse(data)) {
        const nextArtifact = data;
        artifactCacheRef.current.set(revisionSelectionKey, nextArtifact);
        setArtifact(nextArtifact);
        setActiveArtifactTab(firstArtifactTab(nextArtifact));
      } else {
        setArtifactError(ARTIFACT_UNAVAILABLE_MESSAGE);
      }
    } catch {
      if (requestEpoch !== workspaceResetEpochRef.current) return;
      setArtifactError(ARTIFACT_UNAVAILABLE_MESSAGE);
    } finally {
      if (requestEpoch === workspaceResetEpochRef.current) {
        setArtifactLoading(false);
      }
    }
  };

  const generateExamPack = async () => {
    if (!userId || authBusy || examLoading) return;
    const requestEpoch = workspaceResetEpochRef.current;
    const requestStartedAt = Date.now();
    setMode("exam");
    setActiveExamPanel("mcq");
    setExamLoading(true);
    setExamError("");
    setExamSubmitted(false);
    setExamAnswers({});
    setExamRetryCount(0);
    setExamQuestions([]);
    setProbableQuestions([]);
    examStartedAtRef.current = null;
    examGenerationLatencyRef.current = 0;
    examAnswerSelectionsRef.current = {};
    try {
      const headers = await getAuthHeaders();
      const [mcqResult, probableResult] = await Promise.allSettled([
        apiFetch(`${backendURL}/generate-mcqs`, {
          method: "POST",
          headers,
          timeoutMs: 24000,
          retries: 1,
          body: JSON.stringify({
            topic: selectedTopic.label,
            section_id: selectedTopicValue,
            session_id: `exam-${userId}-${selectedTopicValue}-${Date.now()}`,
            difficulty: "medium",
            count: 5,
            subject: "Chemistry",
            chapter: selectedChapter.label,
            strict_grounding: true,
            retrieval_required: true,
            fallback_to_general_knowledge: false,
            include_source: true,
            require_four_options: true,
            require_explanation: true,
            system_guardrail: DATA_GROUNDED_TUTOR_GUARDRAIL,
            required_not_found_response: MATERIAL_NOT_FOUND_MESSAGE,
          }),
        }),
        apiFetch(`${backendURL}/generate-probable-questions`, {
          method: "POST",
          headers,
          timeoutMs: 24000,
          retries: 1,
          body: JSON.stringify({
            topic: selectedTopic.label,
            section_id: selectedTopicValue,
            session_id: `probable-${userId}-${selectedTopicValue}-${Date.now()}`,
            difficulty: "medium",
            subject: "Chemistry",
            chapter: selectedChapter.label,
            strict_grounding: true,
            retrieval_required: true,
            fallback_to_general_knowledge: false,
            include_source: true,
            system_guardrail: DATA_GROUNDED_TUTOR_GUARDRAIL,
            required_not_found_response: MATERIAL_NOT_FOUND_MESSAGE,
          }),
        }),
      ]);
      if (requestEpoch !== workspaceResetEpochRef.current) return;
      const mcqRes = mcqResult.status === "fulfilled" ? mcqResult.value : null;
      const probableRes = probableResult.status === "fulfilled" ? probableResult.value : null;
      if (!mcqRes?.ok) throw new Error("MCQ generation failed");
      const mcqData = await safeJsonResponse(mcqRes);
      const probableData = probableRes?.ok ? await safeJsonResponse(probableRes) : null;
      const sourceLabel = `${selectedChapter.label} / ${selectedTopic.label}`;
      const nextQuestions = Array.isArray(mcqData?.questions)
        ? mcqData.questions.map((question: unknown, index: number) => normalizeExamQuestion(question, index, sourceLabel)).filter((question: ExamQuestion | null): question is ExamQuestion => Boolean(question))
        : [];
      const nextProbable = Array.isArray(probableData?.questions)
        ? probableData.questions.map((question: unknown, index: number) => normalizeProbableQuestion(question, index, sourceLabel)).filter((question: ProbableQuestion | null): question is ProbableQuestion => Boolean(question))
        : [];

      if (nextQuestions.length < 5) {
        setExamError(String(mcqData?.error || "The exam generator could not create a complete MCQ pack. Please try again."));
        setExamQuestions([]);
        setProbableQuestions([]);
        return;
      }

      setExamQuestions(nextQuestions.slice(0, 5));
      setProbableQuestions(nextProbable);
      examStartedAtRef.current = new Date().toISOString();
      examGenerationLatencyRef.current = Date.now() - requestStartedAt;
      if (nextProbable.length < 5) {
        setExamError("Your MCQ pack is ready. Probable questions could not be completed right now, so please regenerate when you want that section.");
      }
    } catch {
      if (requestEpoch !== workspaceResetEpochRef.current) return;
      setExamError("The exam generator could not complete the request right now. Please try again.");
      setExamQuestions([]);
      setProbableQuestions([]);
    } finally {
      if (requestEpoch === workspaceResetEpochRef.current) {
        setExamLoading(false);
      }
    }
  };

  const recordExamAnswer = (questionId: string, optionKey: string) => {
    if (examSubmitted) return;
    const previous = examAnswerSelectionsRef.current[questionId];
    if (previous && previous !== optionKey) {
      setExamRetryCount((current) => current + 1);
    }
    examAnswerSelectionsRef.current = {
      ...examAnswerSelectionsRef.current,
      [questionId]: optionKey,
    };
    setExamAnswers((current) => ({ ...current, [questionId]: optionKey }));
  };

  const submitExam = async () => {
    if (!examQuestions.length || examSubmitted) return;
    const requestEpoch = workspaceResetEpochRef.current;
    setExamSubmitted(true);
    if (!userId) return;
    const completedAt = new Date();
    const startedAt = examStartedAtRef.current || completedAt.toISOString();
    const startedAtMs = new Date(startedAt).getTime();
    const durationSeconds = Number.isFinite(startedAtMs)
      ? Math.max(1, Math.round((completedAt.getTime() - startedAtMs) / 1000))
      : 1;
    const accuracyPercent = Math.round((examScore / Math.max(1, examQuestions.length)) * 100);
    const focusScore = clampStudyMetric(accuracyPercent - Math.min(20, examRetryCount * 3));
    setExamSaving(true);
    try {
      await apiFetch(`${backendURL}/submit-session`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          user_id: userId,
          topic: selectedTopic.label,
          subject: "Chemistry",
          score: examScore,
          total_questions: examQuestions.length,
          xp_earned: examScore * 10,
          time_spent_seconds: durationSeconds,
          focus_score: focusScore,
          session_type: "study_exam",
          started_at: startedAt,
          completed_at: completedAt.toISOString(),
          response_latency_ms: examGenerationLatencyRef.current,
          hint_count: 0,
          retry_count: examRetryCount,
          replay_data: {
            topic: selectedTopic.label,
            source: "study_page_exam",
            telemetry: {
              started_at: startedAt,
              completed_at: completedAt.toISOString(),
              duration_seconds: durationSeconds,
              exam_generation_latency_ms: examGenerationLatencyRef.current,
              retry_count: examRetryCount,
              focus_score: focusScore,
            },
            questions: examQuestions.map((question) => ({
              id: question.id,
              text: question.question,
              topic: selectedTopic.label,
              options: question.options,
              correct_answer: question.correct,
              user_answer: examAnswers[question.id] || "",
              is_correct: examAnswers[question.id] === question.correct,
              ai_explanation: question.explanation || "",
            })),
            probable_questions: probableQuestions,
          },
        }),
        retries: 1,
        timeoutMs: 9000,
      });
    } catch {
      if (requestEpoch === workspaceResetEpochRef.current) {
        setExamError("Feedback is ready, but the session could not be saved.");
      }
    } finally {
      if (requestEpoch === workspaceResetEpochRef.current) {
        setExamSaving(false);
      }
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const fillStarterPrompt = (prompt: string) => {
    setInput(prompt);
    window.setTimeout(() => inputRef.current?.focus(), 20);
  };

  const renderChatComposer = (variant: "hero" | "dock") => {
    const isHero = variant === "hero";
    const canSend = Boolean(input.trim() || pendingAttachments.length) || loadingAnswer;

    return (
      <div className={isHero ? "study-hero-composer w-full" : "w-full"}>
        {!isHero ? (
          <div className="mb-2 flex items-center justify-between gap-3 px-1 text-xs text-slate-400">
            <span className="truncate">
              {loadingAnswer ? `${coachName} is responding...` : "Ask naturally. Enter to send, Shift+Enter for a new line."}
            </span>
            <span className="hidden shrink-0 sm:inline">
              {speechSupported ? "Voice available" : "Text ready"}
            </span>
          </div>
        ) : null}

        <div className={`study-composer-card ${isHero ? "is-hero" : ""}`}>
          {pendingAttachments.length ? (
            <AttachmentChips attachments={pendingAttachments} onRemove={removePendingAttachment} />
          ) : null}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={isHero ? 2 : 1}
            placeholder={listening ? "Listening..." : isHero ? "Ask anything you want to learn..." : `Message ${coachName}...`}
            className="study-textarea min-h-14 flex-1 resize-none bg-transparent px-1 py-1 text-base text-slate-900 outline-none placeholder:text-slate-400 sm:px-2"
          />

          <div className="study-composer-toolbar">
            <div className="flex min-w-0 items-center gap-2">
              <input
                ref={attachmentInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,application/pdf,text/plain"
                onChange={handleAttachmentSelect}
                className="sr-only"
              />
              <div ref={composerMenuRef} className="study-composer-menu-wrap">
                <button
                  ref={composerMenuTriggerRef}
                  type="button"
                  onClick={() => setComposerMenuOpen((current) => !current)}
                  disabled={loadingAnswer}
                  title="Open tutor tools"
                  aria-label="Open tutor tools"
                  aria-haspopup="menu"
                  aria-expanded={composerMenuOpen}
                  className="study-chat-icon-button border border-slate-200 bg-white/80 text-slate-700 hover:border-[#0E7490]/30 hover:text-[#0E7490] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <AppIcon name={composerMenuOpen ? "x" : "plus"} />
                </button>
                {composerMenuOpen ? (
                  <div className="study-composer-menu" role="menu" aria-label="Tutor tools">
                    <button
                      ref={composerFirstActionRef}
                      type="button"
                      role="menuitem"
                      className="study-composer-menu-action"
                      onClick={() => {
                        setComposerMenuOpen(false);
                        attachmentInputRef.current?.click();
                      }}
                    >
                      <AppIcon name="plus" />
                      <span>
                        <strong>Add photos & files</strong>
                        <small>Images, screenshots, PDFs, or notes</small>
                      </span>
                    </button>
                    <label className="study-composer-menu-toggle" role="menuitemcheckbox" aria-checked={socraticMode}>
                      <span>
                        <strong>Guide me step by step</strong>
                        <small>Use hints before the final answer</small>
                      </span>
                      <input
                        className="sr-only"
                        type="checkbox"
                        checked={socraticMode}
                        onChange={(event) => setSocraticMode(event.target.checked)}
                      />
                      <i aria-hidden="true" className="study-composer-switch" />
                    </label>
                    <label
                      className={`study-composer-menu-toggle ${pendingAttachments.length ? "" : "is-disabled"}`}
                      role="menuitemcheckbox"
                      aria-checked={strictAttachmentGrounding}
                      aria-disabled={!pendingAttachments.length}
                    >
                      <span>
                        <strong>Use uploaded notes only</strong>
                        <small>Answer only from attached material</small>
                      </span>
                      <input
                        className="sr-only"
                        type="checkbox"
                        disabled={!pendingAttachments.length}
                        checked={strictAttachmentGrounding}
                        onChange={(event) => setStrictAttachmentGrounding(event.target.checked)}
                      />
                      <i aria-hidden="true" className="study-composer-switch" />
                    </label>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={listening ? stopVoiceInput : startVoiceInput}
                disabled={!speechSupported || loadingAnswer}
                title={listening ? "Stop voice input" : "Start voice input"}
                aria-label={listening ? "Stop voice input" : "Start voice input"}
                className={`agentify-action study-chat-icon-button ${
                  listening
                    ? "bg-emerald-500 text-white"
                    : "border border-slate-200 bg-white/80 text-slate-700 hover:border-[#0E7490]/30 hover:text-[#0E7490]"
                } disabled:cursor-not-allowed disabled:opacity-45`}
              >
                <AppIcon name={listening ? "x" : "mic"} />
              </button>
              <button
                type="button"
                onClick={loadingAnswer ? stopGenerating : () => void sendMessage()}
                disabled={!canSend}
                title={loadingAnswer ? "Stop response" : "Send message"}
                aria-label={loadingAnswer ? "Stop response" : "Send message"}
                className={`agentify-action study-chat-send-button disabled:cursor-not-allowed ${
                  loadingAnswer
                    ? "border border-rose-200 bg-rose-50 text-rose-600 hover:border-rose-300 hover:bg-rose-100"
                    : input.trim() || pendingAttachments.length
                      ? "bg-[linear-gradient(135deg,#0F172A,#0E7490,#14B8A6)] text-white shadow-[0_14px_34px_rgba(14,116,144,0.22)] hover:shadow-[0_18px_42px_rgba(14,116,144,0.26)]"
                      : "border border-slate-200 bg-slate-100 text-slate-400"
                }`}
              >
                <AppIcon name={loadingAnswer ? "x" : "send"} />
              </button>
            </div>
          </div>
        </div>

        {!speechSupported && !isHero ? (
          <p className="mt-2 text-xs text-slate-500">
            Voice is available in browsers that support speech recognition and speech synthesis.
          </p>
        ) : null}
        {error ? <div className="mt-2"><AlertState message={error} /></div> : null}
      </div>
    );
  };

  const threeMarkQuestions = probableQuestions.filter((question) => question.marks !== 5);
  const fiveMarkQuestions = probableQuestions.filter((question) => question.marks === 5);

  if (authBusy) {
    return (
      <LoadingState title="Opening your study room..." detail="Preparing tutor, chat, and learning tools." />
    );
  }

  return (
    <div className="study-lab-shell flex h-full min-h-0 w-full flex-col overflow-hidden">
      <section className="study-lab-header px-3 py-2.5 sm:px-5">
        <div data-mode={mode} className="study-workspace-bar flex w-full flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="study-mode-segment" role="tablist" aria-label="Study mode">
            {STUDY_MODES.map((item) => (
              <ModeButton
                key={item.id}
                active={mode === item.id}
                label={item.label}
                detail={item.detail}
                icon={item.icon}
                onClick={() => {
                  setMode(item.id);
                  if (item.id === "revision") {
                    setActiveRevisionPanel("summary");
                  }
                }}
              />
            ))}
          </div>

        </div>
      </section>

      <section className="study-lab-main flex min-h-0 flex-1 flex-col">
        {mode === "coach" ? (
          <div className="study-coach-layout flex min-h-0 flex-1" data-sidebar-open={sidebarOpen ? "true" : "false"}>
            {sidebarOpen ? (
              <button
                type="button"
                className="study-sidebar-backdrop"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close chat history"
              />
            ) : null}
            {sidebarOpen ? (
              <CoachHistorySidebar
                conversations={filteredConversations}
                currentConversationId={currentConversationId}
                search={historySearch}
                onSearchChange={setHistorySearch}
                onSelect={resumeConversation}
                onNewChat={startNewChat}
                onCollapse={() => setSidebarOpen(false)}
                showArchived={showArchivedChats}
                onToggleArchived={() => setShowArchivedChats((current) => !current)}
                onClearHistory={clearCurrentWorkspace}
                canClearHistory={canClearCurrentWorkspace}
                onRename={renameConversation}
                onPin={togglePinConversation}
                onArchive={toggleArchiveConversation}
                onDelete={deleteConversation}
              />
            ) : null}

            <div className="study-chat-workspace relative flex min-h-0 min-w-0 flex-1 flex-col">
              {!sidebarOpen ? (
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="study-sidebar-restore"
                  title="Show history sidebar"
                  aria-label="Show history sidebar"
                >
                  <AppIcon name="panelLeft" />
                </button>
              ) : null}

              <div className="study-chat-scroll flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
              {messages.length === 0 ? (
                <div className="study-empty-state study-chat-landing flex min-h-[68svh] w-full flex-col items-center justify-center text-center">
                  <h2 className="text-3xl font-semibold text-slate-950 sm:text-5xl">
                    What should we learn today?
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
                    Ready when you are, {displayName.split(" ")[0]}. Ask a doubt from your study material or request a simple explanation{profile?.classLevel ? ` for ${profile.classLevel}` : ""}.
                  </p>

                  <div className="mt-8 w-full">
                    {renderChatComposer("hero")}
                  </div>

                  <div className="mt-5 flex w-full flex-wrap justify-center gap-2">
                    {starterPrompts.map((starter) => (
                      <StarterPromptCard
                        key={starter.label}
                        label={starter.label}
                        title={starter.title}
                        detail={starter.detail}
                        onClick={() => fillStarterPrompt(starter.prompt)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="study-chat-thread w-full space-y-6">
                  {messages.map((message, index) => {
                    const isLatestMessage = index === messages.length - 1;

                    return message.role === "user" ? (
                      <StudentPromptCard
                        key={`${message.role}-${index}`}
                        content={message.content}
                        timestamp={message.timestamp}
                        attachments={message.attachments}
                        onEdit={() => editQuestion(message.content)}
                      />
                    ) : (
                      <TutorResponseCard
                        key={`${message.role}-${index}`}
                        coachName={coachName}
                        content={message.content}
                        blocks={message.blocks}
                        sources={message.sources}
                        socratic={message.socratic}
                        timestamp={message.timestamp}
                        topicLabel="Open tutor"
                        stages={stages}
                        showActivity={showPipeline && isLatestMessage}
                        activityCollapsed={activityCollapsed}
                        streaming={loadingAnswer && isLatestMessage && Boolean(message.content.trim())}
                        canRegenerate={!loadingAnswer && isLatestMessage}
                        onPrompt={setInput}
                        onRegenerate={regenerateLastAnswer}
                        onDirectAnswer={() => void sendMessage("Please give me the direct answer now.", { directAnswer: true })}
                      />
                    );
                  })}

                  <div ref={endRef} />
                </div>
              )}
              </div>

              {messages.length ? (
                <div className="study-composer border-t border-slate-200/70 bg-white/86 p-4 backdrop-blur-xl">
                  <div className="study-composer-inner">
                    {renderChatComposer("dock")}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {mode === "revision" ? (
          <div className="study-mode-fullscreen flex min-h-0 flex-1 flex-col overflow-hidden p-0">
            <div className="study-revision-layout min-h-0 flex-1">
              <aside className="study-revision-rail" aria-label="Revision setup" data-open={revisionSetupOpen ? "true" : "false"}>
                <button
                  type="button"
                  className="study-revision-mobile-toggle"
                  onClick={() => setRevisionSetupOpen((current) => !current)}
                  aria-expanded={revisionSetupOpen}
                >
                  <span>
                    <small>Topic and format</small>
                    <strong>{selectedTopic.label} / {activeRevisionTool?.title || "Study Tools"}</strong>
                  </span>
                  <AppIcon name={revisionSetupOpen ? "x" : "panelLeft"} />
                </button>

                <div className="study-revision-rail-body">
                  <div className="study-revision-rail-heading">
                    <p className="dashboard-section-kicker">Revision workspace</p>
                    <h2>{selectedTopic.label}</h2>
                    <p>Choose the source and the revision format. Your generated work stays in the reading canvas.</p>
                  </div>

                  <div className="study-revision-selectors">
                    <label>
                      <span>Chapter</span>
                      <select
                        value={selectedChapter.value}
                        aria-label="Chapter"
                        onChange={(event) => {
                          const next = event.target.value;
                          setChapter(next);
                          setTopic(CHAPTERS.find((item) => item.value === next)?.topics[0]?.value || "alkanes");
                        }}
                        className="study-select"
                      >
                        {CHAPTERS.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Section</span>
                      <select
                        value={selectedTopicValue}
                        aria-label="Section"
                        onChange={(event) => setTopic(event.target.value)}
                        className="study-select"
                      >
                        {selectedChapter.topics.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="study-revision-format-picker">
                    <p className="study-sidebar-section-label">Format</p>
                    <RevisionModeTabs activeTab={activeRevisionPanel} onChange={setActiveRevisionPanel} />
                  </div>

                  <button
                    type="button"
                    onClick={clearCurrentWorkspace}
                    disabled={!canClearCurrentWorkspace}
                    className="study-revision-reset"
                  >
                    <AppIcon name="trash" />
                    <span>Reset revision</span>
                  </button>
                </div>
              </aside>

              <section className={`study-content-card study-focus-panel study-revision-canvas ${activeRevisionPanel === "artifact" ? "study-artifact-focus" : ""} flex min-h-0 flex-1 flex-col`}>
                {activeRevisionTool ? (
                  <>
                    <header className="study-revision-canvas-header">
                      <div className="study-revision-canvas-title">
                        <p>{selectedChapter.label} / {selectedTopic.label}</p>
                        <h2>{activeRevisionTool.title}</h2>
                        <span>{activeRevisionTool.detail}</span>
                      </div>
                      <div className="study-revision-actions">
                        <CopyButton value={revisionContent[activeRevisionTool.id]} />
                        <button
                          type="button"
                          onClick={() => void runRevision(activeRevisionTool)}
                          disabled={revisionLoading[activeRevisionTool.id]}
                          className="agentify-action agentify-action-primary inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0E7490] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0B5F76] disabled:cursor-wait disabled:opacity-55"
                        >
                          <AppIcon name="spark" />
                          <span>{revisionLoading[activeRevisionTool.id] ? "Generating..." : `Generate ${activeRevisionTool.title}`}</span>
                        </button>
                      </div>
                    </header>

                    <div className="study-scroll-pane study-revision-scroll min-h-0 flex-1 overflow-y-auto">
                      {revisionLoading[activeRevisionTool.id] ? (
                        <RevisionLoadingState title={activeRevisionTool.title} />
                      ) : revisionContent[activeRevisionTool.id] ? (
                        <article className="study-revision-document">
                          <CoachAnswer value={revisionContent[activeRevisionTool.id]} />
                        </article>
                      ) : (
                        <div className="study-revision-empty">
                          <EmptyState
                            icon="book"
                            title={`No ${activeRevisionTool.title.toLowerCase()} yet`}
                            detail={`Generate it for ${selectedTopic.label}. Your revision will appear in this focused reading canvas.`}
                          />
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <header className="study-revision-canvas-header">
                      <div className="study-revision-canvas-title">
                        <p>{selectedChapter.label} / {selectedTopic.label}</p>
                        <h2>Study Tools</h2>
                        <span>Build interactive recall cards, concept links, formula practice, and mistake checks from the selected material.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void generateArtifact()}
                        disabled={artifactLoading}
                        className="agentify-action agentify-action-primary inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0E7490] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0B5F76] disabled:cursor-wait disabled:opacity-55"
                      >
                        <AppIcon name="spark" />
                        <span>{artifactLoading ? "Building tools..." : artifact ? "Study tools ready" : "Generate Study Tools"}</span>
                      </button>
                    </header>

                    <ArtifactCanvas
                      topic={selectedTopic.label}
                      loading={artifactLoading}
                      error={artifactError}
                      onRetry={() => void generateArtifact()}
                    >
                      {artifact ? (
                        <ArtifactViewer
                          response={artifact}
                          activeTab={activeArtifactTab}
                          onTabChange={setActiveArtifactTab}
                        />
                      ) : artifactLoading ? (
                        <ArtifactLoadingState />
                      ) : null}
                    </ArtifactCanvas>
                  </>
                )}
              </section>
            </div>
            {revisionError ? <div className="study-revision-alert"><AlertState message={revisionError} /></div> : null}
          </div>
        ) : null}

        {mode === "exam" ? (
          <div className="study-mode-fullscreen flex min-h-0 flex-1 flex-col overflow-hidden p-0">
            <div className="study-focus-workspace flex min-h-0 flex-1 flex-col gap-4">
              <div className="study-focus-toolbar rounded-[1.7rem] border border-white/60 bg-white/76 p-3 shadow-[0_18px_54px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0E7490]">Exam prep canvas</p>
                    <h2 className="mt-1 text-2xl font-semibold text-slate-950">{selectedTopic.label}</h2>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="agentify-chip">Answered {answeredExamCount}/{examQuestions.length || 5}</span>
                      <span className="agentify-chip">{examSubmitted ? `Score ${examScore}/${examQuestions.length}` : `${progressPercent}% ready`}</span>
                    </div>
                  </div>
                  <div className="study-panel-tabs" role="tablist" aria-label="Exam workspaces">
                    {EXAM_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        title={tab.detail}
                        aria-selected={activeExamPanel === tab.id}
                        onClick={() => setActiveExamPanel(tab.id)}
                        className={`study-panel-tab ${activeExamPanel === tab.id ? "is-active" : ""}`}
                      >
                        <AppIcon name={tab.icon} className="h-3.5 w-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="study-exam-progress mt-3">
                  <span style={{ width: `${progressPercent}%` }} />
                </div>
              </div>

              <section className="study-content-card study-focus-panel flex min-h-0 flex-1 flex-col rounded-[2rem] border border-white/60 bg-white/84 p-5 shadow-[0_20px_64px_rgba(15,23,42,0.10)] backdrop-blur-2xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0E7490]">{EXAM_TABS.find((tab) => tab.id === activeExamPanel)?.label}</p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                      {activeExamPanel === "mcq"
                        ? "MCQ Practice"
                        : activeExamPanel === "probable"
                          ? "Probable Questions"
                          : activeExamPanel === "practice"
                            ? "Practice Questions"
                            : "Answer Review"}
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                      {activeExamPanel === "mcq"
                        ? "Generate one focused set, answer all choices, then submit to unlock review."
                        : activeExamPanel === "probable"
                          ? "Use likely 3-mark and 5-mark questions for theory-answer preparation."
                          : activeExamPanel === "practice"
                            ? "Turn generated questions into focused drills before checking answers."
                            : "Review score, explanations, and mistake patterns after submission."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void generateExamPack()}
                    disabled={examLoading}
                    className="agentify-action agentify-action-primary inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0E7490] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0B5F76] disabled:cursor-wait disabled:opacity-55"
                  >
                    <AppIcon name="spark" />
                    <span>{examLoading ? "Generating..." : examQuestions.length ? "Regenerate pack" : "Generate exam pack"}</span>
                  </button>
                </div>

                {examError ? <div className="mt-4"><AlertState message={examError} /></div> : null}

                <div className="study-scroll-pane mt-5 min-h-0 flex-1 overflow-y-auto rounded-3xl border border-slate-200 bg-white/70 p-5">
                  {activeExamPanel === "mcq" ? (
                    examQuestions.length ? (
                      <>
                        <div className="space-y-4">
                          {examQuestions.map((question, index) => {
                            const selected = examAnswers[question.id];
                            const correct = examSubmitted && selected === question.correct;
                            return (
                              <article key={question.id} className="study-exam-question rounded-3xl border border-slate-200 bg-white/74 p-5">
                                <div className="flex items-start gap-3">
                                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0E7490]/10 text-sm font-bold text-[#0E7490]">
                                    {index + 1}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-base font-semibold leading-7 text-slate-900">{question.question}</p>
                                    {question.source ? (
                                      <p className="mt-2 text-xs font-semibold text-slate-500">Source: {question.source}</p>
                                    ) : null}
                                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                      {question.options.map((option, optionIndex) => {
                                        const optionKey = String.fromCharCode(65 + optionIndex);
                                        const isSelected = selected === optionKey;
                                        const isCorrectOption = examSubmitted && question.correct === optionKey;
                                        return (
                                          <button
                                            key={`${question.id}-${optionKey}`}
                                            type="button"
                                            onClick={() => {
                                              if (!examSubmitted) {
                                                recordExamAnswer(question.id, optionKey);
                                              }
                                            }}
                                            disabled={examSubmitted}
                                            className={`agentify-action rounded-2xl border px-4 py-3 text-left text-sm leading-6 transition ${
                                              isCorrectOption
                                                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                                : isSelected
                                                  ? "border-[#0E7490]/40 bg-[#0E7490]/10 text-[#0E7490]"
                                                : "border-slate-200 bg-white/75 text-slate-700 hover:border-[#0E7490]/30"
                                            }`}
                                          >
                                            <span className="font-bold">{optionKey}.</span> {option.replace(/^[A-D][.)]\s*/i, "")}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    {examSubmitted ? (
                                      <div className={`mt-4 rounded-2xl border p-4 ${correct ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                                        <p className={`text-sm font-bold ${correct ? "text-emerald-700" : "text-amber-800"}`}>
                                          {correct ? "Correct understanding" : `Review needed. Correct answer: ${question.correct}`}
                                        </p>
                                        <p className="mt-2 text-sm leading-6 text-slate-700">
                                          {question.explanation || "Revisit the core definition, compare the options, and notice the exact concept tested in this question."}
                                        </p>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm text-slate-500">Answered {answeredExamCount}/{examQuestions.length}</p>
                          <button
                            type="button"
                            onClick={() => void submitExam()}
                            disabled={examSubmitted || answeredExamCount !== examQuestions.length}
                            className="agentify-action inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            <AppIcon name={examSubmitted ? "check" : "send"} />
                            <span>{examSaving ? "Saving..." : examSubmitted ? "Submitted" : "Submit and review"}</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <EmptyState
                        icon="check"
                        title="Your MCQ set is not generated yet"
                        detail="Create 5 MCQs from the selected topic, then submit once to unlock feedback and theory questions."
                      />
                    )
                  ) : null}

                  {activeExamPanel === "probable" ? (
                    probableQuestions.length ? (
                      <div className="space-y-6">
                        <div className="flex justify-end">
                          <CopyButton value={probableQuestions.map((question) => `${question.id} (${question.marks} marks): ${question.question}`).join("\n")} />
                        </div>
                        <div className="grid gap-4 lg:grid-cols-2">
                          <section className="study-exam-artifact rounded-3xl border border-slate-200 bg-white/74 p-5">
                            <p className="agentify-label">3 marks</p>
                            <div className="mt-4 space-y-3">
                              {threeMarkQuestions.map((question) => (
                                <p key={question.id} className="rounded-2xl border border-slate-200 bg-white/74 p-4 text-sm leading-6 text-slate-700">
                                  {question.question}
                                  {question.source ? <span className="mt-2 block text-xs font-semibold text-slate-500">Source: {question.source}</span> : null}
                                </p>
                              ))}
                            </div>
                          </section>
                          <section className="study-exam-artifact rounded-3xl border border-slate-200 bg-white/74 p-5">
                            <p className="agentify-label">5 marks</p>
                            <div className="mt-4 space-y-3">
                              {fiveMarkQuestions.map((question) => (
                                <p key={question.id} className="rounded-2xl border border-slate-200 bg-white/74 p-4 text-sm leading-6 text-slate-700">
                                  {question.question}
                                  {question.source ? <span className="mt-2 block text-xs font-semibold text-slate-500">Source: {question.source}</span> : null}
                                </p>
                              ))}
                            </div>
                          </section>
                        </div>
                      </div>
                    ) : (
                      <EmptyState
                        icon="book"
                        title="No probable questions yet"
                        detail="Generate an exam pack to prepare likely 3-mark and 5-mark theory questions."
                      />
                    )
                  ) : null}

                  {activeExamPanel === "practice" ? (
                    examQuestions.length ? (
                      <div className="grid gap-4 lg:grid-cols-2">
                        {examQuestions.map((question, index) => (
                          <article key={`practice-${question.id}`} className="study-exam-artifact rounded-3xl border border-slate-200 bg-white/74 p-5">
                            <div className="flex items-center justify-between gap-3">
                              <p className="agentify-label">Practice {index + 1}</p>
                              <span className="agentify-chip">Try first</span>
                            </div>
                            <p className="mt-4 text-base font-semibold leading-7 text-slate-900">{question.question}</p>
                            {question.source ? <p className="mt-2 text-xs font-semibold text-slate-500">Source: {question.source}</p> : null}
                            <p className="mt-3 text-sm leading-6 text-slate-500">
                              Write your answer in rough work first. Then open MCQs or Review to compare with the options and explanation.
                            </p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        icon="study"
                        title="Practice drills need an exam pack"
                        detail="Generate MCQs once, then this area becomes a clean practice-question workspace."
                      />
                    )
                  ) : null}

                  {activeExamPanel === "review" ? (
                    examSubmitted ? (
                      <div className="space-y-5">
                        <section className="study-exam-artifact rounded-3xl border border-slate-200 bg-white/74 p-5">
                          <p className="agentify-label">Score</p>
                          <div className="mt-4 flex items-end gap-2">
                            <span className="text-5xl font-semibold text-slate-950">{examScore}</span>
                            <span className="pb-2 text-sm text-slate-500">/ {examQuestions.length}</span>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-500">
                            {examScore >= 4 ? "Strong. Move to probable theory answers next." : "Good diagnostic. Revise the weak points and try one more set."}
                          </p>
                        </section>
                        <div className="grid gap-4 lg:grid-cols-2">
                          {examQuestions.map((question) => {
                            const selected = examAnswers[question.id] || "not answered";
                            const correct = selected === question.correct;
                            return (
                              <article key={`review-${question.id}`} className={`rounded-3xl border p-5 ${correct ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/70"}`}>
                                <p className={`text-xs font-black uppercase tracking-[0.16em] ${correct ? "text-emerald-700" : "text-amber-700"}`}>
                                  {correct ? "Correct" : "Needs review"}
                                </p>
                                <p className="mt-3 text-sm font-semibold leading-6 text-slate-900">{question.question}</p>
                                {question.source ? <p className="mt-2 text-xs font-semibold text-slate-500">Source: {question.source}</p> : null}
                                <p className="mt-3 text-sm leading-6 text-slate-700">
                                  Your answer: {selected}. Correct answer: {question.correct}.
                                </p>
                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                  {question.explanation || "Check the exact keyword in the question, then match it with the core concept."}
                                </p>
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <EmptyState
                        icon="analytics"
                        title="Submit MCQs to unlock review"
                        detail="Answer all generated MCQs and submit once. This area will show score, mistakes, and explanations."
                      />
                    )
                  ) : null}
                </div>
              </section>
            </div>
          </div>
        ) : null}

        {mode === "history" ? (
          <div className="study-mode-fullscreen flex min-h-0 flex-1 flex-col overflow-hidden p-0">
            <div className="study-focus-workspace flex min-h-0 flex-1 flex-col gap-4">
              <div className="study-focus-toolbar rounded-[1.7rem] border border-white/60 bg-white/76 p-3 shadow-[0_18px_54px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0E7490]">Conversation history</p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-950">Continue any previous doubt</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {conversations.length} saved conversations sync with your learning profile when the backend is available.
                    </p>
                  </div>
                  <IconButton
                    label="Start fresh study chat"
                    icon="plus"
                    onClick={startNewChat}
                    className="border-[#0E7490] bg-[#0E7490] px-5 py-3 text-white hover:border-[#0B5F76] hover:bg-[#0B5F76] hover:text-white"
                  >
                    Start fresh chat
                  </IconButton>
                </div>
              </div>

              <section className="study-content-card study-focus-panel flex min-h-0 flex-1 flex-col rounded-[2rem] border border-white/60 bg-white/84 p-5 shadow-[0_20px_64px_rgba(15,23,42,0.10)] backdrop-blur-2xl">
                <div className="study-scroll-pane min-h-0 flex-1 overflow-y-auto rounded-3xl border border-slate-200 bg-white/70 p-5">
                  <div className="grid gap-3">
                    {conversations.length ? (
                      conversations.map((conversation) => (
                        <button
                          key={conversation.id}
                          type="button"
                          onClick={() => resumeConversation(conversation)}
                          className="rounded-3xl border border-slate-200 bg-white/74 p-4 text-left transition hover:-translate-y-0.5 hover:border-[#0E7490]/25 hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)]"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="truncate text-base font-semibold text-slate-900">{conversation.title}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                                {conversation.chapter} / {conversation.topic}
                              </p>
                            </div>
                            <div className="flex gap-2 text-xs text-slate-500">
                              <span>{conversation.messages.length} messages</span>
                              <span>
                                {new Date(conversation.updatedAt).toLocaleString([], {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <EmptyState
                        icon="history"
                        title="No study history yet"
                        detail="Ask your first question in Coach mode. It will be saved here automatically."
                      />
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
