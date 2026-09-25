"use client";

import { useState } from "react";
import { Card, EmptyState, Stack } from "@/src/shared/marketplace-ui";
import { ApplicantChat } from "@/src/client/components/ApplicantChat";
import { ApplicantList } from "@/src/client/components/ApplicantList";
import { RoomThreadList } from "@/src/client/components/RoomThreadList";
import { JobRoomRecord, RoomApplicationsMap } from "@/src/shared/types/job-room";

interface ClientApplicationsManagerProps {
  rooms: JobRoomRecord[];
  registry: RoomApplicationsMap;
  onSendMessage: (roomId: string, candidateId: string, role: "Client", text: string) => void;
  onApprove: (roomId: string, candidateId: string) => void;
}

export function ClientApplicationsManager({ rooms, registry, onSendMessage, onApprove }: ClientApplicationsManagerProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(rooms[0]?.id ?? null);
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);

  const resolvedRoomId = rooms.some((room) => room.id === selectedRoomId) ? selectedRoomId : rooms[0]?.id ?? null;
  const activeRoomData = resolvedRoomId ? registry[resolvedRoomId] : undefined;
  const proposals = activeRoomData?.proposals ?? [];
  const activeProposal = proposals.find((proposal) => proposal.id === activeCandidateId);
  const messages = resolvedRoomId && activeCandidateId ? activeRoomData?.chatHistory[activeCandidateId] ?? [] : [];

  return (
    <Card>
      <Stack gap={16}>
        <div>
          <h2 className="h1">Bids and applicant management</h2>
          <p className="body text-ink-muted">Review incoming entries, coordinate requirements, and approve matching engineers.</p>
        </div>
        {!rooms.length ? (
          <EmptyState title="No room threads yet" description="Applications will appear here when candidates respond to your rooms." />
        ) : (
          <div className="marketplace-applications-grid">
            <RoomThreadList
              rooms={rooms}
              registry={registry}
              selectedRoomId={resolvedRoomId}
              onSelect={(roomId) => { setSelectedRoomId(roomId); setActiveCandidateId(null); }}
            />
            {proposals.length ? (
              <div className="marketplace-applicants-grid">
                <ApplicantList proposals={proposals} activeCandidateId={activeCandidateId} onSelect={setActiveCandidateId} />
                <ApplicantChat
                  proposal={activeProposal}
                  messages={messages}
                  onSendMessage={(text) => resolvedRoomId && activeCandidateId && onSendMessage(resolvedRoomId, activeCandidateId, "Client", text)}
                  onApprove={() => resolvedRoomId && activeCandidateId && onApprove(resolvedRoomId, activeCandidateId)}
                />
              </div>
            ) : (
              <EmptyState title="No applications yet" description="This room has not received an application." />
            )}
          </div>
        )}
      </Stack>
    </Card>
  );
}
