import Link from "next/link";
import { CodeBlock } from "@openseat/design-system";
import { ROUTES } from "@/lib/routes";

const SAMPLE = `POST /v1/scout/submissions
Authorization: Bearer scw_…
Idempotency-Key: 7f0c2a6e-…

{ "url": "https://jobs.lever.co/acme/…",
  "company_name": "Acme", "title": "Data Engineer",
  "summary": "…", "external_ref": "feed-0142" }`;

/** The pitch to agencies: same checks and rewards, from their own pipeline. */
export function ApiBand({ maxBatch, signedIn }: { maxBatch: number; signedIn: boolean }) {
  return (
    <section className="sw-api" aria-labelledby="sw-api">
      <div className="sw-api-copy">
        <span className="sw-eyebrow sw-eyebrow-on-dark">Scoutwell API</span>
        <h2 id="sw-api" className="sw-section-title">
          Source at scale.
        </h2>
        <p className="sw-lede">
          Agencies and sourcing teams submit from their own pipelines: idempotent creates, batches
          of up to {maxBatch}, your own reference ids, and change feeds. Same checks, same rewards.
        </p>
        <div>
          <Link className="sw-pill" href={signedIn ? ROUTES.developers : ROUTES.signUp}>
            {signedIn ? "Get an API key" : "Create an account"}
          </Link>
        </div>
      </div>
      <div className="sw-api-code">
        <CodeBlock code={SAMPLE} language="http" />
      </div>
    </section>
  );
}
