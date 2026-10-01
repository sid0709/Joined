import { Card, Heading, List, ListItem, Stack, Text } from "@joined/design-system";
import { formatPay, jobHasLogoFile, type Job } from "@/lib/jobs";
import { ROUTES } from "@/lib/routes";
import { CompanyLogo } from "./company-logo";
import { MatchBadge } from "./match-badge";

type Props = {
  jobs: Job[];
  scoreOf: (job: Job) => number;
  /** Selects in place (split view); without it each row links to the job page. */
  onSelect?: (job: Job) => void;
};

/** Other jobs that ask for the same skills. */
export function SimilarJobs({ jobs, scoreOf, onSelect }: Props) {
  if (jobs.length === 0) return null;

  return (
    <Card padding={3}>
      <List
        hasDividers
        header={
          <Stack gap={0.5} paddingInline={2} paddingBlockStart={2}>
            <Heading level={3}>Similar jobs</Heading>
            <Text type="supporting" color="secondary">
              Roles that ask for the same skills.
            </Text>
          </Stack>
        }
      >
        {jobs.map((job) => (
          <ListItem
            key={job.id}
            label={job.title}
            description={`${job.company} · ${formatPay(job.pay)}`}
            startContent={
              <CompanyLogo
                name={job.company}
                companyId={job.companyId}
                src={job.companyLogo}
                hasFile={jobHasLogoFile(job)}
                size={32}
              />
            }
            endContent={<MatchBadge score={scoreOf(job)} />}
            {...(onSelect ? { onClick: () => onSelect(job) } : { href: ROUTES.job(job.id) })}
          />
        ))}
      </List>
    </Card>
  );
}
