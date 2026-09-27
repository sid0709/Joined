import { Badge, Button, Card, Stack } from "@/src/shared/marketplace-ui";
import { ProposalRecord } from "@/src/shared/types/job-room";

interface ProposalComparisonProps {
  proposals: ProposalRecord[];
  onSelect: (candidateId: string) => void;
  onClose: () => void;
}

export function ProposalComparison({ proposals, onSelect, onClose }: ProposalComparisonProps) {
  if (proposals.length < 2) return null;

  return (
    <Card
      className="marketplace-comparison-card"
      title="Compare proposals"
      meta="Keep the same commercial and delivery criteria visible while you decide."
    >
      <Stack gap={12}>
        <div className="marketplace-comparison-toolbar">
          <span className="caption text-ink-muted">{proposals.length} candidates selected</span>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close comparison
          </Button>
        </div>
        <div className="marketplace-comparison-grid">
          {proposals.map((proposal) => (
            <div key={proposal.id} className="marketplace-comparison-column">
              <div className="marketplace-comparison-name">
                <div>
                  <strong className="body-strong">{proposal.candidateName}</strong>
                  <span className="caption text-ink-muted">{proposal.candidateTitle}</span>
                </div>
                <Badge
                  label={proposal.status}
                  tone={proposal.status === "Approved" ? "success" : "neutral"}
                />
              </div>
              <div className="marketplace-comparison-row">
                <span>Price</span>
                <strong>{proposal.candidateRate}</strong>
              </div>
              <div className="marketplace-comparison-row">
                <span>Timeline</span>
                <strong>{proposal.estimatedTimelineText}</strong>
              </div>
              <div className="marketplace-comparison-row">
                <span>Availability</span>
                <strong>{proposal.availabilityText}</strong>
              </div>
              <div className="marketplace-comparison-row">
                <span>Milestones</span>
                <strong>{proposal.milestones.length}</strong>
              </div>
              <div className="marketplace-comparison-row">
                <span>Work examples</span>
                <strong>{proposal.workExamples.length}</strong>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onSelect(proposal.id)}
              >
                Review candidate
              </Button>
            </div>
          ))}
        </div>
      </Stack>
    </Card>
  );
}
