import { Avatar, Badge } from "@/src/shared/marketplace-ui";
import { ProposalRecord } from "@/src/shared/types/job-room";

interface ApplicantListProps {
  proposals: ProposalRecord[];
  activeCandidateId: string | null;
  onSelect: (candidateId: string) => void;
  compareIds: string[];
  onToggleCompare: (candidateId: string) => void;
}

function initialsFor(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function ApplicantList({ proposals, activeCandidateId, onSelect, compareIds, onToggleCompare }: ApplicantListProps) {
  return (
    <div className="marketplace-selection-list">
      <p className="caption text-ink-muted">Applicants</p>
      {proposals.map((proposal) => (
        <div
          key={proposal.id}
          className={`marketplace-selection-item ${activeCandidateId === proposal.id ? "marketplace-selection-item-active" : ""}`}
        >
          <button type="button" className="marketplace-applicant-select" onClick={() => onSelect(proposal.id)}>
            <span className="marketplace-applicant-name">
              <Avatar initials={initialsFor(proposal.candidateName)} size={32} />
              <span className="marketplace-applicant-copy">
                <span className="body-strong marketplace-truncate">{proposal.candidateName}</span>
                <span className="caption text-ink-muted marketplace-truncate">{proposal.candidateTitle}</span>
              </span>
            </span>
            <span className="marketplace-applicant-row-footer">
              <span className="caption text-ink-muted">{proposal.candidateRate}</span>
              <Badge label={proposal.status} tone={proposal.status === "Approved" ? "success" : "neutral"} />
            </span>
          </button>
          <button
            type="button"
            className={`marketplace-compare-toggle ${compareIds.includes(proposal.id) ? "marketplace-compare-toggle-active" : ""}`}
            aria-pressed={compareIds.includes(proposal.id)}
            onClick={() => onToggleCompare(proposal.id)}
          >
            {compareIds.includes(proposal.id) ? "Compared" : "Compare"}
          </button>
        </div>
      ))}
    </div>
  );
}
