import { useHunter } from "@/src/client/context/HunterContext";
import { Meter } from "@/src/shared/kit/Meter";
import { Panel } from "@/src/shared/kit/Panel";
import { Button } from "@/src/shared/marketplace-ui";
import { POOL_ATS } from "@/src/shared/mock/pool";
import { HUNTER_ROUTES } from "@/src/shared/routes/hunter";

export function PoolSnapshot() {
  const { poolJobs, assignedJobs } = useHunter();
  const available = poolJobs.filter((job) => !assignedJobs.has(job.id));

  return (
    <Panel
      title="Job pool"
      subtitle={`${available.length} links ready to assign · managed by OpenSeat admin`}
      actions={<Button href={HUNTER_ROUTES.pool} variant="ghost" size="sm" label="Open pool" />}
    >
      {POOL_ATS.map((ats) => {
        const total = poolJobs.filter((job) => job.ats === ats).length;
        const free = available.filter((job) => job.ats === ats).length;
        return (
          <div key={ats} className="hx-stack hx-stack-sm">
            <div className="hx-row hx-row-between">
              <span className="hx-strong">{ats}</span>
              <span className="hx-small hx-muted hx-num">
                {free} of {total} available
              </span>
            </div>
            <Meter
              label={ats}
              total={total}
              segments={[{ label: "Available", value: free, tone: "accent" }]}
            />
          </div>
        );
      })}
    </Panel>
  );
}
