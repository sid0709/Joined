import { Badge, Button, Card, Stack } from "@openseat/design-system";
import { JobRoomRecord } from "@/src/shared/types/job-room";

interface JobRoomCardProps {
  room: JobRoomRecord;
  onBidAction?: (id: string) => void;
  onSelect?: () => void;
  showBidButton?: boolean;
}

export function JobRoomCard({ room, onBidAction, onSelect, showBidButton = true }: JobRoomCardProps) {
  return (
    <Card raised>
      <Stack gap={12} className="marketplace-job-card">
        <div>
          <span className="caption text-ink-muted">{room.postedTimeText}</span>
          <button type="button" className="marketplace-card-title-button" onClick={onSelect}>
            <span className="h2">{room.title}</span>
          </button>
        </div>

        <div className="marketplace-job-meta body-sm text-ink-muted">
          <span>{room.isPaymentVerified ? "Payment verified" : "Payment unverified"}</span>
          {room.clientRating && <span>Rating {room.clientRating}</span>}
          <span>{room.clientTotalSpentText}</span>
          <span>{room.clientLocationCode}</span>
        </div>

        <p className="body-strong marketplace-job-summary">
          {room.budgetType}: {room.rateOrBudgetRangeText} · {room.experienceLevelRequired} · {room.durationEstimateText} · {room.weeklyCommitmentText}
        </p>

        <p className="body marketplace-job-description">{room.descriptionParagraph}</p>

        <div className="marketplace-tag-list">
          {room.skillsTags.map((tag) => <Badge key={tag} label={tag} tone="neutral" />)}
        </div>

        <div className="marketplace-card-footer">
          <span className="caption text-ink-muted">
            Proposals: <span className="text-ink">{room.proposalsCountText}</span>
          </span>
          {showBidButton && onBidAction && (
            <Button size="sm" variant="primary" onClick={() => onBidAction(room.id)}>
              Place room bid
            </Button>
          )}
        </div>
      </Stack>
    </Card>
  );
}
