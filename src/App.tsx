import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as tmImage from "@teachablemachine/image";

const MODEL_BASE_URL = "https://teachablemachine.withgoogle.com/models/Mg5WZBK1d/";
const MODEL_LABELS = ["1234", "5678"];
const CONFIDENCE_THRESHOLD = 0.9;

type ImageModel = {
  predict: (image: HTMLVideoElement) => Promise<Array<{ className: string; probability: number }>>;
};

type IconName =
  | "calendar"
  | "camera"
  | "chart"
  | "check"
  | "chevron"
  | "clock"
  | "download"
  | "grid"
  | "refresh"
  | "search"
  | "settings"
  | "shield"
  | "users"
  | "x";

const iconPaths: Record<IconName, ReactNode> = {
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  camera: <><path d="M14.5 6 13 4H7L5.5 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2Z" /><circle cx="10" cy="12" r="4" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  refresh: <><path d="M20 7h-5V2" /><path d="M19 15a8 8 0 1 1-1-9l2 1" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1-2.8 2.8-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1 1.6v.2h-4V21a1.8 1.8 0 0 0-1-1.6 1.8 1.8 0 0 0-2 .4l-.1.1-2.8-2.8.1-.1a1.8 1.8 0 0 0 .4-2A1.8 1.8 0 0 0 3 14H2.8v-4H3a1.8 1.8 0 0 0 1.6-1 1.8 1.8 0 0 0-.4-2l-.1-.1 2.8-2.8.1.1a1.8 1.8 0 0 0 2 .4A1.8 1.8 0 0 0 10 3v-.2h4V3a1.8 1.8 0 0 0 1 1.6 1.8 1.8 0 0 0 2-.4l.1-.1 2.8 2.8-.1.1a1.8 1.8 0 0 0-.4 2 1.8 1.8 0 0 0 1.6 1h.2v4H21a1.8 1.8 0 0 0-1.6 1Z" /></>,
  shield: <><path d="M12 3 4 6v5c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6Z" /><path d="m9 12 2 2 4-5" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>;
}

const people = MODEL_LABELS.map((name, index) => ({
  id: `EMP-00${index + 1}`,
  name,
  initials: name.slice(-2),
  department: "已录入人员",
  color: ["avatar-blue", "avatar-violet"][index],
}));

const initialRecords = people.map((person) => ({
  ...person,
  status: "absent",
  time: "—",
  confidence: "—",
}));

const weeklyRows = [
  { day: "周一", date: "10月05日", attendance: 2, total: 2 },
  { day: "周二", date: "10月06日", attendance: 2, total: 2 },
  { day: "周三", date: "10月07日", attendance: 0, total: 2 },
  { day: "周四", date: "10月08日", attendance: 0, total: 2 },
  { day: "周五", date: "10月09日", attendance: 0, total: 2 },
];

function AppButton({ children, className = "", onClick, disabled = false }: { children: ReactNode; className?: string; onClick?: () => void; disabled?: boolean }) {
  return <button className={`app-button ${className}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

export default function App() {
  const [activePage, setActivePage] = useState<"dashboard" | "report">("dashboard");
  const [records, setRecords] = useState(initialRecords);
  const [now, setNow] = useState(new Date());
  const [isScanning, setIsScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<"blocked" | "denied" | "unavailable" | null>(null);
  const [scanMessage, setScanMessage] = useState("请正对摄像头，保持面部清晰");
  const [toast, setToast] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<ImageModel | null>(null);
  const animationRef = useRef<number | null>(null);
  const scanningRef = useRef(false);
  const clockedLabelsRef = useRef(new Set<string>());
  const lastStatusRef = useRef("");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => {
    scanningRef.current = false;
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const clocked = records.filter((item) => item.status === "clocked").length;
  const dateText = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(now);
  const timeText = now.toLocaleTimeString("zh-CN", { hour12: false });

  const reportRows = useMemo(() => weeklyRows.map((row, index) =>
    index === 2 ? { ...row, attendance: clocked } : row
  ), [clocked]);

  const updateScanMessage = (message: string) => {
    if (lastStatusRef.current !== message) {
      lastStatusRef.current = message;
      setScanMessage(message);
    }
  };

  const runRecognition = async () => {
    if (!scanningRef.current || !modelRef.current || !videoRef.current) return;
    try {
      const predictions = await modelRef.current.predict(videoRef.current);
      const best = predictions.reduce((top, prediction) =>
        prediction.probability > top.probability ? prediction : top
      );
      const confidence = Math.round(best.probability * 1000) / 10;

      if (best.probability >= CONFIDENCE_THRESHOLD && MODEL_LABELS.includes(best.className)) {
        if (!clockedLabelsRef.current.has(best.className)) {
          clockedLabelsRef.current.add(best.className);
          setRecords((current) => current.map((item) => item.name === best.className ? {
            ...item,
            status: "clocked",
            time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
            confidence: `${confidence}%`,
          } : item));
          updateScanMessage(`识别成功：${best.className}，已自动完成打卡`);
          setToast(`${best.className} 打卡成功`);
          window.setTimeout(() => setToast(""), 2800);
        } else {
          updateScanMessage(`已识别 ${best.className} · 今日已打卡`);
        }
      } else {
        updateScanMessage(`正在识别：${best.className} · ${confidence}%`);
      }
    } catch {
      updateScanMessage("识别暂时中断，正在重试…");
    }
    if (scanningRef.current) animationRef.current = requestAnimationFrame(runRecognition);
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setIsScanning(true);
      setCameraError("unavailable");
      updateScanMessage("当前浏览器不支持摄像头访问");
      return;
    }

    const policyDocument = document as Document & {
      featurePolicy?: { allowsFeature: (feature: string) => boolean };
      permissionsPolicy?: { allowsFeature: (feature: string) => boolean };
    };
    const cameraAllowedByHost =
      policyDocument.permissionsPolicy?.allowsFeature("camera") ??
      policyDocument.featurePolicy?.allowsFeature("camera") ??
      true;

    if (!cameraAllowedByHost) {
      setIsScanning(true);
      setCameraError("blocked");
      updateScanMessage("当前预览窗口禁止摄像头权限，请在新窗口中完成授权");
      return;
    }

    // Keep getUserMedia in the original click task so browsers can show their native prompt.
    const streamPromise = navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    setCameraActive(false);
    setCameraError(null);
    updateScanMessage("请允许浏览器使用摄像头…");
    try {
      const stream = await streamPromise;
      setIsScanning(true);
      streamRef.current = stream;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (!videoRef.current) throw new Error("Camera view unavailable");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraActive(true);
      updateScanMessage("摄像头已连接，正在加载识别模型…");

      if (!modelRef.current) {
        modelRef.current = await tmImage.load(
          `${MODEL_BASE_URL}model.json`,
          `${MODEL_BASE_URL}metadata.json`,
        ) as ImageModel;
      }
      scanningRef.current = true;
      updateScanMessage("模型已就绪，请正对摄像头");
      animationRef.current = requestAnimationFrame(runRecognition);
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setIsScanning(true);
      setCameraActive(false);
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError");
      setCameraError(denied ? "denied" : "unavailable");
      updateScanMessage(denied ? "摄像头权限未开放，请允许访问或在新窗口中重试" : "摄像头或识别模型加载失败，请重试");
    }
  };

  const openCameraWindow = () => {
    const opened = window.open(window.location.href, "_blank", "noopener,noreferrer");
    if (!opened) {
      setToast("新窗口被浏览器拦截，请允许弹出窗口");
      window.setTimeout(() => setToast(""), 2800);
    }
  };

  const closeCamera = () => {
    scanningRef.current = false;
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
    setIsScanning(false);
  };

  const exportReport = () => {
    const csv = ["日期,应到,实到,出勤率", ...reportRows.map((row) => `${row.date},${row.total},${row.attendance},${Math.round(row.attendance / row.total * 100)}%`)].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    link.download = "本周考勤报表.csv";
    link.click();
    URL.revokeObjectURL(link.href);
    setToast("周报已导出");
    window.setTimeout(() => setToast(""), 2400);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Icon name="shield" size={22} /></div>
          <div><div className="brand-name">FaceClock</div><div className="brand-subtitle">智能考勤系统</div></div>
        </div>
        <nav className="nav-list" aria-label="主要导航">
          <AppButton className={activePage === "dashboard" ? "nav-item active" : "nav-item"} onClick={() => setActivePage("dashboard")}><Icon name="grid" /><span>工作台</span></AppButton>
          <AppButton className="nav-item" onClick={() => setToast("人员档案已同步")}><Icon name="users" /><span>人员管理</span></AppButton>
          <AppButton className={activePage === "report" ? "nav-item active" : "nav-item"} onClick={() => setActivePage("report")}><Icon name="chart" /><span>考勤报表</span></AppButton>
          <AppButton className="nav-item" onClick={() => setToast("系统设置功能即将开放")}><Icon name="settings" /><span>系统设置</span></AppButton>
        </nav>
        <div className="sidebar-footer">
          <div className="system-dot" />
          <div><div className="system-title">系统运行正常</div><div className="system-sub">在线模型 · {MODEL_LABELS.length} 人已录入</div></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <div className="eyebrow">{activePage === "dashboard" ? "ATTENDANCE OVERVIEW" : "WEEKLY INSIGHTS"}</div>
            <div className="page-title">{activePage === "dashboard" ? "考勤工作台" : "本周考勤报告"}</div>
            <div className="page-subtitle">{dateText}</div>
          </div>
          <div className="top-actions">
            <div className="live-time"><span className="live-dot" /><span>{timeText}</span></div>
            <div className="admin-avatar">管</div>
            <div className="admin-copy"><strong>管理员</strong><span>系统管理员</span></div>
            <Icon name="chevron" size={16} />
          </div>
        </header>

        {activePage === "dashboard" ? (
          <div className="content">
            <section className="rule-banner">
              <div className="rule-icon"><Icon name="clock" size={22} /></div>
              <div className="rule-copy"><strong>每日打卡时间：13:00</strong><span>所有成员须在中午 1 点完成面部识别，超时未打卡将自动记为缺勤。</span></div>
              <div className="rule-status"><span />规则已启用</div>
            </section>

            <section className="stats-grid">
              <div className="stat-card dark-card">
                <div className="stat-top"><span>今日完成打卡</span><div className="stat-icon"><Icon name="check" /></div></div>
                <div className="stat-value">{clocked}<small> / {records.length}</small></div>
                <div className="progress"><span style={{ width: `${clocked / records.length * 100}%` }} /></div>
                <div className="stat-foot">完成率 {Math.round(clocked / records.length * 100)}%</div>
              </div>
              <div className="stat-card">
                <div className="stat-top"><span>已打卡</span><div className="stat-icon green"><Icon name="users" /></div></div>
                <div className="stat-value ink">{clocked}<small> 人</small></div>
                <div className="stat-foot positive"><Icon name="check" size={15} /> 数据实时同步</div>
              </div>
              <div className="stat-card">
                <div className="stat-top"><span>缺勤</span><div className="stat-icon coral"><Icon name="x" /></div></div>
                <div className="stat-value ink">{records.length - clocked}<small> 人</small></div>
                <div className="stat-foot muted">截止时间 13:00</div>
              </div>
              <div className="stat-card">
                <div className="stat-top"><span>本周出勤率</span><div className="stat-icon blue"><Icon name="chart" /></div></div>
                <div className="stat-value ink">93.3<small>%</small></div>
                <div className="stat-foot positive">较上周提升 2.1%</div>
              </div>
            </section>

            <div className="dashboard-grid">
              <section className="panel attendance-panel">
                <div className="panel-header">
                  <div><div className="panel-title">今日打卡记录</div><div className="panel-subtitle">实时更新成员打卡状态</div></div>
                  <div className="panel-actions">
                    <AppButton className="icon-button" onClick={() => setToast("数据已刷新")}><Icon name="refresh" size={17} /></AppButton>
                    <AppButton className="primary-button" onClick={openCamera}><Icon name="camera" size={17} /> 开始打卡</AppButton>
                  </div>
                </div>
                <div className="record-table">
                  <div className="table-row table-head"><span>成员</span><span>部门</span><span>打卡时间</span><span>识别率</span><span>状态</span></div>
                  {records.map((record) => (
                    <div className="table-row" key={record.id}>
                      <div className="person-cell"><div className={`person-avatar ${record.color}`}>{record.initials}</div><div><strong>{record.name}</strong><small>{record.id}</small></div></div>
                      <span className="department">{record.department}</span>
                      <span className="time-cell">{record.time}</span>
                      <span className="confidence">{record.confidence}</span>
                      <span><span className={record.status === "clocked" ? "status clocked" : "status absent"}>{record.status === "clocked" ? "已打卡" : "缺勤"}</span></span>
                    </div>
                  ))}
                </div>
                <div className="table-footer">共 {records.length} 位成员 · 最后同步于 {timeText}</div>
              </section>

              <section className="panel mini-report">
                <div className="panel-header">
                  <div><div className="panel-title">本周概览</div><div className="panel-subtitle">10月05日—10月09日</div></div>
                  <AppButton className="text-button" onClick={() => setActivePage("report")}>查看周报 <Icon name="chevron" size={15} /></AppButton>
                </div>
                <div className="week-summary">
                  <div className="ring"><div><strong>93</strong><span>%</span><small>平均出勤</small></div></div>
                  <div className="week-metrics">
                    <div><span className="metric-dot green-dot" /><span>正常出勤</span><strong>14 次</strong></div>
                    <div><span className="metric-dot coral-dot" /><span>缺勤记录</span><strong>{records.length - clocked} 次</strong></div>
                    <div><span className="metric-dot blue-dot" /><span>应打卡</span><strong>15 次</strong></div>
                  </div>
                </div>
                <div className="day-bars">
                  {reportRows.map((row) => <div className="day-bar" key={row.day}><div className="bar-track"><span style={{ height: `${Math.max(8, row.attendance / row.total * 100)}%` }} /></div><small>{row.day}</small></div>)}
                </div>
              </section>
            </div>
          </div>
        ) : (
          <div className="content report-page">
            <section className="report-hero">
              <div><div className="report-kicker"><Icon name="calendar" size={16} /> 10月05日—10月09日</div><div className="report-heading">团队出勤保持稳定</div><p>本周已有 9 次有效打卡记录，数据随每日识别结果实时更新。</p></div>
              <AppButton className="export-button" onClick={exportReport}><Icon name="download" size={17} /> 导出周报</AppButton>
            </section>
            <section className="report-stat-grid">
              <div><span>本周平均出勤率</span><strong>93.3%</strong><small className="up">较上周 +2.1%</small></div>
              <div><span>有效打卡</span><strong>9</strong><small>共 15 次应打卡</small></div>
              <div><span>准时率</span><strong>88.9%</strong><small>13:00 前完成</small></div>
            </section>
            <section className="panel weekly-table-panel">
              <div className="panel-header"><div><div className="panel-title">每日出勤明细</div><div className="panel-subtitle">数据基于 13:00 定时打卡规则</div></div><span className="realtime-badge"><span />实时更新</span></div>
              <div className="weekly-table">
                <div className="weekly-row weekly-head"><span>日期</span><span>应到人数</span><span>实到人数</span><span>出勤率</span><span>状态</span></div>
                {reportRows.map((row, index) => {
                  const rate = Math.round(row.attendance / row.total * 100);
                  const future = index > 2;
                  return <div className="weekly-row" key={row.day}><div><strong>{row.day}</strong><small>{row.date}</small></div><span>{row.total}</span><span>{future ? "—" : row.attendance}</span><div className="rate-cell"><div><span style={{ width: `${future ? 0 : rate}%` }} /></div><strong>{future ? "—" : `${rate}%`}</strong></div><span><span className={future ? "status upcoming" : rate === 100 ? "status clocked" : "status absent"}>{future ? "待统计" : rate === 100 ? "全员出勤" : "存在缺勤"}</span></span></div>;
                })}
              </div>
            </section>
          </div>
        )}
      </main>

      {isScanning && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="人脸识别打卡">
        <div className="scan-modal">
          <div className="scan-header"><div><div className="panel-title">人脸识别打卡</div><div className="panel-subtitle">在线识别模型 · {MODEL_LABELS.length} 人已录入</div></div><AppButton className="icon-button" onClick={closeCamera}><Icon name="x" /></AppButton></div>
          <div className="camera-view">
            <video ref={videoRef} autoPlay muted playsInline className={cameraActive ? "camera-video visible" : "camera-video"} />
            {!cameraActive && <div className="camera-placeholder"><Icon name="camera" size={34} /><span>摄像头预览区</span></div>}
            <div className="face-frame"><i /><i /><i /><i /></div>
            <span className="demo-label">实时识别</span>
          </div>
          <div className="scan-status"><span className="scan-pulse" /><span>{scanMessage}</span></div>
          {cameraActive ? (
            <AppButton className="primary-button scan-button" disabled><Icon name="search" size={18} /> 自动识别中，无需操作</AppButton>
          ) : (
            <div className="permission-actions">
              <AppButton className="primary-button scan-button" onClick={openCamera}><Icon name="camera" size={18} /> 请求摄像头权限</AppButton>
              {cameraError && <AppButton className="secondary-button scan-button" onClick={openCameraWindow}>在新窗口打开并授权</AppButton>}
            </div>
          )}
          {cameraError === "denied" && <div className="permission-tip">如果之前选择了“不允许”，请点击地址栏左侧的网站权限图标，将摄像头改为“允许”后再重试。</div>}
          {cameraError === "blocked" && <div className="permission-tip">Figma 预览面板的安全策略阻止了摄像头请求。新窗口不受此限制，可正常显示浏览器授权弹窗。</div>}
          <p className="privacy-note"><Icon name="shield" size={14} /> 面部画面仅用于本地识别，不会上传或存储</p>
        </div>
      </div>}

      {toast && <div className="toast"><Icon name="check" size={17} />{toast}</div>}
    </div>
  );
}
