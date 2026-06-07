import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bot,
  Check,
  ChevronRight,
  ClipboardCheck,
  Download,
  Gauge,
  Globe2,
  LineChart,
  MessageSquare,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  UserCheck,
  X
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { apiGet, apiSend, downloadAdminFile } from "./api";
import {
  collaborationRounds,
  finalProposalFields,
  raterDimensions,
  roleLabels,
  roles,
  taskTopics,
  type AgentMessage,
  type Language,
  type ProbeDecision,
  type PublicProbeCard,
  type Role
} from "./shared/experiment";

// The participant-facing record never exposes the arm of each block.
type PublicBlock = {
  index: number;
  topicId: string;
  initialProposal?: Record<string, string>;
  finalProposal?: Record<string, string>;
  blockSurvey?: Record<string, unknown>;
};

type Participant = {
  id: string;
  lang: Language;
  sequenceId: string;
  blocks: PublicBlock[];
  completedAt?: string;
};

type ProposalValue = Record<string, string>;

// Linear participant flow across the two within-subjects blocks.
type Stage =
  | "landing"
  | "pre"
  | "block1-initial"
  | "block1-tutorial"
  | "block1-workspace"
  | "block1-final"
  | "block1-survey"
  | "block2-intro"
  | "block2-initial"
  | "block2-workspace"
  | "block2-final"
  | "block2-survey"
  | "final-survey"
  | "complete";

const copy = {
  zh: {
    title: "Agent 团队人格协作实验",
    subtitle: "面向 CHI 的 human-agent team 被试内研究",
    start: "开始实验",
    continue: "继续",
    saveContinue: "保存并继续",
    reset: "重置本地流程",
    language: "语言",
    analytics: "分析仪表盘",
    rater: "盲评入口",
    consent: "知情同意",
    preSurvey: "实验前问卷",
    initialProposal: "独立初稿",
    tutorial: "角色说明",
    workspace: "团队协作工作区",
    finalProposal: "最终方案",
    blockSurvey: "本轮协作问卷",
    finalSurvey: "对比问卷",
    complete: "完成",
    task: "任务",
    nextRound: "运行下一轮",
    directAsk: "定向询问",
    target: "对象",
    allAgents: "全部智能体",
    send: "发送",
    probes: "建议决策板",
    accepted: "采纳",
    rejected: "拒绝",
    questioned: "质疑",
    reframed: "改写",
    noMessages: "还没有对话。运行第一轮开始。",
    roundDone: "本轮已完成，可以提交方案。",
    loading: "智能体正在回复...",
    notes: "研究备注",
    submit: "提交",
    emptyData: "暂无数据。完成实验或添加盲评后会显示图表。",
    download: "下载数据"
  },
  en: {
    title: "Agent-Team Personality Collaboration Study",
    subtitle: "A CHI-oriented within-subjects human-agent team study",
    start: "Start",
    continue: "Continue",
    saveContinue: "Save and continue",
    reset: "Reset local flow",
    language: "Language",
    analytics: "Analytics",
    rater: "Blind Rating",
    consent: "Consent",
    preSurvey: "Pre-survey",
    initialProposal: "Initial proposal",
    tutorial: "Role tutorial",
    workspace: "Team workspace",
    finalProposal: "Final proposal",
    blockSurvey: "Collaboration survey",
    finalSurvey: "Comparison survey",
    complete: "Complete",
    task: "Task",
    nextRound: "Run next round",
    directAsk: "Directed question",
    target: "Target",
    allAgents: "All agents",
    send: "Send",
    probes: "Suggestion decision board",
    accepted: "Accept",
    rejected: "Reject",
    questioned: "Question",
    reframed: "Reframe",
    noMessages: "No conversation yet. Run round 1 to start.",
    roundDone: "This block is complete. You can submit the proposal.",
    loading: "Agents are responding...",
    notes: "Research notes",
    submit: "Submit",
    emptyData: "No data yet. Complete sessions or add blind ratings to populate charts.",
    download: "Download data"
  }
};

const roleColors: Record<Role | "user" | "system", string> = {
  coordinator: "#1f77b4",
  ideator: "#2a9d8f",
  critic: "#c2410c",
  verifier: "#6d5bd0",
  user: "#222222",
  system: "#64748b"
};

const MIN_INITIAL_CHARS = 280;
const MIN_FINAL_CHARS = 480;

function useLanguage() {
  const [lang, setLangState] = useState<Language>(() => (localStorage.getItem("lab-lang") as Language) || "zh");
  const setLang = (value: Language) => {
    localStorage.setItem("lab-lang", value);
    setLangState(value);
  };
  return [lang, setLang] as const;
}

function useSession<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : initial;
  });
  const setSessionValue = (next: T) => {
    localStorage.setItem(key, JSON.stringify(next));
    setValue(next);
  };
  const reset = () => {
    localStorage.removeItem(key);
    setValue(initial);
  };
  return [value, setSessionValue, reset] as const;
}

function t(lang: Language, key: keyof typeof copy.zh) {
  return copy[lang][key];
}

function collectBrowserInfo() {
  return {
    userAgent: navigator.userAgent,
    browserLanguage: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: { width: window.screen.width, height: window.screen.height },
    viewport: { width: window.innerWidth, height: window.innerHeight },
    devicePixelRatio: window.devicePixelRatio,
    referrer: document.referrer || null,
    path: window.location.pathname
  };
}

function proposalStats(proposal: ProposalValue) {
  return {
    totalChars: Object.values(proposal).join("").length,
    totalWords: Object.values(proposal).join(" ").trim()
      ? Object.values(proposal).join(" ").trim().split(/\s+/).length
      : 0
  };
}

function proposalQualityError(proposal: ProposalValue, lang: Language, minChars: number) {
  const missing = finalProposalFields.filter((field) => (proposal[field.key] ?? "").trim().length < 18);
  const totalChars = Object.values(proposal).join("").trim().length;
  if (missing.length) {
    const labels = missing.map((field) => lang === "zh" ? field.zh : field.en).join(lang === "zh" ? "、" : ", ");
    return lang === "zh"
      ? `请把这些字段写得更具体一些：${labels}。每个字段至少需要一句完整内容。`
      : `Please make these fields more specific: ${labels}. Each field needs at least one complete sentence.`;
  }
  if (totalChars < minChars) {
    return lang === "zh"
      ? `当前总长度约 ${totalChars} 字。请至少写到 ${minChars} 字，以便盲评。`
      : `Current total length is about ${totalChars} characters. Please write at least ${minChars} characters so raters can evaluate the proposal.`;
  }
  return "";
}

async function logClientEvent(participant: Participant | undefined, type: string, payload: Record<string, unknown>) {
  if (!participant) return;
  await apiSend("/api/events", "POST", {
    participantId: participant.id,
    type,
    payload: { ...payload, clientTime: new Date().toISOString() }
  });
}

function topicText(topicId: string | undefined, lang: Language) {
  const topic = taskTopics.find((item) => item.id === topicId) ?? taskTopics[0];
  return lang === "zh" ? topic.zh : topic.en;
}

function AppHeader({ lang, setLang, adminMode }: { lang: Language; setLang: (lang: Language) => void; adminMode: boolean }) {
  return (
    <header className="app-header">
      <a className="brand" href="/">
        <Bot size={22} />
        <span>{t(lang, "title")}</span>
      </a>
      <nav className="top-nav">
        {adminMode ? (
          <>
            <a href="/admin">{t(lang, "analytics")}</a>
            <a href="/admin/rater">{t(lang, "rater")}</a>
            <a href="/">{lang === "zh" ? "参与者入口" : "Participant study"}</a>
          </>
        ) : (
          <span className="participant-nav-note">{lang === "zh" ? "研究参与者入口" : "Participant study"}</span>
        )}
      </nav>
      <div className="language-toggle" title={t(lang, "language")}>
        <Globe2 size={16} />
        <button className={lang === "zh" ? "active" : ""} onClick={() => setLang("zh")}>中</button>
        <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>EN</button>
      </div>
    </header>
  );
}

function App() {
  const [lang, setLang] = useLanguage();
  const path = window.location.pathname;
  const adminMode = path.startsWith("/admin") || path.startsWith("/analytics") || path.startsWith("/rater");
  return (
    <>
      <AppHeader lang={lang} setLang={setLang} adminMode={adminMode} />
      {adminMode
        ? <AdminPage lang={lang} initialView={path.includes("rater") ? "rater" : "analytics"} />
        : <StudyPage lang={lang} />}
    </>
  );
}

const STAGE_ORDER: Stage[] = [
  "landing", "pre",
  "block1-initial", "block1-tutorial", "block1-workspace", "block1-final", "block1-survey",
  "block2-intro", "block2-initial", "block2-workspace", "block2-final", "block2-survey",
  "final-survey", "complete"
];

function StageRail({ stage, lang }: { stage: Stage; lang: Language }) {
  // Collapse the fine-grained stages into seven human-readable milestones.
  const milestones: Array<{ label: string; stages: Stage[] }> = [
    { label: t(lang, "preSurvey"), stages: ["pre"] },
    { label: lang === "zh" ? "第一轮协作" : "Block 1", stages: ["block1-initial", "block1-tutorial", "block1-workspace", "block1-final", "block1-survey"] },
    { label: lang === "zh" ? "第二轮协作" : "Block 2", stages: ["block2-intro", "block2-initial", "block2-workspace", "block2-final", "block2-survey"] },
    { label: t(lang, "finalSurvey"), stages: ["final-survey"] },
    { label: t(lang, "complete"), stages: ["complete"] }
  ];
  const currentIndex = STAGE_ORDER.indexOf(stage);
  return (
    <div className="stage-rail">
      {milestones.map((milestone, index) => {
        const reached = milestone.stages.some((s) => STAGE_ORDER.indexOf(s) <= currentIndex);
        return (
          <div className={`stage-pill ${reached ? "done" : ""}`} key={milestone.label}>
            <span>{index + 1}</span>
            {milestone.label}
          </div>
        );
      })}
    </div>
  );
}

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode }) {
  return (
    <button {...props} className={`primary-button ${props.className ?? ""}`}>
      {props.icon}
      <span>{props.children}</span>
    </button>
  );
}

function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode }) {
  return (
    <button {...props} className={`secondary-button ${props.className ?? ""}`}>
      {props.icon}
      <span>{props.children}</span>
    </button>
  );
}

function SliderField({ label, value, onChange, minLabel, maxLabel }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  minLabel?: string;
  maxLabel?: string;
}) {
  return (
    <label className="slider-field">
      <div className="slider-label">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <input type="range" min={1} max={7} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <div className="slider-ends">
        <span>{minLabel ?? "1"}</span>
        <span>{maxLabel ?? "7"}</span>
      </div>
    </label>
  );
}

function ProposalEditor({ lang, value, onChange }: {
  lang: Language;
  value: ProposalValue;
  onChange: (value: ProposalValue) => void;
}) {
  return (
    <div className="proposal-grid">
      {finalProposalFields.map((field) => (
        <label className="text-field" key={field.key}>
          <span>{lang === "zh" ? field.zh : field.en}</span>
          <textarea
            value={value[field.key] ?? ""}
            onChange={(event) => onChange({ ...value, [field.key]: event.target.value })}
            rows={field.key === "concept" || field.key === "evaluation" ? 5 : 3}
          />
        </label>
      ))}
    </div>
  );
}

function ConsentLanding({ lang, title, description, duration, onStart }: {
  lang: Language;
  title: string;
  description: string;
  duration: string;
  onStart: (participantCode: string) => void;
}) {
  const [checked, setChecked] = useState(false);
  const [participantCode, setParticipantCode] = useState("");
  const points = lang === "zh"
    ? [
      `预计时长：${duration}。`,
      "本研究分两轮，你将与同一组四个智能体角色协作两次，并完成相关方案与问卷。",
      "系统会记录你的方案文本、对话消息、建议采纳/拒绝、问卷回答、时间戳、响应延迟和浏览器环境信息。",
      "系统不会要求你输入真实姓名、密码、账号、成绩或其他敏感身份信息。",
      "你可以在实验中拒绝智能体建议，最终方案由你决定。",
      "如果你中途退出，研究者会按伦理审批/招募说明处理已收集数据。"
    ]
    : [
      `Estimated duration: ${duration}.`,
      "The study has two blocks; you collaborate twice with the same four agent roles and complete related proposals and surveys.",
      "The system logs proposal text, messages, suggestion decisions, survey responses, timestamps, response latency, and browser environment metadata.",
      "The system does not ask for real names, passwords, account credentials, grades, or sensitive identity information.",
      "You may reject agent suggestions; the final proposal remains your decision.",
      "If you withdraw mid-session, collected data will be handled according to the ethics/recruitment statement."
    ];
  return (
    <main className="page-shell">
      <section className="intro-band consent-band">
        <div>
          <p className="eyebrow">{t(lang, "consent")}</p>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="consent-box">
            {points.map((point) => <p key={point}>{point}</p>)}
            <label className="text-field">
              <span>{lang === "zh" ? "匿名参与者编号（可选，由招募平台或研究者提供）" : "Anonymous participant code (optional, from recruiter/platform)"}</span>
              <input value={participantCode} onChange={(event) => setParticipantCode(event.target.value)} />
            </label>
            <label className="check-row">
              <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
              <span>{lang === "zh" ? "我已阅读以上说明，并同意参加本研究。" : "I have read the information above and agree to participate in this study."}</span>
            </label>
          </div>
        </div>
        <PrimaryButton disabled={!checked} onClick={() => onStart(participantCode)} icon={<ChevronRight size={18} />}>{t(lang, "start")}</PrimaryButton>
      </section>
    </main>
  );
}

type SessionState = {
  stage: Stage;
  participant?: Participant;
  // Local working copies of proposals so reloads do not lose drafts.
  drafts: Record<string, ProposalValue>;
};

function StudyPage({ lang }: { lang: Language }) {
  const [session, setSession, resetSession] = useSession<SessionState>("study-session", { stage: "landing", drafts: {} });
  const [busy, setBusy] = useState(false);
  const participant = session.participant;

  function block(index: number) {
    return participant?.blocks.find((b) => b.index === index);
  }

  async function start(participantCode: string) {
    setBusy(true);
    try {
      const result = await apiSend<{ participant: Participant }>("/api/participants", "POST", {
        lang,
        consent: { accepted: true, acceptedAt: new Date().toISOString(), version: "within-subjects-ab-v1" },
        recruitment: { participantCode: participantCode || null, source: "local-or-study-link" },
        browserInfo: collectBrowserInfo()
      });
      await logClientEvent(result.participant, "stage_entered", { stage: "pre" });
      setSession({ stage: "pre", participant: result.participant, drafts: {} });
    } catch (error) {
      console.error(error);
      alert(lang === "zh" ? "无法连接实验服务器，请联系研究者。" : "Could not reach the study server. Please contact the researcher.");
    } finally {
      setBusy(false);
    }
  }

  function go(stage: Stage, patch?: Partial<SessionState>) {
    setSession({ ...session, ...patch, stage });
  }

  if (session.stage === "landing") {
    return (
      <ConsentLanding
        lang={lang}
        title={t(lang, "title")}
        description={lang === "zh"
          ? "你将与同一组四个角色固定的智能体协作两次。每一轮先独立写初稿，再与团队协作，最后提交方案和简短问卷。两轮使用不同的设计题目。"
          : "You collaborate twice with the same four role-fixed agents. In each block you draft a proposal, collaborate with the team, then submit a proposal and a short survey. The two blocks use different design briefs."}
        duration={lang === "zh" ? "50-60 分钟" : "50-60 minutes"}
        onStart={start}
      />
    );
  }

  return (
    <main className="page-shell">
      <StageRail stage={session.stage} lang={lang} />

      {session.stage === "pre" && (
        <SurveyPanel
          lang={lang}
          title={t(lang, "preSurvey")}
          fields={preSurveyFields(lang)}
          textFields={preSurveyTextFields(lang)}
          onSubmit={async (values) => {
            if (Number(values.attentionCheck) !== 5) {
              alert(lang === "zh" ? "请按注意力检查题要求选择 5。" : "Please select 5 for the attention check item.");
              return;
            }
            await apiSend(`/api/participants/${participant?.id}`, "PATCH", { preSurvey: values, status: "pre_completed" });
            await logClientEvent(participant, "stage_submitted", { stage: "pre" });
            go("block1-initial");
          }}
        />
      )}

      {/* ---------------- Block 1 ---------------- */}
      {session.stage === "block1-initial" && (
        <ProposalStage
          lang={lang}
          title={`${lang === "zh" ? "第一轮 · " : "Block 1 · "}${t(lang, "initialProposal")}`}
          task={topicText(block(1)?.topicId, lang)}
          value={session.drafts["b1-initial"] ?? {}}
          minChars={MIN_INITIAL_CHARS}
          onSubmit={async (proposal) => {
            await apiSend(`/api/participants/${participant?.id}`, "PATCH", { blockIndex: 1, initialProposal: proposal, status: "block_in_progress" });
            await logClientEvent(participant, "proposal_submitted", { block: 1, stage: "initial", stats: proposalStats(proposal) });
            go("block1-tutorial", { drafts: { ...session.drafts, "b1-initial": proposal } });
          }}
        />
      )}
      {session.stage === "block1-tutorial" && (
        <TutorialPanel lang={lang} onContinue={() => go("block1-workspace")} />
      )}
      {session.stage === "block1-workspace" && participant && (
        <Workspace
          lang={lang}
          participant={participant}
          blockIndex={1}
          initialProposal={session.drafts["b1-initial"] ?? {}}
          onFinish={() => go("block1-final")}
        />
      )}
      {session.stage === "block1-final" && (
        <ProposalStage
          lang={lang}
          title={`${lang === "zh" ? "第一轮 · " : "Block 1 · "}${t(lang, "finalProposal")}`}
          task={topicText(block(1)?.topicId, lang)}
          value={session.drafts["b1-final"] ?? session.drafts["b1-initial"] ?? {}}
          minChars={MIN_FINAL_CHARS}
          onSubmit={async (proposal) => {
            await apiSend(`/api/participants/${participant?.id}`, "PATCH", { blockIndex: 1, finalProposal: proposal });
            await logClientEvent(participant, "proposal_submitted", { block: 1, stage: "final", stats: proposalStats(proposal) });
            go("block1-survey", { drafts: { ...session.drafts, "b1-final": proposal } });
          }}
        />
      )}
      {session.stage === "block1-survey" && (
        <SurveyPanel
          lang={lang}
          title={`${lang === "zh" ? "第一轮 · " : "Block 1 · "}${t(lang, "blockSurvey")}`}
          fields={blockSurveyFields(lang)}
          textFields={blockSurveyTextFields(lang)}
          onSubmit={async (values) => {
            await apiSend(`/api/participants/${participant?.id}`, "PATCH", { blockIndex: 1, blockSurvey: values });
            await logClientEvent(participant, "stage_submitted", { stage: "block1-survey" });
            go("block2-intro");
          }}
        />
      )}

      {/* ---------------- Block transition ---------------- */}
      {session.stage === "block2-intro" && (
        <section className="work-panel narrow">
          <h2>{lang === "zh" ? "进入第二轮协作" : "Starting Block 2"}</h2>
          <p>{lang === "zh"
            ? "接下来是第二轮。你会与同一个四角色团队合作，但题目不同。这一次团队的协作风格可能与上一轮有所不同——请像第一轮一样自然地协作。"
            : "Next is the second block. You will work with the same four-role team on a different brief. The team's collaboration style may differ from the last block — please collaborate as naturally as you did before."}</p>
          <PrimaryButton onClick={() => go("block2-initial")} icon={<ChevronRight size={18} />}>{t(lang, "continue")}</PrimaryButton>
        </section>
      )}

      {/* ---------------- Block 2 (no tutorial repeat) ---------------- */}
      {session.stage === "block2-initial" && (
        <ProposalStage
          lang={lang}
          title={`${lang === "zh" ? "第二轮 · " : "Block 2 · "}${t(lang, "initialProposal")}`}
          task={topicText(block(2)?.topicId, lang)}
          value={session.drafts["b2-initial"] ?? {}}
          minChars={MIN_INITIAL_CHARS}
          onSubmit={async (proposal) => {
            await apiSend(`/api/participants/${participant?.id}`, "PATCH", { blockIndex: 2, initialProposal: proposal });
            await logClientEvent(participant, "proposal_submitted", { block: 2, stage: "initial", stats: proposalStats(proposal) });
            go("block2-workspace", { drafts: { ...session.drafts, "b2-initial": proposal } });
          }}
        />
      )}
      {session.stage === "block2-workspace" && participant && (
        <Workspace
          lang={lang}
          participant={participant}
          blockIndex={2}
          initialProposal={session.drafts["b2-initial"] ?? {}}
          onFinish={() => go("block2-final")}
        />
      )}
      {session.stage === "block2-final" && (
        <ProposalStage
          lang={lang}
          title={`${lang === "zh" ? "第二轮 · " : "Block 2 · "}${t(lang, "finalProposal")}`}
          task={topicText(block(2)?.topicId, lang)}
          value={session.drafts["b2-final"] ?? session.drafts["b2-initial"] ?? {}}
          minChars={MIN_FINAL_CHARS}
          onSubmit={async (proposal) => {
            await apiSend(`/api/participants/${participant?.id}`, "PATCH", { blockIndex: 2, finalProposal: proposal, status: "block_completed" });
            await logClientEvent(participant, "proposal_submitted", { block: 2, stage: "final", stats: proposalStats(proposal) });
            go("block2-survey", { drafts: { ...session.drafts, "b2-final": proposal } });
          }}
        />
      )}
      {session.stage === "block2-survey" && (
        <SurveyPanel
          lang={lang}
          title={`${lang === "zh" ? "第二轮 · " : "Block 2 · "}${t(lang, "blockSurvey")}`}
          fields={blockSurveyFields(lang)}
          textFields={blockSurveyTextFields(lang)}
          onSubmit={async (values) => {
            await apiSend(`/api/participants/${participant?.id}`, "PATCH", { blockIndex: 2, blockSurvey: values });
            await logClientEvent(participant, "stage_submitted", { stage: "block2-survey" });
            go("final-survey");
          }}
        />
      )}

      {/* ---------------- Final comparison survey ---------------- */}
      {session.stage === "final-survey" && (
        <SurveyPanel
          lang={lang}
          title={t(lang, "finalSurvey")}
          fields={finalSurveyFields(lang)}
          textFields={finalSurveyTextFields(lang)}
          onSubmit={async (values) => {
            await apiSend(`/api/participants/${participant?.id}`, "PATCH", {
              finalSurvey: values,
              completedAt: new Date().toISOString(),
              status: "completed"
            });
            await logClientEvent(participant, "stage_submitted", { stage: "final-survey" });
            go("complete");
          }}
        />
      )}

      {session.stage === "complete" && (
        <CompletionPanel
          lang={lang}
          resetSession={resetSession}
          message={lang === "zh"
            ? "实验已完成，感谢参与。说明：本研究比较了两种智能体团队风格，其中一种刻意包含了几条有缺陷的建议（如默认收集隐私数据、只用满意度评估），用于观察你如何校准依赖。请不要在真实系统中实施这些有缺陷的做法。"
            : "The study is complete. Thank you. Debrief: this study compared two agent-team styles and deliberately seeded a few flawed suggestions (e.g., collecting private data by default, satisfaction-only evaluation) to observe how you calibrate reliance. Please do not implement those flawed practices in a real system."}
        />
      )}
      {busy && <div className="floating-status">{t(lang, "loading")}</div>}
    </main>
  );
}

function preSurveyFields(lang: Language) {
  return [
    { key: "aiFamiliarity", label: lang === "zh" ? "我熟悉生成式 AI 工具" : "I am familiar with generative AI tools" },
    { key: "aiUseFrequency", label: lang === "zh" ? "我经常在学习/工作中使用生成式 AI" : "I frequently use generative AI for study or work" },
    { key: "baselineTrust", label: lang === "zh" ? "我通常信任 AI 给出的建议" : "I generally trust advice from AI systems" },
    { key: "baselineSkepticism", label: lang === "zh" ? "我通常会主动质疑 AI 生成内容" : "I usually question AI-generated content" },
    { key: "domainFamiliarity", label: lang === "zh" ? "我熟悉 AI literacy / HCI 设计任务" : "I am familiar with AI literacy / HCI design tasks" },
    { key: "creativeSelfEfficacy", label: lang === "zh" ? "我有信心提出有创意的设计方案" : "I am confident in generating creative design ideas" },
    { key: "needForCognition", label: lang === "zh" ? "我喜欢深入分析复杂问题" : "I enjoy deeply analyzing complex problems" },
    { key: "attentionCheck", label: lang === "zh" ? "注意力检查：请为本题选择 5" : "Attention check: please select 5 for this item" }
  ];
}

function preSurveyTextFields(lang: Language) {
  return [
    { key: "ageRange", label: lang === "zh" ? "年龄范围（可选，如 18-24）" : "Age range (optional, e.g., 18-24)" },
    { key: "educationOrRole", label: lang === "zh" ? "教育/职业背景（可选）" : "Education/work background (optional)" }
  ];
}

// Per-block survey: the within-block experience measures that will be contrasted between
// the neutral and specific arms.
function blockSurveyFields(lang: Language) {
  return [
    { key: "mentalDemand", label: lang === "zh" ? "这一轮任务的心理负荷很高" : "This block was mentally demanding" },
    { key: "temporalDemand", label: lang === "zh" ? "我感到时间压力很高" : "I felt high time pressure" },
    { key: "effort", label: lang === "zh" ? "完成这一轮需要很多努力" : "Completing this block required a lot of effort" },
    { key: "frustration", label: lang === "zh" ? "这一轮协作让我感到挫败" : "This block felt frustrating" },
    { key: "roleClarity", label: lang === "zh" ? "我能清楚分辨每个智能体负责什么" : "I could tell what each agent was responsible for" },
    { key: "askRightAgent", label: lang === "zh" ? "我知道应该向哪个智能体询问哪类问题" : "I knew which agent to ask for which kind of help" },
    { key: "interpretDisagreement", label: lang === "zh" ? "我能理解智能体之间的分歧" : "I could interpret disagreements among agents" },
    { key: "styleRoleFit", label: lang === "zh" ? "每个智能体的表达风格符合它的角色" : "Each agent's communication style fit its role" },
    { key: "constructiveConflict", label: lang === "zh" ? "智能体之间的分歧帮助我改进方案" : "Disagreements among agents helped me improve the proposal" },
    { key: "critiqueUseful", label: lang === "zh" ? "批评性意见是有用的，而不是阻碍性的" : "Critical comments were useful rather than obstructive" },
    { key: "trustTeam", label: lang === "zh" ? "我信任这个团队能帮助我完成任务" : "I trusted this team to help me complete the task" },
    { key: "overRelianceConcern", label: lang === "zh" ? "我担心自己过度依赖了智能体建议" : "I worry that I over-relied on agent suggestions" },
    { key: "feltPushed", label: lang === "zh" ? "我觉得被智能体推向某个方向" : "I felt pushed toward the agents' preferred direction" },
    { key: "tooForceful", label: lang === "zh" ? "有些智能体显得过于强势" : "Some agents felt too forceful" },
    { key: "rejectWithoutPenalty", label: lang === "zh" ? "我觉得可以拒绝智能体建议而没有负担" : "I felt able to reject agent advice without penalty" },
    { key: "ownership", label: lang === "zh" ? "最终方案仍然像是我自己的决定" : "The final proposal still felt like my own decision" },
    { key: "satisfaction", label: lang === "zh" ? "我对这一轮协作体验满意" : "I was satisfied with this block's collaboration" },
    // In-context manipulation check.
    { key: "coordinatorStructured", label: lang === "zh" ? "组织者表现得结构化且善于推进流程" : "The Coordinator was structured and process-oriented" },
    { key: "ideatorExploratory", label: lang === "zh" ? "发想者表现得开放且善于拓展方案" : "The Ideator was exploratory and broadened the design space" },
    { key: "criticSkeptical", label: lang === "zh" ? "批评者表现得直接且会挑战假设" : "The Critic was direct and challenged assumptions" },
    { key: "verifierCalibrated", label: lang === "zh" ? "验证者表现得谨慎且重视证据/不确定性" : "The Verifier was cautious and evidence/calibration-oriented" }
  ];
}

function blockSurveyTextFields(lang: Language) {
  return [
    { key: "mostHelpfulAgent", label: lang === "zh" ? "这一轮哪个智能体最帮助你？为什么？" : "Which agent helped you most this block, and why?" },
    { key: "decisionMoment", label: lang === "zh" ? "有没有某个建议让你改变、质疑或坚持自己的想法？请描述。" : "Describe a moment when a suggestion changed, challenged, or reinforced your thinking." }
  ];
}

// Final comparison survey: head-to-head preference between the two blocks.
function finalSurveyFields(lang: Language) {
  return [
    { key: "preferredBlockOverall", label: lang === "zh" ? "总体而言，我更喜欢第二轮的团队风格（1=更喜欢第一轮，7=更喜欢第二轮）" : "Overall I preferred the second block's team style (1=prefer block 1, 7=prefer block 2)" },
    { key: "moreHelpfulBlock", label: lang === "zh" ? "第二轮的团队对完成任务更有帮助（1=第一轮，7=第二轮）" : "The second block's team was more helpful for the task (1=block 1, 7=block 2)" },
    { key: "morePressureBlock", label: lang === "zh" ? "第二轮让我感到更大压力（1=第一轮，7=第二轮）" : "The second block felt more pressuring (1=block 1, 7=block 2)" }
  ];
}

function finalSurveyTextFields(lang: Language) {
  return [
    { key: "blockDifference", label: lang === "zh" ? "你觉得两轮的智能体团队有什么不同？" : "How did the two agent teams differ, in your view?" },
    { key: "controlWish", label: lang === "zh" ? "如果可以调节智能体的风格，你最想调哪个角色、怎么调？" : "If you could tune the agents' styles, which role would you most want to adjust, and how?" },
    { key: "improvementSuggestion", label: lang === "zh" ? "你会如何改进这个多智能体协作界面？" : "How would you improve this multi-agent collaboration interface?" }
  ];
}

function SurveyPanel({ lang, title, fields, textFields, onSubmit }: {
  lang: Language;
  title: string;
  fields: Array<{ key: string; label: string }>;
  textFields?: Array<{ key: string; label: string }>;
  onSubmit: (values: Record<string, unknown>) => Promise<void> | void;
}) {
  const [values, setValues] = useState<Record<string, number | string>>(() => Object.fromEntries(fields.map((field) => [field.key, 4])));
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  return (
    <section className="work-panel narrow">
      <h2>{title}</h2>
      <div className="survey-list">
        {fields.map((field) => (
          <SliderField
            key={field.key}
            label={field.label}
            value={Number(values[field.key] ?? 4)}
            onChange={(value) => setValues({ ...values, [field.key]: value })}
            minLabel={lang === "zh" ? "非常不同意" : "Strongly disagree"}
            maxLabel={lang === "zh" ? "非常同意" : "Strongly agree"}
          />
        ))}
      </div>
      {(textFields ?? []).map((field) => (
        <label className="text-field" key={field.key}>
          <span>{field.label}</span>
          <textarea
            value={textValues[field.key] ?? ""}
            onChange={(event) => setTextValues({ ...textValues, [field.key]: event.target.value })}
            rows={4}
          />
        </label>
      ))}
      <PrimaryButton onClick={() => onSubmit({ ...values, ...textValues })} icon={<Save size={18} />}>
        {t(lang, "saveContinue")}
      </PrimaryButton>
    </section>
  );
}

function ProposalStage({ lang, title, task, value, minChars, onSubmit }: {
  lang: Language;
  title: string;
  task: string;
  value: ProposalValue;
  minChars?: number;
  onSubmit: (proposal: ProposalValue) => Promise<void> | void;
}) {
  const [proposal, setProposal] = useState<ProposalValue>(value);
  const [error, setError] = useState("");
  return (
    <section className="work-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t(lang, "task")}</p>
          <h2>{title}</h2>
          <p>{task}</p>
        </div>
      </div>
      <ProposalEditor lang={lang} value={proposal} onChange={setProposal} />
      {error && <p className="error-text">{error}</p>}
      <PrimaryButton
        onClick={() => {
          const gateError = proposalQualityError(proposal, lang, minChars ?? 0);
          if (gateError) {
            setError(gateError);
            return;
          }
          setError("");
          onSubmit(proposal);
        }}
        icon={<Save size={18} />}
      >
        {t(lang, "saveContinue")}
      </PrimaryButton>
    </section>
  );
}

function TutorialPanel({ lang, onContinue }: { lang: Language; onContinue: () => void }) {
  return (
    <section className="work-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t(lang, "tutorial")}</p>
          <h2>{lang === "zh" ? "四个智能体角色" : "Four Agent Roles"}</h2>
          <p>{lang === "zh"
            ? "你将与同一组四个角色协作两轮。每个角色的职责固定，下面是它们的分工。"
            : "You will collaborate with the same four roles across two blocks. Each role has a fixed responsibility, described below."}</p>
        </div>
        <PrimaryButton onClick={onContinue} icon={<ChevronRight size={18} />}>{t(lang, "continue")}</PrimaryButton>
      </div>
      <div className="role-grid">
        {roles.map((role) => (
          <div className="role-card" key={role} style={{ borderTopColor: roleColors[role] }}>
            <div className="role-token" style={{ background: roleColors[role] }}>{roleLabels[role].short}</div>
            <h3>{lang === "zh" ? roleLabels[role].zh : roleLabels[role].en}</h3>
            <p>{roleDescription(role, lang)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function roleDescription(role: Role, lang: Language) {
  const zh: Record<Role, string> = {
    coordinator: "组织讨论、总结分歧、追踪目标，并帮助团队进入下一步。",
    ideator: "提出替代方案、类比和新的设计方向，拓展方案空间。",
    critic: "挑战假设、指出权衡和失败案例，帮助方案更扎实。",
    verifier: "检查证据、不确定性、伦理、隐私和评估严谨性。"
  };
  const en: Record<Role, string> = {
    coordinator: "Organizes discussion, summarizes branches, tracks goals, and moves the team forward.",
    ideator: "Generates alternatives, analogies, and new directions to broaden the design space.",
    critic: "Challenges assumptions, identifies trade-offs and failure cases, and strengthens revisions.",
    verifier: "Checks evidence, uncertainty, ethics, privacy, and evaluation rigor."
  };
  return lang === "zh" ? zh[role] : en[role];
}

function Workspace({ lang, participant, blockIndex, initialProposal, onFinish }: {
  lang: Language;
  participant: Participant;
  blockIndex: number;
  initialProposal: ProposalValue;
  onFinish: () => void;
}) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [probes, setProbes] = useState<PublicProbeCard[]>([]);
  const [decisions, setDecisions] = useState<Record<string, ProbeDecision>>({});
  const [probeNotes, setProbeNotes] = useState<Record<string, string>>({});
  const [roundIndex, setRoundIndex] = useState(0);
  const [targetRole, setTargetRole] = useState<Role | "all">("all");
  const [userMessage, setUserMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const currentRound = collaborationRounds[roundIndex];
  const topicId = participant.blocks.find((b) => b.index === blockIndex)?.topicId;
  const decisionCounts = useMemo(() => ({
    accepted: Object.values(decisions).filter((d) => d === "accepted").length,
    rejected: Object.values(decisions).filter((d) => d === "rejected").length,
    questioned: Object.values(decisions).filter((d) => d === "questioned").length,
    reframed: Object.values(decisions).filter((d) => d === "reframed").length
  }), [decisions]);

  useEffect(() => {
    const interval = window.setInterval(() => setElapsedSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, []);

  async function runRound() {
    if (!currentRound || loading) return;
    setLoading(true);
    await logClientEvent(participant, "round_started", {
      block: blockIndex,
      roundIndex: currentRound.index,
      priorMessageCount: messages.length
    });
    const result = await apiSend<{ messages: AgentMessage[]; probes: PublicProbeCard[] }>("/api/agent/round", "POST", {
      participantId: participant.id,
      lang,
      blockIndex,
      roundIndex: currentRound.index,
      messages,
      initialProposal
    });
    setMessages([...messages, ...result.messages]);
    setProbes([...probes, ...result.probes]);
    setRoundIndex(roundIndex + 1);
    await logClientEvent(participant, "round_completed", {
      block: blockIndex,
      roundIndex: currentRound.index,
      generatedMessages: result.messages.length,
      revealedProbes: result.probes.map((probe) => probe.id)
    });
    setLoading(false);
  }

  async function sendDirect() {
    if (!userMessage.trim() || loading) return;
    const userTurn: AgentMessage = {
      id: `local_${Date.now()}`,
      role: "user",
      content: userMessage,
      createdAt: new Date().toISOString(),
      targetRole
    };
    setLoading(true);
    setMessages((prev) => [...prev, userTurn]);
    await logClientEvent(participant, "direct_turn_started", {
      block: blockIndex,
      targetRole,
      userMessageChars: userMessage.length
    });
    const result = await apiSend<{ messages: AgentMessage[]; probes: PublicProbeCard[] }>("/api/agent/direct", "POST", {
      participantId: participant.id,
      lang,
      blockIndex,
      targetRole,
      userMessage,
      messages: [...messages, userTurn],
      initialProposal
    });
    setMessages((prev) => [...prev, ...result.messages]);
    await logClientEvent(participant, "direct_turn_completed", { block: blockIndex, targetRole, generatedMessages: result.messages.length });
    setUserMessage("");
    setLoading(false);
  }

  async function decide(probe: PublicProbeCard, decision: ProbeDecision) {
    setDecisions({ ...decisions, [probe.id]: decision });
    await apiSend("/api/events", "POST", {
      participantId: participant.id,
      type: "probe_decision",
      payload: {
        blockIndex,
        probeId: probe.id,
        decision,
        reason: probeNotes[probe.id] ?? "",
        round: probe.round,
        sourceRole: probe.sourceRole
      }
    });
  }

  async function finishWorkspace() {
    if (Object.keys(decisions).length < probes.length) {
      alert(lang === "zh"
        ? "请先处理建议决策板中的所有建议，再进入最终方案。"
        : "Please handle every suggestion in the decision board before moving to the final proposal.");
      return;
    }
    await logClientEvent(participant, "workspace_completed", {
      block: blockIndex,
      elapsedSeconds,
      messageCount: messages.length,
      probeDecisionCount: Object.keys(decisions).length,
      decisionCounts
    });
    onFinish();
  }

  return (
    <section className="workspace-grid">
      <aside className="task-panel">
        <p className="eyebrow">{t(lang, "task")}</p>
        <h2>{topicText(topicId, lang)}</h2>
        <div className="timer-strip">
          <Gauge size={16} />
          <span>{lang === "zh" ? "协作计时" : "Collaboration timer"}</span>
          <strong>{formatDuration(elapsedSeconds)}</strong>
        </div>
        <div className="mini-template">
          {finalProposalFields.map((field) => (
            <div key={field.key}>
              <strong>{lang === "zh" ? field.zh : field.en}</strong>
              <p>{initialProposal[field.key] || (lang === "zh" ? "未填写" : "Not filled")}</p>
            </div>
          ))}
        </div>
      </aside>
      <main className="conversation-panel">
        <div className="round-toolbar">
          <div>
            <p className="eyebrow">{currentRound ? (lang === "zh" ? currentRound.titleZh : currentRound.titleEn) : t(lang, "roundDone")}</p>
            <h2>{lang === "zh" ? `第 ${blockIndex} 轮 · ${t(lang, "workspace")}` : `Block ${blockIndex} · ${t(lang, "workspace")}`}</h2>
          </div>
          {currentRound ? (
            <PrimaryButton onClick={runRound} disabled={loading} icon={<LineChart size={18} />}>{t(lang, "nextRound")}</PrimaryButton>
          ) : (
            <PrimaryButton onClick={finishWorkspace} icon={<ClipboardCheck size={18} />}>{t(lang, "finalProposal")}</PrimaryButton>
          )}
        </div>
        <div className="timeline">
          {messages.length === 0 && <div className="empty-state">{t(lang, "noMessages")}</div>}
          {messages.map((message) => (
            <article className={`message message-${message.role}`} key={message.id}>
              <div className="message-meta">
                <span className="role-dot" style={{ background: roleColors[message.role] }} />
                <strong>{message.role === "user" ? (lang === "zh" ? "你" : "You") : roleLabels[message.role as Role]?.[lang]}</strong>
                {message.round && <span>R{message.round}</span>}
                {message.latencyMs && <span>{Math.round(message.latencyMs / 100) / 10}s</span>}
              </div>
              <p>{message.content}</p>
            </article>
          ))}
          {loading && <div className="empty-state">{t(lang, "loading")}</div>}
        </div>
        <div className="direct-box">
          <label>
            <span>{t(lang, "target")}</span>
            <select value={targetRole} onChange={(event) => setTargetRole(event.target.value as Role | "all")}>
              <option value="all">{t(lang, "allAgents")}</option>
              {roles.map((role) => <option value={role} key={role}>{lang === "zh" ? roleLabels[role].zh : roleLabels[role].en}</option>)}
            </select>
          </label>
          <textarea value={userMessage} onChange={(event) => setUserMessage(event.target.value)} placeholder={t(lang, "directAsk")} rows={3} />
          <PrimaryButton onClick={sendDirect} disabled={loading || !userMessage.trim()} icon={<Send size={18} />}>{t(lang, "send")}</PrimaryButton>
        </div>
      </main>
      <aside className="board-panel">
        <div className="board-section">
          <h3><Check size={18} /> {t(lang, "probes")}</h3>
          <div className="decision-summary">
            <span><Check size={14} /> {decisionCounts.accepted}</span>
            <span><X size={14} /> {decisionCounts.rejected}</span>
            <span><MessageSquare size={14} /> {decisionCounts.questioned}</span>
            <span><RotateCcw size={14} /> {decisionCounts.reframed}</span>
          </div>
          {probes.map((probe) => (
            <div className="probe-card" key={probe.id}>
              <div className="probe-source">
                <span className="role-dot" style={{ background: roleColors[probe.sourceRole] }} />
                {roleLabels[probe.sourceRole][lang]} · R{probe.round}
              </div>
              <strong>{probe.title}</strong>
              <p>{probe.text}</p>
              <div className="decision-row">
                {([
                  ["accepted", Check, t(lang, "accepted")],
                  ["rejected", X, t(lang, "rejected")],
                  ["questioned", MessageSquare, t(lang, "questioned")],
                  ["reframed", RotateCcw, t(lang, "reframed")]
                ] as const).map(([decision, Icon, label]) => (
                  <button
                    key={decision}
                    className={decisions[probe.id] === decision ? "selected" : ""}
                    title={label}
                    onClick={() => decide(probe, decision)}
                  >
                    <Icon size={15} />
                  </button>
                ))}
              </div>
              <textarea
                className="probe-note"
                value={probeNotes[probe.id] ?? ""}
                onChange={(event) => setProbeNotes({ ...probeNotes, [probe.id]: event.target.value })}
                placeholder={lang === "zh" ? "可选：为什么这样处理这条建议？" : "Optional: why did you handle this suggestion this way?"}
                rows={2}
              />
            </div>
          ))}
          {!probes.length && <p className="muted">{lang === "zh" ? "第 2-3 轮中，智能体提出的关键建议会在这里记录，供你采纳、拒绝、质疑或改写。" : "In rounds 2-3, key suggestions raised by the agents will be logged here so you can accept, reject, question, or reframe them."}</p>}
        </div>
      </aside>
    </section>
  );
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function CompletionPanel({ lang, message, resetSession }: { lang: Language; message: string; resetSession: () => void }) {
  return (
    <section className="work-panel narrow success-panel">
      <UserCheck size={42} />
      <h2>{t(lang, "complete")}</h2>
      <p>{message}</p>
      <div className="button-row">
        <SecondaryButton onClick={resetSession} icon={<RotateCcw size={18} />}>{t(lang, "reset")}</SecondaryButton>
      </div>
    </section>
  );
}

function AdminPage({ lang, initialView }: { lang: Language; initialView: "analytics" | "rater" }) {
  const [adminToken, setAdminToken] = useState(localStorage.getItem("admin-token") ?? "");
  const [draftToken, setDraftToken] = useState(adminToken);
  const [view, setView] = useState<"analytics" | "rater">(initialView);
  const [error, setError] = useState("");
  const authenticated = Boolean(adminToken);

  async function login() {
    try {
      await apiGet("/api/admin/health", draftToken);
      localStorage.setItem("admin-token", draftToken);
      setAdminToken(draftToken);
      setError("");
    } catch {
      setError(lang === "zh" ? "管理员 token 不正确。" : "The admin token is incorrect.");
    }
  }

  if (!authenticated) {
    return (
      <main className="page-shell">
        <section className="work-panel narrow admin-login">
          <ShieldCheck size={42} />
          <h2>{lang === "zh" ? "管理员登录" : "Admin Login"}</h2>
          <p className="muted">{lang === "zh" ? "请输入服务器 `.env` 中配置的 ADMIN_TOKEN。" : "Enter the ADMIN_TOKEN configured in the server .env file."}</p>
          <label className="text-field">
            <span>ADMIN_TOKEN</span>
            <input type="password" value={draftToken} onChange={(event) => setDraftToken(event.target.value)} />
          </label>
          {error && <p className="error-text">{error}</p>}
          <PrimaryButton onClick={login} icon={<ShieldCheck size={18} />}>{lang === "zh" ? "进入管理员端" : "Enter Admin"}</PrimaryButton>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="admin-tabs">
        <button className={view === "analytics" ? "active" : ""} onClick={() => setView("analytics")}>
          <BarChart3 size={16} /> {t(lang, "analytics")}
        </button>
        <button className={view === "rater" ? "active" : ""} onClick={() => setView("rater")}>
          <ClipboardCheck size={16} /> {t(lang, "rater")}
        </button>
        <button
          onClick={() => {
            localStorage.removeItem("admin-token");
            setAdminToken("");
          }}
        >
          <X size={16} /> {lang === "zh" ? "退出" : "Sign out"}
        </button>
      </div>
      {view === "analytics" ? <AnalyticsPage lang={lang} adminToken={adminToken} /> : <RaterPage lang={lang} adminToken={adminToken} />}
    </main>
  );
}

function AnalyticsPage({ lang, adminToken }: { lang: Language; adminToken: string }) {
  const [data, setData] = useState<any>();
  const [error, setError] = useState("");
  useEffect(() => {
    apiGet<any>("/api/analytics", adminToken).then(setData).catch((err) => setError(String(err)));
  }, [adminToken]);

  if (error) return <section className="work-panel"><p>{error}</p></section>;
  if (!data) return <section className="work-panel"><p>{t(lang, "loading")}</p></section>;

  const contrastLabels: Record<string, string> = {
    improvement: lang === "zh" ? "方案提升" : "Improvement",
    finalQuality: lang === "zh" ? "终稿质量" : "Final quality",
    calibration: lang === "zh" ? "校准依赖(宽)" : "Calibration (lenient)",
    strictCalibration: lang === "zh" ? "校准依赖(严)" : "Calibration (strict)",
    cognitiveLoad: lang === "zh" ? "认知负荷" : "Cognitive load",
    roleLegibility: lang === "zh" ? "角色可辨识" : "Role legibility",
    pressure: lang === "zh" ? "压力" : "Pressure",
    autonomy: lang === "zh" ? "自主感" : "Autonomy",
    constructiveConflict: lang === "zh" ? "建设性冲突" : "Constructive conflict"
  };
  const contrastData = (data.pairedContrasts ?? []).map((item: any) => ({
    metric: contrastLabels[item.key] ?? item.key,
    specific: item.meanSpecific ?? 0,
    neutral: item.meanNeutral ?? 0,
    diff: item.meanDiff ?? 0,
    dz: item.dz ?? 0,
    n: item.n
  }));
  const perceivedData = (data.perceivedChecks ?? []).map((item: any) => ({
    role: item.label.slice(0, 18),
    specific: item.meanSpecific ?? 0,
    neutral: item.meanNeutral ?? 0
  }));
  const probeData = (data.probeSummary ?? []).map((item: any) => ({
    probe: item.title.slice(0, 16),
    accepted: item.accepted,
    rejected: item.rejected,
    questioned: item.questioned,
    reframed: item.reframed
  }));
  const lengthData = (data.responseLengthByArm ?? []).map((item: any) => ({
    role: roleLabels[item.role as Role]?.[lang] ?? item.role,
    neutral: item.meanWordsNeutral ? Math.round(item.meanWordsNeutral) : 0,
    specific: item.meanWordsSpecific ? Math.round(item.meanWordsSpecific) : 0
  }));
  const funnelData = (data.completionFunnel ?? []).map((item: any) => ({
    stage: item.stage.replace(/_/g, " "),
    count: item.count
  }));
  const reliabilityData = data.ratingReliability ?? [];
  const coverageData = data.ratingCoverage ?? [];

  return (
    <section className="work-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t(lang, "analytics")}</p>
          <h2>{lang === "zh" ? "被试内对比结果" : "Within-Subjects Results"}</h2>
        </div>
        <div className="button-row">
          <SecondaryButton onClick={() => downloadAdminFile("/api/export/participants", "participants.json", adminToken)} icon={<Download size={16} />}>Participants</SecondaryButton>
          <SecondaryButton onClick={() => downloadAdminFile("/api/export/events", "events.jsonl", adminToken)} icon={<Download size={16} />}>Events</SecondaryButton>
          <SecondaryButton onClick={() => downloadAdminFile("/api/export/analytics", "analytics.json", adminToken)} icon={<Download size={16} />}>Analytics</SecondaryButton>
          <SecondaryButton onClick={() => downloadAdminFile("/api/export/participants.csv", "participants.csv", adminToken)} icon={<Download size={16} />}>Participants CSV</SecondaryButton>
          <SecondaryButton onClick={() => downloadAdminFile("/api/export/events.csv", "events.csv", adminToken)} icon={<Download size={16} />}>Events CSV</SecondaryButton>
          <SecondaryButton onClick={() => downloadAdminFile("/api/export/ratings.csv", "ratings.csv", adminToken)} icon={<Download size={16} />}>Ratings CSV</SecondaryButton>
        </div>
      </div>
      <div className="metric-grid">
        <Metric icon={<UserCheck />} label={lang === "zh" ? "参与者" : "Participants"} value={data.counts.participants} />
        <Metric icon={<ClipboardCheck />} label={lang === "zh" ? "已完成" : "Completed"} value={data.counts.completed} />
        <Metric icon={<Gauge />} label={lang === "zh" ? "盲评数" : "Blind ratings"} value={data.counts.ratings} />
        <Metric icon={<ClipboardCheck />} label={lang === "zh" ? "已评满项" : "Fully rated items"} value={`${data.counts.fullyRatedBlindItems ?? 0}/${data.counts.expectedBlindItems ?? 0}`} />
        <Metric icon={<MessageSquare />} label={lang === "zh" ? "事件" : "Events"} value={data.counts.events} />
      </div>
      {data.counts.participants === 0 && <div className="empty-state">{t(lang, "emptyData")}</div>}
      <div className="chart-grid">
        <ChartPanel title={lang === "zh" ? "配对均值：角色特定 vs 中性" : "Paired Means: Specific vs Neutral"}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={contrastData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="metric" interval={0} angle={-20} textAnchor="end" height={70} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="neutral" fill="#1f77b4" name={lang === "zh" ? "中性团队" : "Neutral"} />
              <Bar dataKey="specific" fill="#2a9d8f" name={lang === "zh" ? "角色特定团队" : "Specific"} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title={lang === "zh" ? "配对效应量 (Cohen's dz)" : "Paired Effect Sizes (Cohen's dz)"}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={contrastData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="metric" interval={0} angle={-20} textAnchor="end" height={70} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="dz" fill="#6d5bd0" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title={lang === "zh" ? "人格感知操控检查" : "Perceived-Personality Check"}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={perceivedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="role" interval={0} angle={-15} textAnchor="end" height={70} />
              <YAxis domain={[1, 7]} />
              <Tooltip />
              <Legend />
              <Bar dataKey="neutral" fill="#1f77b4" name={lang === "zh" ? "中性" : "Neutral"} />
              <Bar dataKey="specific" fill="#2a9d8f" name={lang === "zh" ? "角色特定" : "Specific"} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title={lang === "zh" ? "Seeded probes 决策分布" : "Seeded Probe Decisions"}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={probeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="probe" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="accepted" stackId="a" fill="#2a9d8f" />
              <Bar dataKey="rejected" stackId="a" fill="#c2410c" />
              <Bar dataKey="questioned" stackId="a" fill="#f59e0b" />
              <Bar dataKey="reframed" stackId="a" fill="#6d5bd0" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title={lang === "zh" ? "响应长度均等检查（按 arm）" : "Response-Length Parity (by arm)"}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={lengthData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="role" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="neutral" fill="#1f77b4" name={lang === "zh" ? "中性" : "Neutral"} />
              <Bar dataKey="specific" fill="#2a9d8f" name={lang === "zh" ? "角色特定" : "Specific"} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title={lang === "zh" ? "完成漏斗" : "Completion Funnel"}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={funnelData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="stage" interval={0} angle={-15} textAnchor="end" height={70} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#2a9d8f" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title={lang === "zh" ? "盲评覆盖率" : "Blind Rating Coverage"}>
          <table className="quality-table">
            <thead>
              <tr><th>Item</th><th>Rated</th><th>Needed</th></tr>
            </thead>
            <tbody>
              {coverageData.slice(0, 12).map((item: any) => (
                <tr key={item.itemId}>
                  <td>{item.displayId}</td>
                  <td>{item.ratedCount}</td>
                  <td>{item.neededRatings}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {coverageData.length > 12 && <p className="muted">Showing 12 of {coverageData.length} items.</p>}
        </ChartPanel>
        <ChartPanel title={lang === "zh" ? "评分者一致性" : "Rater Reliability"}>
          <table className="quality-table">
            <thead>
              <tr><th>Dimension</th><th>Alpha</th><th>{"Items n>=2"}</th></tr>
            </thead>
            <tbody>
              {reliabilityData.map((item: any) => (
                <tr key={item.key}>
                  <td>{item.label}</td>
                  <td>{item.alpha === null ? "-" : item.alpha.toFixed(2)}</td>
                  <td>{item.itemsWithTwoOrMoreRatings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartPanel>
      </div>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="metric-card">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="chart-panel">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function RaterPage({ lang, adminToken }: { lang: Language; adminToken: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [raterId, setRaterId] = useState(localStorage.getItem("rater-id") ?? "");
  const [ratings, setRatings] = useState<Record<string, number>>(() => Object.fromEntries(raterDimensions.map((dimension) => [dimension.key, 4])));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const selected = useMemo(() => items.find((item) => item.itemId === selectedId) ?? items[0], [items, selectedId]);

  useEffect(() => {
    apiGet<{ items: any[] }>("/api/rater/items", adminToken).then((result) => {
      setItems(result.items);
      setSelectedId(result.items[0]?.itemId ?? "");
    });
  }, [adminToken]);

  async function submit() {
    if (!selected) return;
    try {
      localStorage.setItem("rater-id", raterId);
      await apiSend("/api/rater/ratings", "POST", {
        itemId: selected.itemId,
        raterId: raterId || "anonymous",
        ratings,
        notes
      }, adminToken);
      setItems(items.map((item) => item.itemId === selected.itemId ? {
        ...item,
        ratedCount: item.ratedCount + 1,
        neededRatings: Math.max(0, (item.neededRatings ?? 1) - 1)
      } : item));
      setRatings(Object.fromEntries(raterDimensions.map((dimension) => [dimension.key, 4])));
      setNotes("");
      setError("");
      alert(lang === "zh" ? "评分已保存" : "Rating saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section className="work-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t(lang, "rater")}</p>
          <h2>{lang === "zh" ? "匿名单项盲评" : "Anonymous Single-Item Rating"}</h2>
        </div>
        <PrimaryButton onClick={submit} disabled={!selected} icon={<Save size={18} />}>{t(lang, "submit")}</PrimaryButton>
      </div>
      <div className="rater-controls">
        <label>
          <span>Rater ID</span>
          <input value={raterId} onChange={(event) => setRaterId(event.target.value)} />
        </label>
        <label>
          <span>{lang === "zh" ? "匿名评分项" : "Anonymous item"}</span>
          <select value={selected?.itemId ?? ""} onChange={(event) => setSelectedId(event.target.value)}>
            {items.map((item) => (
              <option key={item.itemId} value={item.itemId}>
                {item.displayId} · rated {item.ratedCount} · need {item.neededRatings}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="error-text">{error}</p>}
      {!selected && <div className="empty-state">{lang === "zh" ? "暂无可评分的方案。" : "No completed proposals to rate yet."}</div>}
      {selected && (
        <div className="rater-grid rater-grid-single">
          <ProposalReadOnly
            lang={lang}
            title={lang === "zh" ? "待评分方案" : "Proposal to Rate"}
            task={lang === "zh" ? selected.topicZh : selected.topic}
            proposal={selected.proposal}
          />
          <div className="rating-column">
            <h3>{lang === "zh" ? "评分" : "Ratings"}</h3>
            {raterDimensions.map((dimension) => (
              <SliderField
                key={dimension.key}
                label={lang === "zh" ? dimension.labelZh : dimension.labelEn}
                value={ratings[dimension.key] ?? 4}
                onChange={(value) => setRatings({ ...ratings, [dimension.key]: value })}
              />
            ))}
          </div>
        </div>
      )}
      <label className="text-field">
        <span>{t(lang, "notes")}</span>
        <textarea rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
    </section>
  );
}

function ProposalReadOnly({ lang, title, task, proposal }: { lang: Language; title: string; task?: string; proposal: Record<string, string> }) {
  return (
    <div className="proposal-readonly">
      <h3>{title}</h3>
      {task && (
        <div>
          <strong>{t(lang, "task")}</strong>
          <p>{task}</p>
        </div>
      )}
      {finalProposalFields.map((field) => (
        <div key={field.key}>
          <strong>{lang === "zh" ? field.zh : field.en}</strong>
          <p>{proposal?.[field.key] || "-"}</p>
        </div>
      ))}
    </div>
  );
}

export default App;
