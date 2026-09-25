import { Avatar, Badge } from "@/src/shared/marketplace-ui";
import { ProposalRecord } from "@/src/shared/types/job-room";

interface ApplicantListProps {
  proposals: ProposalRecord[];
  activeCandidateId: string | null;
  onSelect: (candidateId: string) => void;
}

function initialsFor(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function ApplicantList({ proposals, activeCandidateId, onSelect }: ApplicantListProps) {
  return (
    <div className="marketplace-selection-list">
      <p className="caption text-ink-muted">Applicants</p>
      {proposals.map((proposal) => (
        <button
          key={proposal.id}
          type="button"
          className={`marketplace-selection-item ${activeCandidateId === proposal.id ? "marketplace-selection-item-active" : ""}`}
          onClick={() => onSelect(proposal.id)}
        >
          <span className="marketplace-applicant-name">
            <Avatar initials={initialsFor(proposal.candidateName)} size={24} />
            <span className="body-strong marketplace-truncate">{proposal.candidateName}</span>
          </span>
          <Badge label={proposal.status} tone={proposal.status === "Approved" ? "success" : "neutral"} />
        </button>
      ))}
    </div>
  );
}
