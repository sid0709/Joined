"use client";

import { useState } from "react";
import { Badge, Card, EmptyState } from "@/src/shared/marketplace-ui";
import { ApplicantChat } from "@/src/client/components/ApplicantChat";
import { ApplicantList } from "@/src/client/components/ApplicantList";
import { ProposalComparison } from "@/src/client/components/ProposalComparison";
import { RoomThreadList } from "@/src/client/components/RoomThreadList";
import { JobRoomRecord, ProposalReviewAction, RoomApplicationsMap } from "@/src/shared/types/job-room";

interface ClientApplicationsManagerProps {
  rooms: JobRoomRecord[];
  registry: RoomApplicationsMap;
  onSendMessage: (roomId: string, candidateId: string, role: "Client", text: string) => void;
  onApprove: (roomId: string, candidateId: string) => void;
  onReviewProposal: (roomId: string, candidateId: string, action: ProposalReviewAction) => void;
  onUpdateProposalNote: (roomId: string, candidateId: string, note: string) => void;
  fullPage?: boolean;
}

export function ClientApplicationsManager({ rooms, registry, onSendMessage, onApprove, onReviewProposal, onUpdateProposalNote, fullPage = false }: ClientApplicationsManagerProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(rooms[0]?.id ?? null);
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const resolvedRoomId = rooms.some((room) => room.id === selectedRoomId) ? selectedRoomId : rooms[0]?.id ?? null;
  const activeRoomData = resolvedRoomId ? registry[resolvedRoomId] : undefined;
  const proposals = activeRoomData?.proposals ?? [];
  const resolvedCandidateId = proposals.some((proposal) => proposal.id === activeCandidateId) ? activeCandidateId : proposals[0]?.id ?? null;
  const activeProposal = proposals.find((proposal) => proposal.id === resolvedCandidateId);
  const messages = resolvedRoomId && resolvedCandidateId ? activeRoomData?.chatHistory[resolvedCandidateId] ?? [] : [];
  const selectedRoom = rooms.find((room) => room.id === resolvedRoomId);
  const comparableProposals = proposals.filter((proposal) => compareIds.includes(proposal.id));
  const proposalCount = rooms.reduce((total, room) => total + (registry[room.id]?.proposals.length ?? 0), 0);
  const pendingCount = rooms.reduce(
    (total, room) => total + (registry[room.id]?.proposals.filter((proposal) => proposal.status === "Pending").length ?? 0),
    0,
  );

  return (
    <div className={`marketplace-applications-workspace ${fullPage ? "marketplace-applications-workspace-full" : ""}`}>
      <div className="marketplace-applications-hero">
        <div>
          <span className="label text-primary">CLIENT WORKSPACE</span>
          <h1 className="display">Review applications</h1>
          <p className="body text-ink-muted">Compare proposals, ask better questions, and move the right person into delivery.</p>
        </div>
        <div className="marketplace-application-stats" aria-label="Application summary">
          <div className="marketplace-application-stat"><strong>{rooms.length}</strong><span>Job rooms</span></div>
          <div className="marketplace-application-stat"><strong>{proposalCount}</strong><span>Total applicants</span></div>
          <div className="marketplace-application-stat"><strong>{pendingCount}</strong><span>Needs review</span></div>
        </div>
      </div>
      {!rooms.length ? (
        <Card><EmptyState title="No room threads yet" description="Applications will appear here when candidates respond to your rooms." /></Card>
      ) : (
        <div className="marketplace-applications-shell">
          <aside className="marketplace-room-panel">
            <div className="marketplace-panel-heading">
              <div><span className="label text-primary">INBOX</span><h2 className="h2">Job rooms</h2></div>
              <Badge label={`${rooms.length}`} tone="neutral" />
            </div>
            <RoomThreadList
              rooms={rooms}
              registry={registry}
              selectedRoomId={resolvedRoomId}
              onSelect={(roomId) => { setSelectedRoomId(roomId); setActiveCandidateId(null); setCompareIds([]); }}
            />
            <div className="marketplace-panel-note">
              <strong>Hiring tip</strong>
              <span>Look for a clear plan, relevant experience, and thoughtful questions—not only the lowest rate.</span>
            </div>
          </aside>
          <section className="marketplace-applications-main">
            {selectedRoom && (
              <div className="marketplace-selected-room-header">
                <div>
                  <span className="caption text-ink-muted">Selected job room</span>
                  <h2 className="h2">{selectedRoom.title}</h2>
                  <p className="body-sm text-ink-muted">{selectedRoom.budgetType}: {selectedRoom.rateOrBudgetRangeText} · {selectedRoom.experienceLevelRequired} · {selectedRoom.durationEstimateText}</p>
                </div>
                <Badge label={`${proposals.length} applicants`} tone="neutral" />
              </div>
            )}
            {proposals.length ? (
              <div className="marketplace-applicants-workspace">
                <section className="marketplace-applicants-panel">
                  <div className="marketplace-panel-heading">
                    <div><span className="label text-primary">SHORTLIST</span><h2 className="h2">Applicants</h2></div>
                    <Badge label={`${proposals.length}`} tone="neutral" />
                  </div>
                  <ApplicantList
                    proposals={proposals}
                    activeCandidateId={resolvedCandidateId}
                    onSelect={setActiveCandidateId}
                    compareIds={compareIds}
                    onToggleCompare={(candidateId) => setCompareIds((current) => current.includes(candidateId) ? current.filter((id) => id !== candidateId) : [...current, candidateId])}
                  />
                </section>
                <section className="marketplace-applicant-detail-panel">
                  {comparableProposals.length >= 2 && (
                    <ProposalComparison
                      proposals={comparableProposals}
                      onSelect={setActiveCandidateId}
                      onClose={() => setCompareIds([])}
                    />
                  )}
                  <ApplicantChat
                    key={activeProposal?.id ?? "empty-applicant"}
                    proposal={activeProposal}
                    messages={messages}
                    clientNote={activeProposal?.clientNote}
                    onReview={(action) => resolvedRoomId && resolvedCandidateId && onReviewProposal(resolvedRoomId, resolvedCandidateId, action)}
                    onSaveNote={(note) => resolvedRoomId && resolvedCandidateId && onUpdateProposalNote(resolvedRoomId, resolvedCandidateId, note)}
                    onSendMessage={(text) => resolvedRoomId && resolvedCandidateId && onSendMessage(resolvedRoomId, resolvedCandidateId, "Client", text)}
                    onApprove={() => resolvedRoomId && resolvedCandidateId && onApprove(resolvedRoomId, resolvedCandidateId)}
                  />
                </section>
              </div>
            ) : (
              <Card><EmptyState title="No applications yet" description="This room has not received an application." /></Card>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
