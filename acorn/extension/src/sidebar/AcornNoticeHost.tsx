import { useEffect, useState, type CSSProperties } from "react";
import { MSG, type AcornNoticePayload } from "../types";
import {
  bindAcornNoticePush,
  NOTICE_EXIT_MS,
  noticeKindDuration,
  pushAcornNotice,
  type AcornNotice,
} from "./acorn-notice";
import "./AcornNotice.css";

function NoticeIcon({ kind }: { kind: AcornNotice["kind"] }) {
  if (kind === "success") {
    return (
      <span className="acorn-notice-icon success" aria-hidden="true">
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
      <span className="acorn-notice-icon info" aria-hidden="true">
        i
      </span>
    );
  }
  return (
    <span className="acorn-notice-icon error" aria-hidden="true">
      !
    </span>
  );
}

export function AcornNoticeHost() {
  const [notices, setNotices] = useState<AcornNotice[]>([]);

  useEffect(() => {
    return bindAcornNoticePush((payload) => {
      const notice: AcornNotice = {
        ...payload,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        phase: "in",
      };
      setNotices([notice]);
    });
  }, []);

  useEffect(() => {
    const onMessage = (message: { type?: string; notice?: AcornNoticePayload }) => {
      if (message.type !== MSG.OPERATOR_NOTICE || !message.notice?.title) return;
      const { kind, title, detail } = message.notice;
      if (kind !== "error" && kind !== "success" && kind !== "info") return;
      pushAcornNotice({ kind, title, detail });
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
    <div className="acorn-notice-stack" aria-live="polite">
      {notices.map((notice) => (
        <article
          key={notice.id}
          className={`acorn-notice ${notice.kind}${notice.phase === "out" ? " is-leaving" : ""}`}
          role="status"
          style={{ "--acorn-notice-hold": `${noticeKindDuration(notice.kind)}ms` } as CSSProperties}
        >
          <NoticeIcon kind={notice.kind} />
          <div className="acorn-notice-copy">
            <p className="acorn-notice-title">{notice.title}</p>
            {notice.detail ? <p className="acorn-notice-detail">{notice.detail}</p> : null}
          </div>
          <button
            type="button"
            className="acorn-notice-close"
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
