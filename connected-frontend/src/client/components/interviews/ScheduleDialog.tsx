"use client";

import { useMemo, useState } from "react";

import type { Interview, InterviewMode } from "@/src/client/types/hunter";

import { DateField } from "@/src/client/components/ui/Fields";
import { useHunter } from "@/src/client/context/HunterContext";
import { STAGE_TITLE } from "@/src/client/data/pipeline";
import {
  DURATIONS,
  MODE_LABEL,
  dateFromYmd,
  displayClock,
  openSlots,
} from "@/src/client/lib/interviews";
import { Banner, Button, Modal, Select, TextArea } from "@/src/shared/marketplace-ui";

interface ScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  /** Pre-select a bidder when opened from a card or the pipeline. */
  inquiryId?: string;
  date: string;
  /** When set, the dialog reschedules this interview instead of creating one. */
  editing?: Interview;
  onDone?: (message: string) => void;
}

/** Books or moves an interview. Only free slots inside your working hours are offered. */
export function ScheduleDialog({
  open,
  onClose,
  inquiryId,
  date: initialDate,
  editing,
  onDone,
}: ScheduleDialogProps) {
  const {
    inquiries,
    bidderById,
    taskById,
    interviews,
    profile,
    scheduleInterview,
    rescheduleInterview,
  } = useHunter();
  const { availability } = profile;
  const candidates = inquiries.filter(
    (item) => item.stage !== "declined" && item.stage !== "connected",
  );
  const [selectedId, setSelectedId] = useState(editing?.inquiryId ?? inquiryId ?? "");
  const [date, setDate] = useState(editing?.date ?? initialDate);
  const [duration, setDuration] = useState(
    String(editing?.durationMin ?? availability.defaultDurationMin),
  );
  const [mode, setMode] = useState<InterviewMode>(editing?.mode ?? "video");
  const [start, setStart] = useState(editing?.start ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const slots = useMemo(
    () => openSlots(date, Number(duration), availability, interviews, editing?.id),
    [date, duration, availability, interviews, editing?.id],
  );
  const dayOff = !availability.days.includes(dateFromYmd(date).getDay());
  const chosen = slots.includes(start) ? start : "";

  const submit = () => {
    if (!selectedId) return setError("Choose which bidder you are interviewing.");
    if (!chosen) return setError("Pick one of the open time slots.");
    if (editing) {
      rescheduleInterview(editing.id, { date, start: chosen, durationMin: Number(duration) });
      onDone?.("Interview rescheduled.");
    } else {
      const result = scheduleInterview({
        inquiryId: selectedId,
        date,
        start: chosen,
        durationMin: Number(duration),
        mode,
        link: mode === "video" ? availability.meetingLink : undefined,
        notes: notes.trim(),
      });
      if (!result.ok) return setError(result.error ?? "Could not book this interview.");
      onDone?.("Interview scheduled. The bidder was moved to the Interview stage.");
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Reschedule interview" : "Schedule an interview"}
      footer={
        <div className="hx-row hx-row-between" style={{ padding: "var(--space-4)" }}>
          <span className="hx-small hx-muted">{availability.timezone}</span>
          <div className="hx-row">
            <Button variant="ghost" label="Cancel" onClick={onClose} />
            <Button
              variant="primary"
              label={editing ? "Save new time" : "Book interview"}
              onClick={submit}
            />
          </div>
        </div>
      }
    >
      <div className="hx-inline-form" style={{ padding: "var(--space-4)" }}>
        {error && <Banner tone="danger" title={error} />}
        <Select
          label="Bidder"
          value={selectedId}
          placeholder="Choose a bidder"
          disabled={Boolean(editing)}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {candidates.map((item) => (
            <option key={item.id} value={item.id}>
              {bidderById(item.bidderId)?.name} · {taskById(item.taskId)?.title} ·{" "}
              {STAGE_TITLE[item.stage]}
            </option>
          ))}
        </Select>
        <div className="hx-field-grid">
          <DateField label="Date" value={date} onChange={setDate} />
          <Select
            label="Length"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          >
            {DURATIONS.map((minutes) => (
              <option key={minutes} value={String(minutes)}>
                {minutes} minutes
              </option>
            ))}
          </Select>
          {!editing && (
            <Select
              label="Format"
              value={mode}
              onChange={(event) => setMode(event.target.value as InterviewMode)}
            >
              {Object.entries(MODE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </div>
        <div className="hx-stack hx-stack-sm">
          <strong className="hx-strong">Open times</strong>
          {dayOff ? (
            <span className="hx-small hx-muted">
              You are not available on this day. Change your working days on your profile, or pick
              another date.
            </span>
          ) : slots.length ? (
            <div className="hx-chip-row">
              {slots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className="hx-chip hx-slot"
                  aria-pressed={slot === chosen}
                  onClick={() => setStart(slot)}
                >
                  {displayClock(slot)}
                </button>
              ))}
            </div>
          ) : (
            <span className="hx-small hx-muted">
              No free slots that day. Try another date or a shorter length.
            </span>
          )}
        </div>
        {!editing && (
          <TextArea
            label="Agenda for this interview"
            placeholder="What do you want to confirm? Availability, samples, rate…"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        )}
      </div>
    </Modal>
  );
}
