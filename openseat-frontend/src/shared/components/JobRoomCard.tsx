import { Badge, Button, Card, Stack } from "@/src/shared/marketplace-ui";
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
          {room.sourceCompany && <span className="caption text-ink-muted">External posting · {room.sourceCompany}</span>}
          {onSelect ? (
            <button type="button" className="marketplace-card-title-button" onClick={onSelect}>
              <span className="h2">{room.title}</span>
            </button>
          ) : (
            <span className="h2">{room.title}</span>
          )}
        </div>

        <div className="marketplace-job-meta body-sm text-ink-muted">
          <span>{room.sourceJobStatus ?? "Open"}</span>
          {room.applicationDeadline && <span>Apply by {room.applicationDeadline}</span>}
          {room.clientRating && <span>Rating {room.clientRating}</span>}
          <span>{room.clientTotalSpentText}</span>
          <span>{room.clientLocationCode}</span>
        </div>

        <div className="marketplace-job-details">
          <div><span>Compensation</span><strong>{room.budgetType}: {room.rateOrBudgetRangeText}</strong></div>
          <div><span>Experience</span><strong>{room.experienceLevelRequired}</strong></div>
          <div><span>Engagement</span><strong>{room.durationEstimateText}</strong></div>
          <div><span>Commitment</span><strong>{room.weeklyCommitmentText}</strong></div>
        </div>

        <p className="body marketplace-job-description">{room.descriptionParagraph}</p>

        <div className="marketplace-tag-list">
          {room.skillsTags.map((tag) => <Badge key={tag} label={tag} tone="neutral" />)}
        </div>

        <div className="marketplace-card-footer">
          <span className="caption text-ink-muted">
            Proposals: <span className="text-ink">{room.proposalsCountText}</span>
          </span>
          <div className="marketplace-inline-actions">
            {room.sourceUrl && <a className="os-link" href={room.sourceUrl} target="_blank" rel="noreferrer">Original posting ↗</a>}
            {showBidButton && onBidAction && <Button size="sm" variant="primary" onClick={() => onBidAction(room.id)}>Place application bid</Button>}
          </div>
        </div>
      </Stack>
    </Card>
  );
}
