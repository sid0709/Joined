import { Badge, Card, Modal, Stack } from "@/src/shared/marketplace-ui";
import { CandidateProfile } from "@/src/shared/types/auth";
import { ProposalDraft, JobRoomRecord } from "@/src/shared/types/job-room";
import { ProposalForm } from "@/src/shared/components/ProposalForm";

interface JobDetailDrawerProps {
  room: JobRoomRecord | null;
  profile: CandidateProfile;
  onClose: () => void;
  onApply: (id: string, proposal: ProposalDraft) => void;
}

export function JobDetailDrawer({ room, profile, onClose, onApply }: JobDetailDrawerProps) {
  return (
    <Modal
      open={Boolean(room)}
      onClose={onClose}
      title={room ? `Bid on ${room.title}` : undefined}
      className="marketplace-job-modal"
    >
      {room && (
        <Stack gap={16}>
          <div>
            <span className="caption text-ink-muted">{room.postedTimeText}</span>
            <p className="body">{room.descriptionParagraph}</p>
            <div className="marketplace-tag-list">
              {room.skillsTags.map((tag) => <Badge key={tag} label={tag} tone="neutral" />)}
            </div>
          </div>
          <Card title="Engagement" meta="Project expectations">
            <Stack gap={8}>
              <p className="body">{room.budgetType}: {room.rateOrBudgetRangeText}</p>
              <p className="body">{room.experienceLevelRequired} · {room.durationEstimateText} · {room.weeklyCommitmentText}</p>
              <p className="body-sm text-ink-muted">{room.proposalsCountText} proposals · {room.clientLocationCode} · {room.clientTotalSpentText}</p>
            </Stack>
          </Card>
          <ProposalForm
            room={room}
            profile={profile}
            onSubmit={(proposal) => onApply(room.id, proposal)}
            onCancel={onClose}
          />
        </Stack>
      )}
    </Modal>
  );
}
