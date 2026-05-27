"use client";

import { useAuth } from "@/context/AuthContext";
import {
  AlertState,
  AppIcon,
  EmptyState,
  IconButton,
  LoadingState,
  type AppIconName,
} from "@/components/ui/Polished";
import { useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
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

interface CoachMessage {
  role: CoachRole;
  content: string;
  timestamp: string;
}

interface StudyConversation {
  id: string;
  title: string;
  updatedAt: string;
  chapter: string;
  topic: string;
  messages: CoachMessage[];
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
  source: string;
  section_id: string;
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
    title: "Simple Notes",
    detail: "A clean revision note from the selected chapter data.",
    mode: "summary",
    prompt: (topic) => `Create simple revision notes for ${topic} from the selected study material only.`,
  },
  {
    id: "explain",
    title: "Deep Explain",
    detail: "A deeper teacher-style explanation while staying grounded in the material.",
    mode: "explain",
    prompt: (topic) => `Deeply explain ${topic} from the selected study material only, with examples if available in the data.`,
  },
  {
    id: "keypoints",
    title: "Key Points",
    detail: "High-yield recall bullets for fast exam revision.",
    mode: "keypoints",
    prompt: (topic) => `Extract the most important key points for ${topic} from the selected study material only.`,
  },
];

const ARTIFACT_TABS: Array<{ id: ArtifactType; label: string; icon: AppIconName }> = [
  { id: "concept_map", label: "Map", icon: "mission" },
  { id: "flip_cards", label: "Cards", icon: "copy" },
  { id: "formula_lab", label: "Formula", icon: "analytics" },
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
  { id: "revision", label: "Revision", detail: "Open notes, explanations, key points, and artifacts.", icon: "book" },
  { id: "exam", label: "Exam", detail: "Generate grounded MCQs and probable questions.", icon: "check" },
  { id: "history", label: "History", detail: "Review saved Study Lab conversations.", icon: "history" },
];

const STAGE_ORDER: AgentStageId[] = ["received", "understanding", "drafting", "reviewing", "formatting", "delivering"];

const STAGE_ICONS: Record<AgentStageId, AppIconName> = {
  received: "study",
  understanding: "analytics",
  drafting: "study",
  reviewing: "check",
  formatting: "copy",
  delivering: "send",
};

function normalizeTopicValue(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function findChapterValueForTopic(topicValue: string) {
  const normalizedTopic = normalizeTopicValue(topicValue);
  return CHAPTERS.find((chapter) => chapter.topics.some((item) => item.value === normalizedTopic))?.value || "";
}

const MATERIAL_NOT_FOUND_MESSAGE = "I could not find this in your study material. Please upload or select the correct chapter/data.";

const DATA_GROUNDED_TUTOR_GUARDRAIL = [
  "You are AgentifyAI's study tutor working inside a data-grounded learning app.",
  "Use only the uploaded or ingested study material, selected subject, selected chapter, selected topic, and retrieved context supplied by the backend.",
  "Do not use outside knowledge, generic LLM memory, or guesses.",
  "If the retrieved context does not contain the answer, reply exactly: I could not find this in your study material. Please upload or select the correct chapter/data.",
  "Preserve conversation continuity. Follow-up words like this, it, explain again, simplify, more examples, and simple words refer to the previous user question and previous tutor answer unless the student clearly changes topic.",
  "Never switch topic unless the student clearly asks for a new topic.",
  "Keep answers exam-focused, clear, and traceable to the study material.",
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

function buildGroundedTutorMessage(prompt: string, history: CoachMessage[], topicLabel: string, chapterLabel: string) {
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
      "The student is asking a follow-up. Preserve the previous topic and do not switch topics.",
      `Current follow-up: ${prompt}`,
      previous.previousQuestion ? `Previous user question: ${previous.previousQuestion}` : "",
      previous.previousAnswer ? `Previous tutor answer: ${previous.previousAnswer.slice(0, 1400)}` : "",
      `Selected chapter/topic: ${chapterLabel} / ${topicLabel}`,
      "Answer the follow-up only from retrieved study material. If retrieval does not support the previous topic, use the required not-found message.",
    ].filter(Boolean).join("\n"),
    isFollowUp: true,
    previousQuestion: previous.previousQuestion,
    previousAnswer: previous.previousAnswer,
    anchorTerms: previous.anchorTerms,
  };
}

function answerDriftedFromFollowUp(answer: string, anchorTerms: string[]) {
  if (!answer || !anchorTerms.length || answer === MATERIAL_NOT_FOUND_MESSAGE) return false;
  const lower = answer.toLowerCase();
  const hasAnchor = anchorTerms.some((term) => lower.includes(term));
  if (hasAnchor) return false;

  const knownFallbackTopicWords = [
    "matter", "solid", "liquid", "gas", "states of matter", "mass", "volume",
    "alkane", "alkene", "alkyne", "hydrocarbon", "aromatic",
  ];
  return knownFallbackTopicWords.some((term) => lower.includes(term));
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
    DATA_GROUNDED_TUTOR_GUARDRAIL,
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
  return ARTIFACT_TABS.find((tab) => artifactHasContent(getArtifactByType(response, tab.id)))?.id || "concept_map";
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
      agent: "Study Desk",
      title: "Question received",
      detail: "Your doubt enters the tutor workspace.",
      status: "pending",
    },
    {
      id: "understanding",
      agent: "Learning Profiler",
      title: "Understanding need",
      detail: "Mapping intent, level, confidence, and follow-up context.",
      status: "pending",
    },
    {
      id: "drafting",
      agent: "Adaptive Mentor",
      title: "Drafting answer",
      detail: "Building the first explanation around the selected teaching route.",
      status: "pending",
    },
    {
      id: "reviewing",
      agent: "Strategy Tutor",
      title: "Refining explanation",
      detail: "Checking clarity, accuracy, depth, and student friendliness.",
      status: "pending",
    },
    {
      id: "formatting",
      agent: "Response Designer",
      title: "Formatting response",
      detail: "Turning the answer into a clean study format.",
      status: "pending",
    },
    {
      id: "delivering",
      agent: "Tutor Voice",
      title: "Delivering answer",
      detail: "Sending the final response into the chat.",
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

const CHEMICAL_ELEMENTS = new Set([
  "H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne", "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar", "K", "Ca",
  "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn", "Ga", "Ge", "As", "Se", "Br", "Kr", "Rb", "Sr",
  "Y", "Zr", "Nb", "Mo", "Tc", "Ru", "Rh", "Pd", "Ag", "Cd", "In", "Sn", "Sb", "Te", "I", "Xe", "Cs", "Ba",
  "La", "Ce", "Pr", "Nd", "Pm", "Sm", "Eu", "Gd", "Tb", "Dy", "Ho", "Er", "Tm", "Yb", "Lu", "Hf", "Ta", "W",
  "Re", "Os", "Ir", "Pt", "Au", "Hg", "Tl", "Pb", "Bi", "Po", "At", "Rn", "Fr", "Ra", "Ac", "Th", "Pa", "U",
  "Np", "Pu", "Am", "Cm", "Bk", "Cf", "Es", "Fm", "Md", "No", "Lr", "Rf", "Db", "Sg", "Bh", "Hs", "Mt",
  "Ds", "Rg", "Nh", "Fl", "Mc", "Lv", "Ts", "Og",
]);

const CHEMICAL_ELEMENT_PATTERN = Array.from(CHEMICAL_ELEMENTS).sort((left, right) => right.length - left.length).join("|");

const SUBSCRIPT_TEXT: Record<string, string> = {
  "\u2080": "0",
  "\u2081": "1",
  "\u2082": "2",
  "\u2083": "3",
  "\u2084": "4",
  "\u2085": "5",
  "\u2086": "6",
  "\u2087": "7",
  "\u2088": "8",
  "\u2089": "9",
  "\u2099": "n",
  "\u208A": "+",
  "\u208B": "-",
};

function normalizeSubscriptGlyphs(value: string) {
  return value.replace(/[\u2080-\u2089\u2099\u208A\u208B]/g, (char) => SUBSCRIPT_TEXT[char] || char);
}

function renderInlineChemistry(value: string) {
  const subscriptPattern = "(?:\\d*n(?:[+-]\\d+)?|n|\\d+|[\\u2080-\\u2089\\u2099\\u208A\\u208B]+)";
  const atomPattern = `(?:${CHEMICAL_ELEMENT_PATTERN})(?:${subscriptPattern})?`;
  const formulaCandidate = `sp\\d+|[a-zA-Z]\\^-?\\d+|(?:${atomPattern}){2,}(?:\\^[+-]?\\d+|\\^[+-])?|(?:${CHEMICAL_ELEMENT_PATTERN})${subscriptPattern}(?:\\^[+-]?\\d+|\\^[+-])?|(?:${CHEMICAL_ELEMENT_PATTERN})(?:\\^[+-]?\\d+|\\^[+-])`;
  const tokenRegex = new RegExp(`(?<![A-Za-z])(${formulaCandidate})(?![A-Za-z])`, "g");
  const atomRegex = new RegExp(`^(${CHEMICAL_ELEMENT_PATTERN})(\\d*n(?:[+-]\\d+)?|n|\\d+)?`);
  const pieces = value.split(tokenRegex);

  return pieces.map((piece, index) => {
    if (!piece) return null;
    const normalizedPiece = normalizeSubscriptGlyphs(piece);

    const sp = normalizedPiece.match(/^sp(\d+)$/);
    if (sp) {
      return (
        <span key={index} className="study-formula-token">
          sp<sup>{sp[1]}</sup>
        </span>
      );
    }

    const variablePower = normalizedPiece.match(/^([a-zA-Z])\^(-?\d+)$/);
    if (variablePower) {
      return (
        <span key={index} className="study-formula-token">
          {variablePower[1]}<sup>{variablePower[2]}</sup>
        </span>
      );
    }

    const chargeMatch = normalizedPiece.match(/^(.+)\^([+-]?\d+|[+-])$/);
    const formula = chargeMatch ? chargeMatch[1] : normalizedPiece;
    const charge = chargeMatch ? chargeMatch[2] : null;
    const atoms: Array<{ symbol: string; subscript: string }> = [];
    let cursor = 0;

    while (cursor < formula.length) {
      const match = formula.slice(cursor).match(atomRegex);
      if (!match || !CHEMICAL_ELEMENTS.has(match[1])) break;
      atoms.push({ symbol: match[1], subscript: match[2] || "" });
      cursor += match[0].length;
    }

    const hasSubscript = atoms.some((atom) => atom.subscript);
    const isFormula = cursor === formula.length && atoms.length > 0 && (atoms.length > 1 || hasSubscript || Boolean(charge));

    if (!isFormula) {
      return <span key={index}>{normalizedPiece}</span>;
    }

    return (
      <span key={index} className="study-formula-token">
        {atoms.map((atom, atomIndex) => (
          <span key={`${index}-${atomIndex}`}>
            {atom.symbol}
            {atom.subscript ? <sub>{atom.subscript}</sub> : null}
          </span>
        ))}
        {charge ? <sup>{charge}</sup> : null}
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

function CoachAnswer({ value, streaming = false }: { value: string; streaming?: boolean }) {
  const blocks = value.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  if (!blocks.length) return null;

  return (
    <div className="study-answer-flow">
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        const firstLine = lines[0] || "";
        const markdownHeading = firstLine.match(/^#{1,6}\s+(.*)$/);
        const heading = markdownHeading
          ? markdownHeading[1]
          : firstLine.endsWith(":") && firstLine.length <= 72
            ? firstLine.replace(/:$/, "")
            : null;
        const body = heading ? lines.slice(1) : lines;

        return (
          <section key={`${heading || "answer"}-${blockIndex}`} className="study-answer-text-block">
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
          <p className="text-sm font-semibold text-slate-900">Building interactive artifact</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Mapping chapter data into visuals, cards, formulas, and traps.</p>
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
  const selectedTab = availableTabs.some((tab) => tab.id === activeTab) ? activeTab : availableTabs[0]?.id || "concept_map";
  const artifact = getArtifactByType(response, selectedTab);
  const mapCount = getArtifactByType(response, "concept_map")?.nodes?.length || 0;
  const cardCount = getArtifactByType(response, "flip_cards")?.cards?.length || 0;
  const formulaCount = getArtifactByType(response, "formula_lab")?.formulas?.length || 0;
  const mistakeCount = getArtifactByType(response, "mistake_cards")?.mistakes?.length || 0;
  const activeLabel = ARTIFACT_TABS.find((tab) => tab.id === selectedTab)?.label || "Artifact";

  if (!artifact) {
    return <ArtifactEmptyNote detail="Artifact data could not be prepared for this topic." />;
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
        {response.student_goal ? <p className="mt-4 text-xs leading-5 text-slate-500">{renderInlineChemistry(readableArtifactText(response.student_goal))}</p> : null}
        <div className="study-artifact-metrics">
          <span>
            <strong>{mapCount}</strong>
            <small>nodes</small>
          </span>
          <span>
            <strong>{cardCount}</strong>
            <small>cards</small>
          </span>
          <span>
            <strong>{formulaCount}</strong>
            <small>formula</small>
          </span>
          <span>
            <strong>{mistakeCount}</strong>
            <small>traps</small>
          </span>
        </div>
        <div className="study-artifact-checklist" aria-label="Artifact quality signals">
          <span><AppIcon name="check" /> {response.quality?.key_points || 0} key points</span>
          <span><AppIcon name="check" /> {response.quality?.formulas || 0} formulas</span>
          <span><AppIcon name="check" /> {response.quality?.mistakes || 0} mistakes</span>
        </div>
      </aside>

      <div className="study-artifact-tabs" role="tablist" aria-label="Interactive artifact views">
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
          {isComplete ? "Tutor flow complete" : `${activeStage.agent} / ${activeStage.title}`}
        </span>
        {!compact && !isComplete ? <span className="study-inline-activity-detail">{activeStage.detail}</span> : null}
      </span>
    </div>
  );
}

function AgentPipeline({ stages }: { stages: AgentStageState[] }) {
  const activeStage =
    stages.find((stage) => stage.status === "active") ||
    stages.find((stage) => stage.status === "pending") ||
    stages[stages.length - 1];
  const completedCount = stages.filter((stage) => stage.status === "done").length;
  const progress = Math.round((completedCount / Math.max(1, stages.length)) * 100);
  const isComplete = completedCount === stages.length;

  return (
    <div className="study-agent-pipeline w-full overflow-hidden rounded-[1.35rem] border border-slate-200/60 bg-white/58 px-4 py-3 shadow-[0_14px_46px_rgba(15,23,42,0.06)] backdrop-blur-2xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`study-live-orb mt-1 ${isComplete ? "is-complete" : ""}`}>
            <AppIcon name={isComplete ? "check" : STAGE_ICONS[activeStage.id]} className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0E7490]">
                {isComplete ? "Tutor flow complete" : "Tutor thinking"}
              </span>
              <span className="study-live-pill">{isComplete ? "Ready" : "Live"}</span>
            </div>
            <p className="study-live-line mt-1 text-sm font-semibold leading-6 text-slate-900">
              <span className="text-slate-500">{activeStage.agent}</span>
              <span className="px-1.5 text-slate-300">/</span>
              <span>{activeStage.title}</span>
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">{activeStage.detail}</p>
          </div>
        </div>
        <div className="min-w-[160px] md:text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            {completedCount}/{stages.length} complete
          </p>
          <div className="study-live-progress mt-2">
            <span style={{ width: `${Math.max(isComplete ? 100 : 10, progress)}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {stages.map((stage, index) => {
          const active = stage.status === "active";
          const done = stage.status === "done";
          return (
            <span
              key={stage.id}
              title={`${stage.agent}: ${stage.title}`}
              className={`study-agent-chip ${active ? "is-active" : ""} ${done ? "is-done" : ""}`}
            >
              <span className="study-agent-dot">
                {done ? <AppIcon name="check" className="h-3 w-3" /> : index + 1}
              </span>
              <span className="whitespace-nowrap">{stage.agent}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function AgentActivitySummary({
  stages,
  expanded,
  onToggle,
}: {
  stages: AgentStageState[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const completedCount = stages.filter((stage) => stage.status === "done").length;
  const allDone = completedCount === stages.length;
  const activeStage =
    stages.find((stage) => stage.status === "active") ||
    stages.find((stage) => stage.status === "pending") ||
    stages[stages.length - 1];

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={onToggle}
        className="study-agent-summary flex w-full items-center justify-between gap-3 rounded-[1.25rem] border border-slate-200/60 bg-white/56 px-4 py-3 text-left shadow-[0_12px_38px_rgba(15,23,42,0.05)] backdrop-blur-2xl transition hover:border-[#0E7490]/24 hover:bg-white/76"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className={`study-live-orb ${allDone ? "is-complete" : ""}`}>
            <AppIcon name={allDone ? "check" : STAGE_ICONS[activeStage.id]} className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-900">
              {allDone ? "Tutor flow finished" : `${activeStage.agent} is ${activeStage.title.toLowerCase()}`}
            </span>
            <span className="mt-0.5 block truncate text-xs text-slate-500">
              {expanded ? "Hide process details" : "View process details"}
            </span>
          </span>
        </span>
        <span className="rounded-full border border-slate-200/70 bg-white/60 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
          {expanded ? "Hide" : `${completedCount}/${stages.length}`}
        </span>
      </button>
      {expanded ? <div className="mt-3"><AgentPipeline stages={stages} /></div> : null}
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

function StudentPromptCard({ content, timestamp }: { content: string; timestamp: string }) {
  return (
    <div className="flex justify-end">
      <article className="study-user-message max-w-[760px] rounded-[1.55rem] rounded-tr-md bg-[linear-gradient(135deg,#0F172A,#0E7490)] px-5 py-4 text-white shadow-[0_20px_54px_rgba(14,116,144,0.20)]">
        <div className="study-user-message-meta mb-2 flex items-center justify-end gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/66">
          <span>You</span>
          {timestamp ? <span>{timestamp}</span> : null}
        </div>
        <p className="whitespace-pre-wrap text-[15px] leading-7 text-white/95">{content}</p>
      </article>
    </div>
  );
}

function TutorActionDock({
  answer,
  canRegenerate,
  onPrompt,
  onRegenerate,
}: {
  answer: string;
  canRegenerate: boolean;
  onPrompt: (prompt: string) => void;
  onRegenerate: () => void;
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
        </div>
      ) : null}
    </div>
  );
}

function TutorResponseCard({
  coachName,
  content,
  timestamp,
  topicLabel,
  stages,
  showActivity,
  activityCollapsed,
  streaming,
  canRegenerate,
  onPrompt,
  onRegenerate,
}: {
  coachName: string;
  content: string;
  timestamp: string;
  topicLabel: string;
  stages: AgentStageState[];
  showActivity: boolean;
  activityCollapsed: boolean;
  streaming: boolean;
  canRegenerate: boolean;
  onPrompt: (prompt: string) => void;
  onRegenerate: () => void;
}) {
  const pending = !content.trim();

  return (
    <div className="flex justify-start">
      <div className="study-message-row grid w-full grid-cols-[40px_minmax(0,1fr)] gap-3 sm:grid-cols-[44px_minmax(0,1fr)]">
        <div className="study-message-avatar flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0F172A,#0E7490,#14B8A6)] text-sm font-black text-white shadow-[0_18px_45px_rgba(14,116,144,0.20)] sm:h-11 sm:w-11">
          {coachName[0]}
        </div>
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

            {pending ? (
              <div className="study-stream-placeholder flex items-center gap-2 px-1 py-3 text-sm font-medium text-slate-500">
                <span className="study-typing-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <span>{coachName} is preparing your answer</span>
              </div>
            ) : (
              <>
                <div className="study-answer-stream">
                  <CoachAnswer value={content} streaming={streaming} />
                </div>
                {!streaming ? (
                  <TutorActionDock
                    answer={content}
                    canRegenerate={canRegenerate}
                    onPrompt={onPrompt}
                    onRegenerate={onRegenerate}
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
      onClick={onClick}
      title={detail}
      className={`study-mode-button inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-left text-sm font-semibold transition ${
        active
          ? "bg-white text-[#0E7490] shadow-[0_10px_26px_rgba(14,116,144,0.10)]"
          : "text-slate-500 hover:bg-white/70 hover:text-slate-900"
      }`}
    >
      <span className={`study-mode-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${active ? "bg-[#0E7490] text-white" : "bg-slate-100 text-slate-500"}`}>
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

export default function StudyPage() {
  const { user, userId, authLoading, loading, getAuthHeaders } = useAuth() as ReturnType<typeof useAuth> & { authLoading?: boolean };
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
  const [currentConversationId, setCurrentConversationId] = useState(createConversationId);
  const [input, setInput] = useState("");
  const [loadingAnswer, setLoadingAnswer] = useState(false);
  const [stages, setStages] = useState(createStages);
  const [showPipeline, setShowPipeline] = useState(false);
  const [showAgentSummary, setShowAgentSummary] = useState(false);
  const [agentSummaryExpanded, setAgentSummaryExpanded] = useState(false);
  const [activityCollapsed, setActivityCollapsed] = useState(false);
  const [error, setError] = useState("");
  const [revisionContent, setRevisionContent] = useState<Record<RevisionType, string>>({ summary: "", explain: "", keypoints: "" });
  const [revisionLoading, setRevisionLoading] = useState<Record<RevisionType, boolean>>({ summary: false, explain: false, keypoints: false });
  const [revisionError, setRevisionError] = useState("");
  const [artifact, setArtifact] = useState<StudyArtifactResponse | null>(null);
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [artifactError, setArtifactError] = useState("");
  const [activeArtifactTab, setActiveArtifactTab] = useState<ArtifactType>("concept_map");
  const [activeRevisionPanel, setActiveRevisionPanel] = useState<RevisionPanel>("artifact");
  const [activeExamPanel, setActiveExamPanel] = useState<ExamPanel>("mcq");
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);
  const [probableQuestions, setProbableQuestions] = useState<ProbableQuestion[]>([]);
  const [examAnswers, setExamAnswers] = useState<Record<string, string>>({});
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [examLoading, setExamLoading] = useState(false);
  const [examSaving, setExamSaving] = useState(false);
  const [examError, setExamError] = useState("");
  const [speechSupported, setSpeechSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const activityCollapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activityCollapseScheduledRef = useRef(false);

  const authBusy = loading || authLoading;
  const selectedChapter = CHAPTERS.find((item) => item.value === chapter) || CHAPTERS[0];
  const selectedTopic = selectedChapter.topics.find((item) => item.value === topic) || selectedChapter.topics[0];
  const selectedTopicValue = selectedTopic.value;
  const displayName = user?.displayName || user?.email?.split("@")[0] || "Student";
  const examScore = examQuestions.reduce((score, question) => score + (examAnswers[question.id] === question.correct ? 1 : 0), 0);
  const answeredExamCount = examQuestions.filter((question) => examAnswers[question.id]).length;
  const needsTopicPicker = mode === "revision" || mode === "exam";
  const activeRevisionTool = activeRevisionPanel === "artifact" ? null : REVISION_TOOLS.find((tool) => tool.id === activeRevisionPanel) || REVISION_TOOLS[0];
  const progressPercent = examQuestions.length ? Math.round((answeredExamCount / examQuestions.length) * 100) : 0;

  const starterPrompts = useMemo(
    () => [
      {
        label: "Explain",
        title: "Explain a concept",
        detail: "Get a simple explanation with one clear example.",
        prompt: "Teach me photosynthesis from the basics with one simple example.",
      },
      {
        label: "Doubt",
        title: "Solve a doubt",
        detail: "Ask any confusing question and get a step-by-step answer.",
        prompt: "I am confused about why objects fall at the same acceleration. Explain it simply.",
      },
      {
        label: "Practice",
        title: "Test me",
        detail: "Try one question, answer it, and get feedback.",
        prompt: "Ask me one intelligent practice question on quadratic equations, wait for my answer, then evaluate it.",
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
    setRevisionContent({ summary: "", explain: "", keypoints: "" });
    setRevisionError("");
    setActiveRevisionPanel("artifact");
    setArtifact(null);
    setArtifactError("");
    setActiveArtifactTab("concept_map");
    setExamQuestions([]);
    setProbableQuestions([]);
    setExamAnswers({});
    setExamSubmitted(false);
    setExamError("");
  }, [selectedTopicValue]);

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
    try {
      const stored = localStorage.getItem(getHistoryStorageKey(userId));
      const parsed = stored ? JSON.parse(stored) : [];
      setConversations(Array.isArray(parsed) ? parsed.slice(0, 40) : []);
    } catch {
      setConversations([]);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || !messages.length) return;
    const conversation: StudyConversation = {
      id: currentConversationId,
      title: titleFromMessages(messages),
      updatedAt: new Date().toISOString(),
      chapter: "Open tutor",
      topic: "Any subject",
      messages,
    };

    setConversations((current) => {
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
        const res = await fetch(`${backendURL}/coach/${userId}`, {
          cache: "no-store",
          headers: await getAuthHeaders(),
        });
        if (!res.ok || !active) return;
        const data = await res.json();
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

  const updateLastCoachMessage = (content: string) => {
    setMessages((current) => {
      const next = [...current];
      const last = next[next.length - 1];
      if (last?.role === "coach") {
        next[next.length - 1] = { ...last, content, timestamp: getTime() };
      }
      return next;
    });
  };

  const processSseEvent = (raw: string): StreamProcessResult => {
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
      setShowAgentSummary(true);
      setAgentSummaryExpanded(false);
      return { kind: "none" };
    }

    const answer = normalizeAnswerPayload(raw);
    if (answer) {
      const safeAnswer = isBackendFailureText(answer)
        ? MATERIAL_NOT_FOUND_MESSAGE
        : answer;
      updateLastCoachMessage(safeAnswer);
      setShowPipeline(false);
      setShowAgentSummary(true);
      setAgentSummaryExpanded(false);
      return { kind: "answer", value: safeAnswer };
    }

    return { kind: "none" };
  };

  const sendMessage = async (override?: string, options?: { fromVoice?: boolean; replaceLastAssistant?: boolean }) => {
    const prompt = (override ?? input).trim();
    if (!prompt || !userId || authBusy || loadingAnswer) return;
    const contextMessages =
      options?.replaceLastAssistant && messages[messages.length - 1]?.role === "coach"
        ? messages.slice(0, -1)
        : messages;
    const adaptiveProfile = inferMentorProfile(prompt, contextMessages);
    const groundedPrompt = buildGroundedTutorMessage(prompt, contextMessages, selectedTopic.label, selectedChapter.label);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setInput("");
    setError("");
    setLoadingAnswer(true);
    setShowPipeline(true);
    setShowAgentSummary(false);
    setAgentSummaryExpanded(false);
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
        { role: "user", content: prompt, timestamp: getTime() },
        { role: "coach", content: "", timestamp: "" },
      ];
    });

    try {
      const res = await fetch(`${backendURL}/coach/chat/stream`, {
        method: "POST",
        headers: await getAuthHeaders(),
        signal: controller.signal,
        body: JSON.stringify({
          user_id: userId,
          message: prompt,
          original_message: prompt,
          grounding_context_prompt: groundedPrompt.message,
          mode: "coach",
          intent: adaptiveProfile.intent,
          session_id: `coach-${userId}`,
          mentor_directive: buildMentorDirective(adaptiveProfile),
          system_guardrail: DATA_GROUNDED_TUTOR_GUARDRAIL,
          retrieval_required: true,
          strict_grounding: true,
          fallback_to_general_knowledge: false,
          required_not_found_response: MATERIAL_NOT_FOUND_MESSAGE,
          subject: "Chemistry",
          chapter: selectedChapter.label,
          topic: selectedTopic.label,
          section_id: selectedTopicValue,
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
            scope: "selected_study_material_only",
            selected_subject: "Chemistry",
            selected_chapter: selectedChapter.label,
            selected_topic: selectedTopic.label,
            section_id: selectedTopicValue,
            is_follow_up: groundedPrompt.isFollowUp,
            previous_user_question: groundedPrompt.previousQuestion,
            previous_ai_answer: groundedPrompt.previousAnswer,
            anchor_terms: groundedPrompt.anchorTerms,
            recent_messages: contextMessages.slice(-10),
            saved_conversations: conversations.length,
            answer_policy: "Use retrieved study material only. If unsupported, return the required not-found response.",
          },
        }),
      });

      if (!res.ok) throw new Error(`Coach failed: ${res.status}`);
      if (!res.body) {
        const text = normalizeAnswerPayload(await res.text());
        finalAnswer = text && !isBackendFailureText(text)
          ? text
          : MATERIAL_NOT_FOUND_MESSAGE;
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
        finalAnswer = MATERIAL_NOT_FOUND_MESSAGE;
        updateLastCoachMessage(finalAnswer);
      }

      if (groundedPrompt.isFollowUp && answerDriftedFromFollowUp(finalAnswer, groundedPrompt.anchorTerms)) {
        finalAnswer = MATERIAL_NOT_FOUND_MESSAGE;
        updateLastCoachMessage(finalAnswer);
      }
    } catch (caught) {
      if ((caught as Error).name !== "AbortError") {
        setError("The tutor could not verify this against your study material.");
        finalAnswer = MATERIAL_NOT_FOUND_MESSAGE;
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
    setShowAgentSummary(false);
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
    setError("");
    setShowPipeline(false);
    setShowAgentSummary(false);
    setAgentSummaryExpanded(false);
    resetActivityCollapse();
    setStages(createStages);
    setMode("coach");
  };

  const clearChat = () => {
    abortRef.current?.abort();
    if (userId) {
      setConversations((current) => {
        const next = current.filter((item) => item.id !== currentConversationId);
        localStorage.setItem(getHistoryStorageKey(userId), JSON.stringify(next));
        return next;
      });
    }
    setCurrentConversationId(createConversationId());
    setMessages([]);
    setInput("");
    setError("");
    setShowPipeline(false);
    setShowAgentSummary(false);
    setAgentSummaryExpanded(false);
    resetActivityCollapse();
    setStages(createStages);
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
    setShowAgentSummary(false);
    setAgentSummaryExpanded(false);
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
    setMode("revision");
    setActiveRevisionPanel(tool.id);
    setRevisionError("");
    setRevisionLoading((current) => ({ ...current, [tool.id]: true }));
    setRevisionContent((current) => ({ ...current, [tool.id]: "" }));
    try {
      const res = await fetch(`${backendURL}/section-ai`, {
        method: "POST",
        headers: await getAuthHeaders(),
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
      if (!res.ok) throw new Error(`Revision failed: ${res.status}`);
      const data = await safeJsonResponse(res);
      const backendAnswer = getUsableBackendAnswer(data);
      setRevisionContent((current) => ({ ...current, [tool.id]: backendAnswer || MATERIAL_NOT_FOUND_MESSAGE }));
    } catch {
      setRevisionError(MATERIAL_NOT_FOUND_MESSAGE);
      setRevisionContent((current) => ({ ...current, [tool.id]: MATERIAL_NOT_FOUND_MESSAGE }));
    } finally {
      setRevisionLoading((current) => ({ ...current, [tool.id]: false }));
    }
  };

  const generateArtifact = async () => {
    if (!userId || authBusy || artifactLoading) return;
    setMode("revision");
    setActiveRevisionPanel("artifact");
    setArtifactError("");
    setArtifact(null);
    setActiveArtifactTab("concept_map");
    setArtifactLoading(true);
    try {
      const res = await fetch(`${backendURL}/artifacts/generate`, {
        method: "POST",
        headers: await getAuthHeaders(),
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
      const data = await safeJsonResponse(res) as StudyArtifactResponse | { detail?: string } | null;
      if (!res.ok) {
        throw new Error((data as { detail?: string } | null)?.detail || `Artifact failed: ${res.status}`);
      }
      if (isUsableArtifactResponse(data)) {
        const nextArtifact = data as StudyArtifactResponse;
        setArtifact(nextArtifact);
        setActiveArtifactTab(firstArtifactTab(nextArtifact));
      } else {
        setArtifactError(MATERIAL_NOT_FOUND_MESSAGE);
      }
    } catch {
      setArtifactError(MATERIAL_NOT_FOUND_MESSAGE);
    } finally {
      setArtifactLoading(false);
    }
  };

  const generateExamPack = async () => {
    if (!userId || authBusy || examLoading) return;
    setMode("exam");
    setActiveExamPanel("mcq");
    setExamLoading(true);
    setExamError("");
    setExamSubmitted(false);
    setExamAnswers({});
    setExamQuestions([]);
    setProbableQuestions([]);
    try {
      const headers = await getAuthHeaders();
      const [mcqRes, probableRes] = await Promise.all([
        fetch(`${backendURL}/generate-mcqs`, {
          method: "POST",
          headers,
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
        fetch(`${backendURL}/generate-probable-questions`, {
          method: "POST",
          headers,
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
      if (!mcqRes.ok || !probableRes.ok) throw new Error("Exam generation failed");
      const mcqData = await safeJsonResponse(mcqRes);
      const probableData = await safeJsonResponse(probableRes);
      const sourceLabel = `${selectedChapter.label} / ${selectedTopic.label}`;
      const nextQuestions = Array.isArray(mcqData?.questions)
        ? mcqData.questions.map((question: unknown, index: number) => normalizeExamQuestion(question, index, sourceLabel)).filter((question: ExamQuestion | null): question is ExamQuestion => Boolean(question))
        : [];
      const nextProbable = Array.isArray(probableData?.questions)
        ? probableData.questions.map((question: unknown, index: number) => normalizeProbableQuestion(question, index, sourceLabel)).filter((question: ProbableQuestion | null): question is ProbableQuestion => Boolean(question))
        : [];

      if (nextQuestions.length < 5) {
        setExamError("I could not generate enough grounded MCQs from your selected study material. Please upload or select the correct chapter/data.");
        setExamQuestions([]);
        setProbableQuestions([]);
        return;
      }

      setExamQuestions(nextQuestions.slice(0, 5));
      setProbableQuestions(nextProbable);
    } catch {
      setExamError("I could not generate grounded MCQs from your selected study material. Please upload or select the correct chapter/data.");
      setExamQuestions([]);
      setProbableQuestions([]);
    } finally {
      setExamLoading(false);
    }
  };

  const submitExam = async () => {
    if (!examQuestions.length || examSubmitted) return;
    setExamSubmitted(true);
    if (!userId) return;
    setExamSaving(true);
    try {
      await fetch(`${backendURL}/submit-session`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          user_id: userId,
          topic: selectedTopic.label,
          subject: "Chemistry",
          score: examScore,
          total_questions: examQuestions.length,
          xp_earned: examScore * 10,
          time_spent_seconds: 300,
          focus_score: Math.round((examScore / Math.max(1, examQuestions.length)) * 100),
          session_type: "study_exam",
          replay_data: {
            topic: selectedTopic.label,
            source: "study_page_exam",
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
      });
    } catch {
      setExamError("Feedback is ready, but the session could not be saved.");
    } finally {
      setExamSaving(false);
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
    const canSend = Boolean(input.trim()) || loadingAnswer;

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
              <button
                type="button"
                onClick={() => setMode("revision")}
                className="study-chat-pill"
              >
                <AppIcon name="book" className="h-3.5 w-3.5" />
                <span>Revision</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("exam")}
                className="study-chat-pill"
              >
                <AppIcon name="check" className="h-3.5 w-3.5" />
                <span>Exam</span>
              </button>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={listening ? stopVoiceInput : startVoiceInput}
                disabled={!speechSupported || loadingAnswer}
                title={listening ? "Stop voice input" : "Start voice input"}
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
                className={`agentify-action study-chat-send-button disabled:cursor-not-allowed ${
                  loadingAnswer
                    ? "border border-rose-200 bg-rose-50 text-rose-600 hover:border-rose-300 hover:bg-rose-100"
                    : input.trim()
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
    <div className="study-lab-shell flex h-full min-h-0 w-full flex-col overflow-hidden bg-white/70 backdrop-blur-2xl">
      <section className="study-lab-header border-b border-white/45 bg-white/64 px-3 py-2.5 backdrop-blur-2xl sm:px-5">
        <div data-mode={mode} className="study-workspace-bar flex w-full flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="study-workspace-identity flex min-w-0 items-center gap-3">
            <span className="study-workspace-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0F172A,#0E7490,#14B8A6)] text-sm font-black text-white shadow-[0_18px_42px_rgba(14,116,144,0.18)]">
              A
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">
                {mode === "coach" ? `AI Tutor with ${coachName}` : mode === "revision" ? "Revision Workspace" : mode === "exam" ? "Exam Workspace" : "Study History"}
              </p>
              <p className="truncate text-[11px] font-medium text-slate-500">
                {mode === "coach"
                  ? "Full-screen chat workspace"
                  : mode === "history"
                    ? `${conversations.length} saved conversations`
                    : `${selectedChapter.label} / ${selectedTopic.label}`}
              </p>
            </div>
          </div>

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
                    setActiveRevisionPanel("artifact");
                  }
                }}
              />
            ))}
          </div>

          <div className="study-header-actions flex flex-col gap-2 lg:flex-row lg:items-center">
            {needsTopicPicker ? (
              <div className="study-topic-strip flex min-w-0 flex-col gap-2 rounded-2xl border border-slate-200/70 bg-white/58 p-1.5 sm:flex-row">
                <select
                  value={selectedChapter.value}
                  aria-label="Chapter"
                  onChange={(event) => {
                    const next = event.target.value;
                    setChapter(next);
                    setTopic(CHAPTERS.find((item) => item.value === next)?.topics[0]?.value || "alkanes");
                  }}
                  className="study-select min-h-10 rounded-xl border border-transparent bg-white/75 px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#0E7490]"
                >
                  {CHAPTERS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedTopicValue}
                  aria-label="Topic"
                  onChange={(event) => setTopic(event.target.value)}
                  className="study-select min-h-10 rounded-xl border border-transparent bg-white/75 px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#0E7490]"
                >
                  {selectedChapter.topics.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="flex gap-2">
              <IconButton
                label="Start a new chat"
                icon="plus"
                onClick={startNewChat}
                className="min-h-10 rounded-xl bg-white/78 px-3 py-2 text-slate-700"
              >
                New
              </IconButton>
              <IconButton
                label="Clear current chat"
                icon="trash"
                onClick={clearChat}
                disabled={!messages.length}
                className="min-h-10 rounded-xl border-rose-200 bg-rose-50 px-3 py-2 text-rose-600 hover:border-rose-300 hover:bg-rose-100"
              >
                Clear
              </IconButton>
            </div>
          </div>
        </div>
      </section>

      <section className="study-lab-main flex min-h-0 flex-1 flex-col">
        {mode === "coach" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="study-chat-scroll flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
              {messages.length === 0 ? (
                <div className="study-empty-state study-chat-landing flex min-h-[68svh] w-full flex-col items-center justify-center text-center">
                  <div className="study-chat-orb">
                    {coachName[0]}
                  </div>
                  <h2 className="mt-6 text-3xl font-semibold text-slate-950 sm:text-5xl">
                    What should we learn today?
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
                    Ready when you are, {displayName.split(" ")[0]}. Ask a doubt, request a simple explanation, or prepare for an exam.
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
                <div className="w-full space-y-6">
                  {messages.map((message, index) => {
                    const isLatestMessage = index === messages.length - 1;

                    return message.role === "user" ? (
                      <StudentPromptCard
                        key={`${message.role}-${index}`}
                        content={message.content}
                        timestamp={message.timestamp}
                      />
                    ) : (
                      <TutorResponseCard
                        key={`${message.role}-${index}`}
                        coachName={coachName}
                        content={message.content}
                        timestamp={message.timestamp}
                        topicLabel="Open tutor"
                        stages={stages}
                        showActivity={showPipeline && isLatestMessage}
                        activityCollapsed={activityCollapsed}
                        streaming={loadingAnswer && isLatestMessage && Boolean(message.content.trim())}
                        canRegenerate={!loadingAnswer && isLatestMessage}
                        onPrompt={setInput}
                        onRegenerate={regenerateLastAnswer}
                      />
                    );
                  })}

                  {showAgentSummary && !showPipeline ? (
                    <AgentActivitySummary
                      stages={stages}
                      expanded={agentSummaryExpanded}
                      onToggle={() => setAgentSummaryExpanded((current) => !current)}
                    />
                  ) : null}

                  <div ref={endRef} />
                </div>
              )}
            </div>

            {messages.length ? (
              <div className="study-composer border-t border-slate-200/70 bg-white/86 p-4 backdrop-blur-xl">
                {renderChatComposer("dock")}
              </div>
            ) : null}
          </div>
        ) : null}

        {mode === "revision" ? (
          <div className="study-mode-fullscreen flex min-h-0 flex-1 flex-col overflow-hidden p-0">
            <div className="study-focus-workspace flex min-h-0 flex-1 flex-col gap-4">
              <div className="study-focus-toolbar rounded-[1.7rem] border border-white/60 bg-white/76 p-3 shadow-[0_18px_54px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0E7490]">Revision canvas</p>
                    <h2 className="mt-1 text-2xl font-semibold text-slate-950">{selectedTopic.label}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-500">Open one focused workspace at a time so notes and artifacts have room to breathe.</p>
                  </div>
                  <div className="study-panel-tabs" role="tablist" aria-label="Revision workspaces">
                    {REVISION_TOOLS.map((tool) => (
                      <button
                        key={tool.id}
                        type="button"
                        role="tab"
                        aria-selected={activeRevisionPanel === tool.id}
                        onClick={() => setActiveRevisionPanel(tool.id)}
                        className={`study-panel-tab ${activeRevisionPanel === tool.id ? "is-active" : ""}`}
                      >
                        <AppIcon name={tool.id === "summary" ? "book" : tool.id === "explain" ? "study" : "copy"} className="h-3.5 w-3.5" />
                        <span>{tool.title.replace("Revision ", "")}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeRevisionPanel === "artifact"}
                      onClick={() => setActiveRevisionPanel("artifact")}
                      className={`study-panel-tab ${activeRevisionPanel === "artifact" ? "is-active" : ""}`}
                    >
                      <AppIcon name="mission" className="h-3.5 w-3.5" />
                      <span>Artifact</span>
                    </button>
                  </div>
                </div>
              </div>

              <section className={`study-content-card study-focus-panel ${activeRevisionPanel === "artifact" ? "study-artifact-focus" : ""} flex min-h-0 flex-1 flex-col rounded-[2rem] border border-white/60 bg-white/84 p-5 shadow-[0_20px_64px_rgba(15,23,42,0.10)] backdrop-blur-2xl`}>
                {activeRevisionTool ? (
                  <>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0E7490]">{activeRevisionTool.id}</p>
                        <h2 className="mt-2 text-2xl font-semibold text-slate-950">{activeRevisionTool.title}</h2>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{activeRevisionTool.detail}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
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
                    </div>

                    <div className="study-scroll-pane mt-5 min-h-0 flex-1 overflow-y-auto rounded-3xl border border-slate-200 bg-white/70 p-5">
                      {revisionLoading[activeRevisionTool.id] ? (
                        <RevisionLoadingState title={activeRevisionTool.title} />
                      ) : revisionContent[activeRevisionTool.id] ? (
                        <CoachAnswer value={revisionContent[activeRevisionTool.id]} />
                      ) : (
                        <EmptyState
                          icon="book"
                          title={`No ${activeRevisionTool.title.toLowerCase()} yet`}
                          detail={`Generate it for ${selectedTopic.label}. This full-window panel keeps the notes easier to read.`}
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0E7490]">Artifact</p>
                        <h2 className="mt-2 text-2xl font-semibold text-slate-950">Interactive Artifact</h2>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                          Visual map, tap cards, formula lab, and mistakes from your chapter data. This opens as a wide canvas so it feels like a proper study artifact.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void generateArtifact()}
                        disabled={artifactLoading}
                        className="agentify-action agentify-action-primary inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0E7490] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0B5F76] disabled:cursor-wait disabled:opacity-55"
                      >
                        <AppIcon name="spark" />
                        <span>{artifactLoading ? "Building artifact..." : "Generate Artifact"}</span>
                      </button>
                    </div>

                    {artifactError ? <div className="mt-4"><AlertState message={artifactError} /></div> : null}

                    <div className="study-scroll-pane study-artifact-scroll mt-5 min-h-0 flex-1 overflow-y-auto rounded-3xl border border-slate-200 bg-white/70 p-5">
                      {artifact ? (
                        <ArtifactViewer
                          response={artifact}
                          activeTab={activeArtifactTab}
                          onTabChange={setActiveArtifactTab}
                        />
                      ) : artifactLoading ? (
                        <ArtifactLoadingState />
                      ) : (
                        <EmptyState
                          icon="spark"
                          title="No artifact yet"
                          detail={`Generate one for ${selectedTopic.label}. It will turn notes into a student-friendly visual study tool.`}
                        />
                      )}
                    </div>
                  </>
                )}
              </section>
            </div>
            {revisionError ? <div className="mt-4 w-full px-6"><AlertState message={revisionError} /></div> : null}
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
                                                setExamAnswers((current) => ({ ...current, [question.id]: optionKey }));
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
                      {conversations.length} saved conversations are stored on this device for quick continuation.
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
