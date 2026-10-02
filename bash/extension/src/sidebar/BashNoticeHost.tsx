import { useEffect, useState, type CSSProperties } from "react";
import { MSG, type BashNoticePayload } from "../types";
import {
  bindBashNoticePush,
  NOTICE_EXIT_MS,
  noticeKindDuration,
  pushBashNotice,
  type BashNotice,
} from "./bash-notice";
import "./BashNotice.css";

function NoticeIcon({ kind }: { kind: BashNotice["kind"] }) {
  if (kind === "success") {
    return (
      <span className="bash-notice-icon success" aria-hidden="true">
        <svg viewBox="0 0 20 20" width="12" height="12" fill="none">
          <path
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 10.5 8.2 13.5 15 6.5"
          />
        </svg>
      </span>
    );
  }
  if (kind === "info") {
    return (
      <span className="bash-notice-icon info" aria-hidden="true">
        i
      </span>
    );
  }
  return (
    <span className="bash-notice-icon error" aria-hidden="true">
      !
    </span>
  );
}

export function BashNoticeHost() {
  const [notices, setNotices] = useState<BashNotice[]>([]);

  useEffect(() => {
    return bindBashNoticePush((payload) => {
      const notice: BashNotice = {
        ...payload,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        phase: "in",
      };
      setNotices([notice]);
    });
  }, []);

  useEffect(() => {
    const onMessage = (message: { type?: string; notice?: BashNoticePayload }) => {
      if (message.type !== MSG.OPERATOR_NOTICE || !message.notice?.title) return;
      const { kind, title, detail } = message.notice;
      if (kind !== "error" && kind !== "success" && kind !== "info") return;
      pushBashNotice({ kind, title, detail });
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

  useEffect(() => {
    const latest = notices[notices.length - 1];
    if (!latest) return undefined;
    if (latest.phase === "out") {
      const timer = window.setTimeout(() => {
        setNotices((prev) => prev.filter((row) => row.id !== latest.id));
      }, NOTICE_EXIT_MS);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      setNotices((prev) =>
        prev.map((row) => (row.id === latest.id ? { ...row, phase: "out" } : row)),
      );
    }, noticeKindDuration(latest.kind));
    return () => window.clearTimeout(timer);
  }, [notices]);

  if (notices.length === 0) return null;

  return (
    <div className="bash-notice-stack" aria-live="polite">
      {notices.map((notice) => (
        <article
          key={notice.id}
          className={`bash-notice ${notice.kind}${notice.phase === "out" ? " is-leaving" : ""}`}
          role="status"
          style={{ "--bash-notice-hold": `${noticeKindDuration(notice.kind)}ms` } as CSSProperties}
        >
          <NoticeIcon kind={notice.kind} />
          <div className="bash-notice-copy">
            <p className="bash-notice-title">{notice.title}</p>
            {notice.detail ? <p className="bash-notice-detail">{notice.detail}</p> : null}
          </div>
          <button
            type="button"
            className="bash-notice-close"
            aria-label="Dismiss"
            onClick={() =>
              setNotices((prev) =>
                prev.map((row) => (row.id === notice.id ? { ...row, phase: "out" } : row)),
              )
            }
          >
            ×
          </button>
        </article>
      ))}
    </div>
  );
}
