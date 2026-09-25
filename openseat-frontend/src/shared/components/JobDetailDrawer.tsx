import { Badge, Button, Card, Modal, Stack } from "@openseat/design-system";
import { JobRoomRecord } from "@/src/shared/types/job-room";

interface JobDetailDrawerProps {
  room: JobRoomRecord | null;
  onClose: () => void;
  onApply: (id: string) => void;
}

export function JobDetailDrawer({ room, onClose, onApply }: JobDetailDrawerProps) {
  return (
    <Modal
      open={Boolean(room)}
      onClose={onClose}
      title={room?.title}
      className="marketplace-job-modal"
      footer={
        <div className="marketplace-modal-actions">
          <Button variant="primary" onClick={() => room && onApply(room.id)}>Submit a bid</Button>
          <Button variant="secondary" onClick={onClose}>Keep browsing</Button>
        </div>
      }
    >
      {room && (
        <Stack gap={16}>
          <span className="caption text-ink-muted">{room.postedTimeText}</span>
          <p className="body">{room.descriptionParagraph}</p>
          <div className="marketplace-tag-list">
            {room.skillsTags.map((tag) => <Badge key={tag} label={tag} tone="neutral" />)}
          </div>
          <Card title="Engagement" meta="Project expectations">
            <Stack gap={8}>
              <p className="body">{room.budgetType}: {room.rateOrBudgetRangeText}</p>
              <p className="body">{room.experienceLevelRequired} · {room.durationEstimateText} · {room.weeklyCommitmentText}</p>
              <p className="body-sm text-ink-muted">{room.proposalsCountText} proposals · {room.clientLocationCode} · {room.clientTotalSpentText}</p>
            </Stack>
          </Card>
        </Stack>
      )}
    </Modal>
  );
}
