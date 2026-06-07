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
  Lightbulb,
  LineChart,
  MessageSquare,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  UserCheck,
  X
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  manipulationDimensions,
  raterDimensions,
  roleControlDefaults,
  roleControlLabels,
  roleLabels,
  roles,
  study0Materials,
  taskTopics,
  type AgentMessage,
  type Language,
  type ProbeDecision,
  type PublicProbeCard,
  type Role,
  type Study,
  type Study0Material
} from "./shared/experiment";

type Participant = {
  id: string;
  study: Study;
  lang: Language;
  conditionId?: string;
  topicId?: string;
  initialProposal?: Record<string, string>;
  finalProposal?: Record<string, string>;
  study2Controls?: Record<string, Record<string, number>>;
  completedAt?: string;
};

type Stage = "landing" | "pre" | "initial" | "tutorial" | "workspace" | "final" | "post" | "complete";
type ProposalValue = Record<string, string>;

const copy = {
  zh: {
    title: "角色特定智能体人格实验系统",
    subtitle: "面向 CHI 2027 的 human-agent team 协作研究原型",
    start: "开始实验",
    continue: "继续",
    saveContinue: "保存并继续",
    reset: "重置本地流程",
    language: "语言",
    study1: "Study 1 主实验",
    study0: "Study 0 操控验证",
    study2: "Study 2 控制探针",
    analytics: "分析仪表盘",
    admin: "管理员",
    rater: "盲评入口",
    consent: "知情同意",
    preSurvey: "实验前问卷",
    initialProposal: "独立初稿",
    tutorial: "角色说明",
    workspace: "团队协作工作区",
    finalProposal: "最终方案",
    postSurvey: "实验后问卷",
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
    roundDone: "四轮已完成，可以提交最终方案。",
    loading: "智能体正在回复...",
    notes: "研究备注",
    submit: "提交",
    controls: "角色级人格控制",
    reflection: "访谈/think-aloud 记录",
    emptyData: "暂无数据。完成实验或导入盲评后会显示图表。",
    download: "下载数据"
  },
  en: {
    title: "Role-Specific Agent Personality Lab",
    subtitle: "A CHI 2027-oriented human-agent team collaboration prototype",
    start: "Start",
    continue: "Continue",
    saveContinue: "Save and continue",
    reset: "Reset local flow",
    language: "Language",
    study1: "Study 1 Main Experiment",
    study0: "Study 0 Manipulation Check",
    study2: "Study 2 Control Probe",
    analytics: "Analytics",
    admin: "Admin",
    rater: "Blind Rating",
    consent: "Consent",
    preSurvey: "Pre-survey",
    initialProposal: "Initial proposal",
    tutorial: "Role tutorial",
    workspace: "Team workspace",
    finalProposal: "Final proposal",
    postSurvey: "Post-survey",
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
    roundDone: "All four rounds are complete. You can submit the final proposal.",
    loading: "Agents are responding...",
    notes: "Research notes",
    submit: "Submit",
    controls: "Role-level personality controls",
    reflection: "Interview / think-aloud notes",
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
  const fields = Object.fromEntries(
    finalProposalFields.map((field) => {
      const text = proposal[field.key] ?? "";
      return [field.key, {
        chars: text.length,
        words: text.trim() ? text.trim().split(/\s+/).length : 0
      }];
    })
  );
  return {
    fields,
    totalChars: Object.values(proposal).join("").length,
    totalWords: Object.values(proposal).join(" ").trim()
      ? Object.values(proposal).join(" ").trim().split(/\s+/).length
      : 0
  };
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function selectStudy0Materials(participantId: string): Study0Material[] {
  const selected = roles.flatMap((role) =>
    (["neutral", "specific"] as const).map((level) => {
      const candidates = study0Materials.filter((item) => item.role === role && item.level === level);
      return candidates[hashString(`${participantId}-${role}-${level}`) % candidates.length];
    })
  );
  return selected.sort((a, b) => hashString(`${participantId}-${a.id}`) - hashString(`${participantId}-${b.id}`));
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
      ? `当前总长度约 ${totalChars} 字。为了保证初稿/终稿可盲评，请至少写到 ${minChars} 字。`
      : `Current total length is about ${totalChars} characters. Please write at least ${minChars} characters so raters can evaluate the proposal.`;
  }
  return "";
}

async function logClientEvent(participant: Participant | undefined, type: string, payload: Record<string, unknown>) {
  if (!participant) return;
  await apiSend("/api/events", "POST", {
    participantId: participant.id,
    study: participant.study,
    type,
    payload: {
      ...payload,
      clientTime: new Date().toISOString()
    }
  });
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
            <a href="/">{t(lang, "study1")}</a>
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
      {adminMode ? <AdminPage lang={lang} initialView={path.includes("rater") ? "rater" : "analytics"} />
          : path.startsWith("/study0") ? <Study0Page lang={lang} />
            : path.startsWith("/study2") ? <Study2Page lang={lang} />
              : <Study1Page lang={lang} />}
    </>
  );
}

function StageRail({ stage, lang }: { stage: Stage; lang: Language }) {
  const stages: Stage[] = ["landing", "pre", "initial", "tutorial", "workspace", "final", "post", "complete"];
  const labels: Record<Stage, string> = {
    landing: t(lang, "start"),
    pre: t(lang, "preSurvey"),
    initial: t(lang, "initialProposal"),
    tutorial: t(lang, "tutorial"),
    workspace: t(lang, "workspace"),
    final: t(lang, "finalProposal"),
    post: t(lang, "postSurvey"),
    complete: t(lang, "complete")
  };
  const current = stages.indexOf(stage);
  return (
    <div className="stage-rail">
      {stages.map((item, index) => (
        <div className={`stage-pill ${index <= current ? "done" : ""}`} key={item}>
          <span>{index + 1}</span>
          {labels[item]}
        </div>
      ))}
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

function SliderField({
  label,
  value,
  onChange,
  minLabel,
  maxLabel
}: {
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

function topicText(topicId: string | undefined, lang: Language) {
  const topic = taskTopics.find((item) => item.id === topicId) ?? taskTopics[0];
  return lang === "zh" ? topic.zh : topic.en;
}

function LandingPanel({ lang, title, description, onStart }: {
  lang: Language;
  title: string;
  description: string;
  onStart: () => void;
}) {
  return (
    <main className="page-shell">
      <section className="intro-band">
        <div>
          <p className="eyebrow">{t(lang, "subtitle")}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <PrimaryButton onClick={onStart} icon={<ChevronRight size={18} />}>{t(lang, "start")}</PrimaryButton>
      </section>
    </main>
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
      "系统会记录你的方案文本、对话消息、建议采纳/拒绝、问卷回答、时间戳、响应延迟和浏览器环境信息。",
      "系统不会要求你输入真实姓名、密码、账号、成绩或其他敏感身份信息。",
      "你可以在实验中拒绝智能体建议，最终方案由你决定。",
      "如果你中途退出，研究者会按伦理审批/招募说明处理已收集数据。"
    ]
    : [
      `Estimated duration: ${duration}.`,
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

function Study1Page({ lang }: { lang: Language }) {
  const [session, setSession, resetSession] = useSession<{
    stage: Stage;
    participant?: Participant;
    preSurvey?: Record<string, unknown>;
    initialProposal?: ProposalValue;
    finalProposal?: ProposalValue;
    postSurvey?: Record<string, unknown>;
  }>("study1-session", { stage: "landing" });
  const [busy, setBusy] = useState(false);

  async function start(participantCode: string) {
    setBusy(true);
    try {
      const result = await apiSend<{ participant: Participant }>("/api/participants", "POST", {
        study: "study1",
        lang,
        consent: {
          accepted: true,
          acceptedAt: new Date().toISOString(),
          version: "recruitment-ready-v1"
        },
        recruitment: {
          participantCode: participantCode || null,
          source: "local-or-study-link"
        },
        browserInfo: collectBrowserInfo()
      });
      await logClientEvent(result.participant, "stage_entered", { stage: "pre" });
      setSession({ stage: "pre", participant: result.participant });
    } catch (error) {
      console.error(error);
      alert(lang === "zh" ? "无法连接实验服务器，请联系研究者。" : "Could not reach the study server. Please contact the researcher.");
    } finally {
      setBusy(false);
    }
  }

  if (session.stage === "landing") {
    return (
      <ConsentLanding
        lang={lang}
        title={t(lang, "study1")}
        description={lang === "zh"
          ? "参与者先独立提出方案，再与四个角色固定的智能体协作，最后提交最终方案和问卷。系统会记录轮次、消息、建议采纳/拒绝和问卷数据。"
          : "Participants draft an initial proposal, collaborate with four role-fixed agents, then submit a final proposal and post-survey. The system logs rounds, messages, suggestion decisions, and survey data."}
        duration={lang === "zh" ? "40-45 分钟" : "40-45 minutes"}
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
            await apiSend(`/api/participants/${session.participant?.id}`, "PATCH", { preSurvey: values, status: "pre_completed" });
            await logClientEvent(session.participant, "stage_submitted", { stage: "pre", surveyKeys: Object.keys(values) });
            await logClientEvent(session.participant, "stage_entered", { stage: "initial" });
            setSession({ ...session, preSurvey: values, stage: "initial" });
          }}
        />
      )}
      {session.stage === "initial" && (
        <ProposalStage
          lang={lang}
          title={t(lang, "initialProposal")}
          task={topicText(session.participant?.topicId, lang)}
          value={session.initialProposal ?? {}}
          minChars={320}
          onSubmit={async (proposal) => {
            await apiSend(`/api/participants/${session.participant?.id}`, "PATCH", { initialProposal: proposal, status: "initial_completed" });
            await logClientEvent(session.participant, "proposal_submitted", { stage: "initial", stats: proposalStats(proposal) });
            await logClientEvent(session.participant, "stage_entered", { stage: "tutorial" });
            setSession({ ...session, initialProposal: proposal, stage: "tutorial" });
          }}
        />
      )}
      {session.stage === "tutorial" && (
        <TutorialPanel
          lang={lang}
          onContinue={async () => {
            await logClientEvent(session.participant, "stage_entered", { stage: "workspace" });
            setSession({ ...session, stage: "workspace" });
          }}
        />
      )}
      {session.stage === "workspace" && session.participant && (
        <Workspace
          lang={lang}
          participant={session.participant}
          initialProposal={session.initialProposal ?? {}}
          onFinish={() => setSession({ ...session, stage: "final" })}
        />
      )}
      {session.stage === "final" && (
        <ProposalStage
          lang={lang}
          title={t(lang, "finalProposal")}
          task={topicText(session.participant?.topicId, lang)}
          value={session.finalProposal ?? session.initialProposal ?? {}}
          minChars={560}
          onSubmit={async (proposal) => {
            await apiSend(`/api/participants/${session.participant?.id}`, "PATCH", { finalProposal: proposal, status: "final_completed" });
            await logClientEvent(session.participant, "proposal_submitted", { stage: "final", stats: proposalStats(proposal) });
            await logClientEvent(session.participant, "stage_entered", { stage: "post" });
            setSession({ ...session, finalProposal: proposal, stage: "post" });
          }}
        />
      )}
      {session.stage === "post" && (
        <SurveyPanel
          lang={lang}
          title={t(lang, "postSurvey")}
          fields={postSurveyFields(lang)}
          textFields={postSurveyTextFields(lang)}
          onSubmit={async (values) => {
            await apiSend(`/api/participants/${session.participant?.id}`, "PATCH", {
              postSurvey: values,
              completedAt: new Date().toISOString(),
              status: "completed"
            });
            await logClientEvent(session.participant, "stage_submitted", { stage: "post", surveyKeys: Object.keys(values) });
            setSession({ ...session, postSurvey: values, stage: "complete" });
          }}
        />
      )}
      {session.stage === "complete" && (
        <CompletionPanel
          lang={lang}
          resetSession={resetSession}
          message={lang === "zh" ? "主实验流程已完成。感谢参与。" : "The main experiment flow is complete. Thank you for participating."}
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
    { key: "collaborationPreference", label: lang === "zh" ? "我喜欢与多个意见不同的助手协作" : "I like collaborating with multiple assistants that offer different perspectives" },
    { key: "attentionCheck", label: lang === "zh" ? "注意力检查：请为本题选择 5" : "Attention check: please select 5 for this item" }
  ];
}

function preSurveyTextFields(lang: Language) {
  return [
    { key: "ageRange", label: lang === "zh" ? "年龄范围（可选，如 18-24）" : "Age range (optional, e.g., 18-24)" },
    { key: "educationOrRole", label: lang === "zh" ? "教育/职业背景（可选）" : "Education/work background (optional)" },
    { key: "priorDesignExperience", label: lang === "zh" ? "你是否做过 HCI/UX/设计研究任务？（可选）" : "Have you done HCI/UX/design research tasks before? (optional)" }
  ];
}

function postSurveyFields(lang: Language) {
  return [
    { key: "mentalDemand", label: lang === "zh" ? "任务的心理负荷很高" : "The task was mentally demanding" },
    { key: "temporalDemand", label: lang === "zh" ? "我感到时间压力很高" : "I felt high time pressure" },
    { key: "effort", label: lang === "zh" ? "完成任务需要很多努力" : "Completing the task required a lot of effort" },
    { key: "frustration", label: lang === "zh" ? "协作过程让我感到挫败" : "The collaboration felt frustrating" },
    { key: "roleClarity", label: lang === "zh" ? "我能清楚分辨每个智能体负责什么" : "I could tell what each agent was responsible for" },
    { key: "askRightAgent", label: lang === "zh" ? "我知道应该向哪个智能体询问哪类问题" : "I knew which agent to ask for which kind of help" },
    { key: "interpretDisagreement", label: lang === "zh" ? "我能理解智能体之间的分歧" : "I could interpret disagreements among agents" },
    { key: "styleRoleFit", label: lang === "zh" ? "每个智能体的表达风格符合它的角色" : "Each agent's communication style fit its role" },
    { key: "constructiveConflict", label: lang === "zh" ? "智能体之间的分歧帮助我改进方案" : "Disagreements among agents helped me improve the proposal" },
    { key: "critiqueUseful", label: lang === "zh" ? "批评性意见是有用的，而不是阻碍性的" : "Critical comments were useful rather than obstructive" },
    { key: "evidenceSeeking", label: lang === "zh" ? "系统促使我寻找证据或评估标准" : "The system encouraged me to seek evidence or evaluation criteria" },
    { key: "calibratedRelianceSelfReport", label: lang === "zh" ? "我知道什么时候应该采纳或质疑智能体建议" : "I knew when to accept or question agent suggestions" },
    { key: "trustTeam", label: lang === "zh" ? "我信任这个智能体团队能帮助我完成任务" : "I trusted the agent team to help me complete the task" },
    { key: "overRelianceConcern", label: lang === "zh" ? "我担心自己过度依赖了智能体建议" : "I worry that I over-relied on agent suggestions" },
    { key: "feltPushed", label: lang === "zh" ? "我觉得被智能体推向某个方向" : "I felt pushed toward the agents' preferred direction" },
    { key: "tooForceful", label: lang === "zh" ? "有些智能体显得过于强势" : "Some agents felt too forceful" },
    { key: "rejectWithoutPenalty", label: lang === "zh" ? "我觉得可以拒绝智能体建议而没有负担" : "I felt able to reject agent advice without penalty" },
    { key: "ownership", label: lang === "zh" ? "最终方案仍然像是我自己的决定" : "The final proposal still felt like my own decision" },
    { key: "satisfaction", label: lang === "zh" ? "我对协作体验满意" : "I was satisfied with the collaboration" },
    { key: "reuseIntent", label: lang === "zh" ? "我愿意在类似任务中再次使用这种多智能体工作区" : "I would use this multi-agent workspace again for similar tasks" },
    { key: "coordinatorStructured", label: lang === "zh" ? "组织者表现得结构化且善于推进流程" : "The Coordinator was structured and process-oriented" },
    { key: "ideatorExploratory", label: lang === "zh" ? "发想者表现得开放且善于拓展方案" : "The Ideator was exploratory and broadened the design space" },
    { key: "criticSkeptical", label: lang === "zh" ? "批评者表现得直接且会挑战假设" : "The Critic was direct and challenged assumptions" },
    { key: "verifierCalibrated", label: lang === "zh" ? "验证者表现得谨慎且重视证据/不确定性" : "The Verifier was cautious and evidence/calibration-oriented" }
  ];
}

function postSurveyTextFields(lang: Language) {
  return [
    { key: "mostHelpfulAgent", label: lang === "zh" ? "哪个智能体最帮助你？为什么？" : "Which agent helped you most, and why?" },
    { key: "leastHelpfulAgent", label: lang === "zh" ? "哪个智能体最没有帮助或造成干扰？为什么？" : "Which agent was least helpful or most disruptive, and why?" },
    { key: "decisionMoment", label: lang === "zh" ? "有没有某个建议让你改变、质疑或坚持自己的想法？请描述。" : "Describe a moment when a suggestion changed, challenged, or reinforced your thinking." },
    { key: "pressureMoment", label: lang === "zh" ? "有没有感到被推动、被说服或失去主导感？请描述。" : "Describe any moment when you felt pushed, persuaded, or less in control." },
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
      {(textFields ?? [{ key: "openText", label: lang === "zh" ? "补充说明（可选）" : "Optional comment" }]).map((field) => (
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

function Workspace({ lang, participant, initialProposal, study2Controls, onFinish }: {
  lang: Language;
  participant: Participant;
  initialProposal: ProposalValue;
  study2Controls?: Record<string, Record<string, number>>;
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
  const [notes, setNotes] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const currentRound = collaborationRounds[roundIndex];
  const decisionCounts = useMemo(() => ({
    accepted: Object.values(decisions).filter((decision) => decision === "accepted").length,
    rejected: Object.values(decisions).filter((decision) => decision === "rejected").length,
    questioned: Object.values(decisions).filter((decision) => decision === "questioned").length,
    reframed: Object.values(decisions).filter((decision) => decision === "reframed").length
  }), [decisions]);

  useEffect(() => {
    const interval = window.setInterval(() => setElapsedSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, []);

  async function runRound() {
    if (!currentRound || loading) return;
    setLoading(true);
    await logClientEvent(participant, "round_started", {
      roundIndex: currentRound.index,
      roundTitle: lang === "zh" ? currentRound.titleZh : currentRound.titleEn,
      priorMessageCount: messages.length
    });
    const result = await apiSend<{ messages: AgentMessage[]; probes: PublicProbeCard[] }>("/api/agent/round", "POST", {
      participantId: participant.id,
      lang,
      roundIndex: currentRound.index,
      messages,
      initialProposal,
      study2Controls
    });
    setMessages([...messages, ...result.messages]);
    setProbes([...probes, ...result.probes]);
    setRoundIndex(roundIndex + 1);
    await logClientEvent(participant, "round_completed", {
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
      targetRole,
      userMessageChars: userMessage.length,
      priorMessageCount: messages.length
    });
    const result = await apiSend<{ messages: AgentMessage[]; probes: PublicProbeCard[] }>("/api/agent/direct", "POST", {
      participantId: participant.id,
      lang,
      targetRole,
      userMessage,
      messages: [...messages, userTurn],
      initialProposal,
      study2Controls
    });
    setMessages((prev) => [...prev, ...result.messages]);
    await logClientEvent(participant, "direct_turn_completed", {
      targetRole,
      generatedMessages: result.messages.length
    });
    setUserMessage("");
    setLoading(false);
  }

  async function decide(probe: PublicProbeCard, decision: ProbeDecision) {
    setDecisions({ ...decisions, [probe.id]: decision });
    await apiSend("/api/events", "POST", {
      participantId: participant.id,
      study: participant.study,
      type: "probe_decision",
      payload: {
        probeId: probe.id,
        decision,
        reason: probeNotes[probe.id] ?? "",
        round: probe.round,
        sourceRole: probe.sourceRole
      }
    });
  }

  async function saveNotes() {
    await apiSend("/api/events", "POST", {
      participantId: participant.id,
      study: participant.study,
      type: "workspace_notes",
      payload: { notes }
    });
  }

  async function finishWorkspace() {
    if (Object.keys(decisions).length < probes.length) {
      alert(lang === "zh"
        ? "请先处理建议决策板中的所有建议，再进入最终方案。"
        : "Please handle every suggestion in the decision board before moving to the final proposal.");
      return;
    }
    await apiSend(`/api/participants/${participant.id}`, "PATCH", { status: "workspace_completed" });
    await logClientEvent(participant, "workspace_completed", {
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
        <h2>{topicText(participant.topicId, lang)}</h2>
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
            <p className="eyebrow">{currentRound ? `${lang === "zh" ? currentRound.titleZh : currentRound.titleEn}` : t(lang, "roundDone")}</p>
            <h2>{t(lang, "workspace")}</h2>
          </div>
          {currentRound ? (
            <PrimaryButton onClick={runRound} disabled={loading} icon={<LineChart size={18} />}>{t(lang, "nextRound")}</PrimaryButton>
          ) : (
            <PrimaryButton
              onClick={finishWorkspace}
              icon={<ClipboardCheck size={18} />}
            >
              {t(lang, "finalProposal")}
            </PrimaryButton>
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
          <h3><Target size={18} /> {t(lang, "probes")}</h3>
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
          {!probes.length && <p className="muted">{lang === "zh" ? "第 2-4 轮中，智能体提出的关键建议会在这里记录，供你采纳、拒绝、质疑或改写。" : "In rounds 2-4, key suggestions raised by the agents will be logged here so you can accept, reject, question, or reframe them."}</p>}
        </div>
        <label className="text-field">
          <span>{t(lang, "notes")}</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={6} />
        </label>
        <SecondaryButton onClick={saveNotes} icon={<Save size={16} />}>{lang === "zh" ? "保存备注" : "Save notes"}</SecondaryButton>
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

function Study0Page({ lang }: { lang: Language }) {
  const [session, setSession, resetSession] = useSession<{
    participant?: Participant;
    stage: "landing" | "rating" | "complete";
    ratings?: Record<string, Record<string, number>>;
  }>("study0-session", { stage: "landing" });
  const [ratings, setRatings] = useState<Record<string, Record<string, number>>>(session.ratings ?? {});
  const selectedMaterials = useMemo(
    () => session.participant ? selectStudy0Materials(session.participant.id) : [],
    [session.participant]
  );
  const suitability = roles.map((role) => ({
    key: `suitable_${role}`,
    labelEn: `Suitable for ${roleLabels[role].en}`,
    labelZh: `适合${roleLabels[role].zh}`
  }));
  const dimensions = [...manipulationDimensions, ...suitability];

  async function start(participantCode: string) {
    try {
      const result = await apiSend<{ participant: Participant }>("/api/participants", "POST", {
        study: "study0",
        lang,
        consent: {
          accepted: true,
          acceptedAt: new Date().toISOString(),
          version: "recruitment-ready-v1"
        },
        recruitment: {
          participantCode: participantCode || null,
          source: "local-or-study-link"
        },
        browserInfo: collectBrowserInfo()
      });
      await logClientEvent(result.participant, "stage_entered", { stage: "study0_rating" });
      setSession({ stage: "rating", participant: result.participant });
    } catch (error) {
      console.error(error);
      alert(lang === "zh" ? "无法连接实验服务器，请联系研究者。" : "Could not reach the study server. Please contact the researcher.");
    }
  }

  async function submit() {
    const payload = selectedMaterials.map((item) => ({
      itemId: item.id,
      scenarioId: item.scenarioId,
      role: item.role,
      level: item.level,
      ratings: ratings[item.id] ?? {}
    }));
    await apiSend(`/api/participants/${session.participant?.id}`, "PATCH", {
      study0Ratings: payload,
      completedAt: new Date().toISOString(),
      status: "completed"
    });
    await logClientEvent(session.participant, "study0_ratings_submitted", {
      itemCount: payload.length,
      ratedDimensions: dimensions.length
    });
    setSession({ ...session, ratings, stage: "complete" });
  }

  if (session.stage === "landing") {
    return (
      <ConsentLanding
        lang={lang}
        title={t(lang, "study0")}
        description={lang === "zh"
          ? "验证四种角色特定人格表达是否能被用户感知，并检查它们是否与能力、礼貌、啰嗦或不适感混淆。"
          : "Validate whether role-specific personality expressions are perceivable and not confounded with competence, politeness, verbosity, or discomfort."}
        duration={lang === "zh" ? "10-12 分钟" : "10-12 minutes"}
        onStart={start}
      />
    );
  }

  if (session.stage === "complete") {
    return <main className="page-shell"><CompletionPanel lang={lang} resetSession={resetSession} message={lang === "zh" ? "Study 0 数据已保存。" : "Study 0 data has been saved."} /></main>;
  }

  return (
    <main className="page-shell">
      <section className="work-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t(lang, "study0")}</p>
            <h2>{lang === "zh" ? "人格片段评分" : "Personality Snippet Ratings"}</h2>
          </div>
          <PrimaryButton onClick={submit} icon={<Save size={18} />}>{t(lang, "submit")}</PrimaryButton>
        </div>
        <div className="snippet-list">
          {selectedMaterials.map((item, index) => (
            <article className="snippet-card" key={item.id}>
              <p className="eyebrow">{lang === "zh" ? `片段 ${index + 1}` : `Snippet ${index + 1}`}</p>
              <p className="scenario-brief">{lang === "zh" ? item.scenarioZh : item.scenarioEn}</p>
              <p>{lang === "zh" ? item.zh : item.en}</p>
              <div className="rating-grid">
                {dimensions.map((dimension) => (
                  <SliderField
                    key={dimension.key}
                    label={lang === "zh" ? dimension.labelZh : dimension.labelEn}
                    value={ratings[item.id]?.[dimension.key] ?? 4}
                    onChange={(value) => setRatings({
                      ...ratings,
                      [item.id]: {
                        ...(ratings[item.id] ?? {}),
                        [dimension.key]: value
                      }
                    })}
                  />
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function Study2Page({ lang }: { lang: Language }) {
  const [session, setSession, resetSession] = useSession<{
    stage: "landing" | "controls" | "initial" | "workspace" | "reflection" | "complete";
    participant?: Participant;
    controls?: Record<string, Record<string, number>>;
    initialProposal?: ProposalValue;
  }>("study2-session", { stage: "landing", controls: roleControlDefaults });
  const [controls, setControls] = useState<Record<string, Record<string, number>>>(session.controls ?? roleControlDefaults);
  const [notes, setNotes] = useState("");

  async function start(participantCode: string) {
    const result = await apiSend<{ participant: Participant }>("/api/participants", "POST", {
      study: "study2",
      lang,
      consent: {
        accepted: true,
        acceptedAt: new Date().toISOString(),
        version: "recruitment-ready-v1"
      },
      recruitment: {
        participantCode: participantCode || null,
        source: "local-or-study-link"
      },
      browserInfo: collectBrowserInfo()
    });
    await logClientEvent(result.participant, "stage_entered", { stage: "controls" });
    setSession({ ...session, stage: "controls", participant: result.participant, controls });
  }

  async function saveControls() {
    await apiSend(`/api/participants/${session.participant?.id}`, "PATCH", { study2Controls: controls, status: "controls_completed" });
    await logClientEvent(session.participant, "study2_controls_submitted", { controls });
    setSession({ ...session, controls, stage: "initial" });
  }

  if (session.stage === "landing") {
    return (
      <ConsentLanding
        lang={lang}
        title={t(lang, "study2")}
        description={lang === "zh"
          ? "研究参与者如何理解和调节角色级人格控制，而不是直接调 Big Five 滑杆。"
          : "Probe how users understand and tune role-level personality controls instead of raw Big Five sliders."}
        duration={lang === "zh" ? "45-60 分钟" : "45-60 minutes"}
        onStart={start}
      />
    );
  }

  return (
    <main className="page-shell">
      {session.stage === "controls" && (
        <section className="work-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t(lang, "study2")}</p>
              <h2>{t(lang, "controls")}</h2>
            </div>
            <PrimaryButton onClick={saveControls} icon={<SlidersHorizontal size={18} />}>{t(lang, "saveContinue")}</PrimaryButton>
          </div>
          <RoleControls lang={lang} controls={controls} onChange={setControls} />
        </section>
      )}
      {session.stage === "initial" && (
        <ProposalStage
          lang={lang}
          title={t(lang, "initialProposal")}
          task={topicText(session.participant?.topicId, lang)}
          value={session.initialProposal ?? {}}
          minChars={260}
          onSubmit={async (proposal) => {
            await apiSend(`/api/participants/${session.participant?.id}`, "PATCH", { initialProposal: proposal, status: "initial_completed" });
            await logClientEvent(session.participant, "proposal_submitted", { stage: "study2_initial", stats: proposalStats(proposal) });
            setSession({ ...session, initialProposal: proposal, stage: "workspace" });
          }}
        />
      )}
      {session.stage === "workspace" && session.participant && (
        <Workspace
          lang={lang}
          participant={session.participant}
          initialProposal={session.initialProposal ?? {}}
          study2Controls={controls}
          onFinish={() => setSession({ ...session, stage: "reflection" })}
        />
      )}
      {session.stage === "reflection" && (
        <section className="work-panel narrow">
          <h2>{t(lang, "reflection")}</h2>
          <label className="text-field">
            <span>{lang === "zh" ? "访谈问题记录：你最想调哪个 agent？哪个控制最有用？哪里增加了压力或自主性？" : "Interview notes: which agent did you most want to tune, which control mattered, and where did pressure or agency change?"}</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={12} />
          </label>
          <PrimaryButton
            onClick={async () => {
              await apiSend(`/api/participants/${session.participant?.id}`, "PATCH", {
                study2Controls: controls,
                study2Notes: notes,
                completedAt: new Date().toISOString(),
                status: "completed"
              });
              await logClientEvent(session.participant, "study2_reflection_submitted", {
                controls,
                notesChars: notes.length
              });
              setSession({ ...session, stage: "complete" });
            }}
            icon={<Save size={18} />}
          >
            {t(lang, "submit")}
          </PrimaryButton>
        </section>
      )}
      {session.stage === "complete" && <CompletionPanel lang={lang} resetSession={resetSession} message={lang === "zh" ? "Study 2 控制探针已完成。" : "Study 2 control probe is complete."} />}
    </main>
  );
}

function RoleControls({ lang, controls, onChange }: {
  lang: Language;
  controls: Record<string, Record<string, number>>;
  onChange: (controls: Record<string, Record<string, number>>) => void;
}) {
  return (
    <div className="role-grid">
      {roles.map((role) => (
        <div className="role-card" key={role} style={{ borderTopColor: roleColors[role] }}>
          <div className="role-token" style={{ background: roleColors[role] }}>{roleLabels[role].short}</div>
          <h3>{roleLabels[role][lang]}</h3>
          {(roleControlLabels[role] as Array<{ key: string; en: string; zh: string }>).map((control) => (
            <label className="compact-slider" key={control.key}>
              <span>{lang === "zh" ? control.zh : control.en}</span>
              <input
                type="range"
                min={1}
                max={5}
                value={controls[role]?.[control.key] ?? 3}
                onChange={(event) => onChange({
                  ...controls,
                  [role]: {
                    ...(controls[role] ?? {}),
                    [control.key]: Number(event.target.value)
                  }
                })}
              />
              <strong>{controls[role]?.[control.key] ?? 3}</strong>
            </label>
          ))}
        </div>
      ))}
    </div>
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

  const conditionData = data.conditionSummary.map((item: any) => ({
    condition: item.conditionId,
    n: item.n,
    improvement: item.improvement ?? 0,
    calibration: item.calibration === null ? 0 : Math.round(item.calibration * 100)
  }));
  const mainEffectData = data.roleMainEffects.map((item: any) => ({
    role: roleLabels[item.role as Role]?.[lang] ?? item.role,
    diff: item.improvementDiff ?? 0,
    high: item.improvementHigh ?? 0,
    low: item.improvementLow ?? 0
  }));
  const probeData = data.probeSummary.map((item: any) => ({
    probe: item.title.slice(0, 16),
    accepted: item.accepted,
    rejected: item.rejected,
    questioned: item.questioned,
    reframed: item.reframed
  }));
  const constructData = data.constructSummary.map((item: any) => ({
    construct: item.label,
    mean: item.mean ?? 0
  }));
  const agentRoleData = data.agentRoleSummary.map((item: any) => ({
    role: roleLabels[item.role as Role]?.[lang] ?? item.role,
    latency: item.meanLatencyMs ? Math.round(item.meanLatencyMs) : 0,
    tokens: item.meanTokenEstimate ? Math.round(item.meanTokenEstimate) : 0,
    n: item.n
  }));
  const funnelData = data.completionFunnel.map((item: any) => ({
    stage: item.stage.replace("_", " "),
    count: item.count
  }));
  const directedData = data.directedTurnSummary.map((item: any) => ({
    target: item.key === "all" ? t(lang, "allAgents") : roleLabels[item.key as Role]?.[lang] ?? item.key,
    count: item.count
  }));
  const reliabilityData = data.ratingReliability ?? [];
  const coverageData = data.ratingCoverage ?? [];

  return (
      <section className="work-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t(lang, "analytics")}</p>
            <h2>{lang === "zh" ? "实验结果可视化" : "Experiment Result Visualization"}</h2>
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
          <Metric icon={<UserCheck />} label="Participants" value={data.counts.participants} />
          <Metric icon={<ClipboardCheck />} label="Completed Study 1" value={data.counts.completedStudy1} />
          <Metric icon={<Gauge />} label="Blind ratings" value={data.counts.ratings} />
          <Metric icon={<ClipboardCheck />} label="Fully rated items" value={`${data.counts.fullyRatedBlindItems ?? 0}/${data.counts.expectedBlindItems ?? 0}`} />
          <Metric icon={<MessageSquare />} label="Events" value={data.counts.events} />
        </div>
        {data.counts.participants === 0 && <div className="empty-state">{t(lang, "emptyData")}</div>}
        <div className="chart-grid">
          <ChartPanel title={lang === "zh" ? "各条件样本量与校准行为" : "Condition N and Calibration"}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={conditionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="condition" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="n" fill="#1f77b4" />
                <Bar dataKey="calibration" fill="#2a9d8f" />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>
          <ChartPanel title={lang === "zh" ? "角色人格主效应估计" : "Role Personality Main Effects"}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={mainEffectData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="role" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="diff" fill="#6d5bd0" />
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
          <ChartPanel title={lang === "zh" ? "盲评 improvement 趋势" : "Blind-rated Improvement by Condition"}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={conditionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="condition" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="improvement">
                  {conditionData.map((_: unknown, index: number) => <Cell key={index} fill={index === 7 ? "#2a9d8f" : "#1f77b4"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>
          <ChartPanel title={lang === "zh" ? "Study 1 完成漏斗" : "Study 1 Completion Funnel"}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={funnelData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="stage" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#2a9d8f" />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>
          <ChartPanel title={lang === "zh" ? "问卷构念均值" : "Survey Construct Means"}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={constructData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="construct" />
                <YAxis domain={[0, 7]} />
                <Tooltip />
                <Bar dataKey="mean" fill="#1f77b4" />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>
          <ChartPanel title={lang === "zh" ? "Agent 延迟与长度监控" : "Agent Latency and Length Monitor"}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={agentRoleData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="role" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="latency" fill="#6d5bd0" />
                <Bar dataKey="tokens" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>
          <ChartPanel title={lang === "zh" ? "用户定向询问对象" : "User-Directed Turn Targets"}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={directedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="target" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#c2410c" />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>
          <ChartPanel title={lang === "zh" ? "盲评覆盖率" : "Blind Rating Coverage"}>
            <table className="quality-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Rated</th>
                  <th>Needed</th>
                </tr>
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
                <tr>
                  <th>Dimension</th>
                  <th>Alpha</th>
                  <th>{"Items n>=2"}</th>
                </tr>
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
        {!selected && <div className="empty-state">{lang === "zh" ? "暂无可评分的 Study 1 方案。" : "No completed Study 1 proposals to rate yet."}</div>}
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
