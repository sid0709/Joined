import Link from "next/link";

import {
  BrandFooter,
  ButtonLink,
  Card,
  JoinedLogo,
  Stack,
  ThemeToggle,
} from "@/src/shared/marketplace-ui";

export default function Home() {
  return (
    <main className="home-page">
      <header className="os-nav">
        <Link href="/" className="os-nav-brand">
          <JoinedLogo height="2rem" />
        </Link>
        <nav className="os-nav-items" aria-label="Primary navigation">
          <a className="label os-nav-item" href="#how-it-works">
            How it works
          </a>
          <Link className="label os-nav-item" href="/style-guide">
            Design system
          </Link>
        </nav>
        <div className="os-nav-right">
          <ThemeToggle />
          <ButtonLink href="/marketplace/login" variant="secondary" size="sm">
            Sign in
          </ButtonLink>
        </div>
      </header>

      <section className="home-hero">
        <div>
          <span className="label text-primary">THE WORK MARKETPLACE</span>
          <h1 className="display home-hero-title">Find the right people for meaningful work.</h1>
          <p className="body-lg text-ink-muted home-hero-copy">
            Joined connects clients with focused candidates through clear briefs, thoughtful bids,
            and conversations that lead to better contracts.
          </p>
          <div className="home-actions">
            <ButtonLink href="/marketplace/jobs" variant="primary" size="lg">
              Explore marketplace
            </ButtonLink>
            <ButtonLink href="/marketplace/register" variant="secondary" size="lg">
              Create an account
            </ButtonLink>
          </div>
        </div>
        <Card
          title="A calmer way to work"
          meta="One shared workflow for candidates and clients"
          raised
        >
          <Stack gap={16} className="home-workflow">
            <div>
              <span className="label text-primary">01</span>
              <p className="body-strong">Discover</p>
              <p className="body-sm text-ink-muted">
                Browse job rooms with transparent scope, budget, and expectations.
              </p>
            </div>
            <div>
              <span className="label text-primary">02</span>
              <p className="body-strong">Discuss</p>
              <p className="body-sm text-ink-muted">
                Ask questions and refine the work before anyone commits.
              </p>
            </div>
            <div>
              <span className="label text-primary">03</span>
              <p className="body-strong">Deliver</p>
              <p className="body-sm text-ink-muted">
                Move from an approved bid to milestones and active work.
              </p>
            </div>
          </Stack>
        </Card>
      </section>

      <section id="how-it-works" className="home-secondary-grid">
        <Card title="For candidates" meta="Bid with confidence">
          <p className="body text-ink-muted">
            Build your profile, find relevant jobs, submit bids, message clients, and manage awarded
            work.
          </p>
          <Link className="os-link" href="/marketplace/register">
            Join as a candidate →
          </Link>
        </Card>
        <Card title="For clients" meta="Hire with clarity">
          <p className="body text-ink-muted">
            Post a brief, compare applicants, discuss fit, approve a candidate, and manage delivery.
          </p>
          <Link className="os-link" href="/marketplace/register">
            Join as a client →
          </Link>
        </Card>
      </section>

      <BrandFooter lead="©" />
    </main>
  );
}
