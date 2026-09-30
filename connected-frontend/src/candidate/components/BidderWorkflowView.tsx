"use client";

import Link from "next/link";
import { useState } from "react";

import { useBidderContext } from "@/src/shared/bidder/BidderContext";
import { useBidderWorkflow } from "@/src/shared/bidder/BidderWorkflowContext";
import { Badge, Button, Card, Input, PageBody, Stack, TextArea } from "@/src/shared/marketplace-ui";

type View =
  | "dashboard"
  | "marketplace"
  | "bids"
  | "invitations"
  | "work"
  | "messages"
  | "earnings"
  | "performance"
  | "profile";

const taskTone = (status: string) =>
  status === "Connected" || status === "Active"
    ? "success"
    : status === "Interest sent"
      ? "primary"
      : "neutral";
const linkTone = (status: string) =>
  status === "QA passed"
    ? "success"
    : status === "Needs fix"
      ? "danger"
      : status === "Submitted"
        ? "primary"
        : "neutral";

function Header({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="marketplace-page-header bidder-hero">
      <div>
        <span className="label text-primary">BIDDER WORKSPACE</span>
        <h1 className="h1">{title}</h1>
        <p className="body text-ink-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

function Stats({ items }: { items: [string, string][] }) {
  return (
    <div className="marketplace-dashboard-stats bidder-kpi-grid">
      {items.map(([value, label]) => (
        <Card key={label}>
          <strong className="marketplace-dashboard-stat-value">{value}</strong>
          <span className="caption">{label}</span>
        </Card>
      ))}
    </div>
  );
}

export function BidderWorkflowView({ view }: { view: View }) {
  const workflow = useBidderWorkflow();
  if (view === "dashboard") return <Dashboard data={workflow} />;
  if (view === "marketplace") return <Marketplace data={workflow} />;
  if (view === "bids") return <MyBids data={workflow} />;
  if (view === "invitations") return <Invitations data={workflow} />;
  if (view === "work") return <ActiveWork data={workflow} />;
  if (view === "messages") return <Messages data={workflow} />;
  if (view === "earnings") return <Earnings data={workflow} />;
  if (view === "performance") return <Performance />;
  return <Profile />;
}

export function BidderTaskDetailView({ taskId }: { taskId: string }) {
  const data = useBidderWorkflow();
  const task = data.tasks.find((item) => item.id === taskId);
  if (!task)
    return (
      <PageBody>
        <Card title="Task not found">
          <p className="body text-ink-muted">
            This task may have closed or is no longer available.
          </p>
          <Button href="/marketplace/jobs" variant="primary">
            Back to marketplace
          </Button>
        </Card>
      </PageBody>
    );
  return (
    <PageBody>
      <Stack gap={24}>
        <Header
          title={task.title}
          description={task.description}
          action={
            <Button href="/marketplace/jobs" variant="secondary">
              Back to marketplace
            </Button>
          }
        />
        <div className="marketplace-dashboard-grid">
          <Stack gap={16}>
            <Card
              title="Task overview"
              meta={`${task.ownerName} · ${task.kind} · ${task.postedAt}`}
            >
              <div className="bidder-task-facts">
                <span>
                  <strong>{task.payRange}</strong>
                  <small>Pay range</small>
                </span>
                <span>
                  <strong>{task.dailyTarget}</strong>
                  <small>Expected pace</small>
                </span>
                <span>
                  <strong>{task.availability}</strong>
                  <small>Availability</small>
                </span>
              </div>
              <h3 className="h3">What the Job Hunter expects</h3>
              <p className="body-sm text-ink-muted">{task.qualityExpectation}</p>
              <div className="marketplace-inline-actions">
                {task.status === "Open" && (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => data.expressInterest(task.id)}
                  >
                    Notify Job Hunter
                  </Button>
                )}
                {task.status === "Interest sent" && <Badge label="Interest sent" tone="primary" />}
                {task.status === "Connected" && (
                  <Button href="/marketplace/candidate/messages" variant="primary">
                    Open task chat
                  </Button>
                )}
              </div>
            </Card>
            <Card title="Task requirements" meta="Review these before requesting a connection">
              <div className="marketplace-review-list">
                {task.requirements.map((requirement) => (
                  <div key={requirement}>
                    <span className="body-sm">✓ {requirement}</span>
                  </div>
                ))}
              </div>
            </Card>
          </Stack>
          <Card
            title="Available packages"
            meta="Package difficulty and rate are agreed with the Job Hunter"
          >
            <div className="marketplace-review-list">
              {task.packages.map((pkg) => (
                <div key={pkg.id}>
                  <div className="marketplace-card-footer">
                    <strong className="body-strong">{pkg.name}</strong>
                    <Badge
                      label={pkg.ratePerLink}
                      tone={pkg.difficulty === "Advanced" ? "primary" : "neutral"}
                    />
                  </div>
                  <p className="body-sm text-ink-muted">
                    {pkg.ats} · {pkg.linkCount} links · {pkg.difficulty}
                  </p>
                </div>
              ))}
            </div>
            <p className="caption text-ink-muted">
              You will see official company links only after the Job Hunter approves the connection
              and assigns a package.
            </p>
          </Card>
        </div>
      </Stack>
    </PageBody>
  );
}

function Dashboard({ data }: { data: ReturnType<typeof useBidderWorkflow> }) {
  const { performance, earnings } = useBidderContext();
  const assignment = data.assignments[0];
  const submitted = assignment.links.filter((link) =>
    ["Submitted", "QA passed"].includes(link.status),
  ).length;
  return (
    <PageBody>
      <Stack gap={24}>
        <Header
          title="Your bidder workspace"
          description="Discover task orders, build trusted Job Hunter connections, complete assigned applications, and see exactly how your work is reviewed and paid."
          action={
            <Button href="/marketplace/jobs" variant="primary">
              Browse task marketplace
            </Button>
          }
        />
        <Stats
          items={[
            [
              String(data.tasks.filter((task) => task.status === "Connected").length),
              "Connected tasks",
            ],
            [String(submitted), "Links submitted"],
            [`${performance.qaPassRate}%`, "QA pass rate"],
            [`$${(earnings.pendingCents / 100).toFixed(2)}`, "Pending earnings"],
          ]}
        />
        <div className="marketplace-dashboard-grid">
          <Card
            title="Your current assignment"
            meta="Work only appears here after a Job Hunter connects with you"
          >
            <div className="bidder-feature-card">
              <div>
                <span className="eyebrow">
                  {assignment.packageName} · {assignment.ratePerLink} per link
                </span>
                <h2 className="h2">{assignment.taskTitle}</h2>
                <p className="body-sm text-ink-muted">
                  {assignment.ownerName} ·{" "}
                  {assignment.links.filter((link) => link.status === "QA passed").length} QA-passed
                  applications
                </p>
              </div>
              <Badge label={`${submitted}/${assignment.links.length} in progress`} tone="primary" />
            </div>
            <div className="bidder-progress">
              <span
                style={{ width: `${Math.round((submitted / assignment.links.length) * 100)}%` }}
              />
            </div>
            <div className="marketplace-card-footer">
              <span className="body-sm">Daily target: {assignment.dailyTarget} links</span>
              <Link className="os-link" href="/marketplace/candidate/work">
                Open active work →
              </Link>
            </div>
          </Card>
          <Card title="Next best action" meta="Keep your connection healthy">
            <div className="marketplace-review-list">
              <div>
                <Badge label="Needs fix" tone="danger" />
                <p className="body-sm">
                  One Google application needs a location answer before review.
                </p>
              </div>
              <div>
                <Badge label="Messages" tone="primary" />
                <p className="body-sm">
                  Aurora Talent Partners sent two updates about your package.
                </p>
              </div>
              <div>
                <Badge label="Performance" tone="success" />
                <p className="body-sm">
                  You are 12 QA-passed links away from the next rate review.
                </p>
              </div>
            </div>
            <Button href="/marketplace/candidate/messages" variant="secondary">
              Open collaboration
            </Button>
          </Card>
        </div>
        <Card
          title="How work becomes payment"
          meta="A transparent path from task interest to earnings"
        >
          <div className="bidder-flow">
            <span>
              <strong>1</strong> Choose a task
            </span>
            <span>
              <strong>2</strong> Get connected
            </span>
            <span>
              <strong>3</strong> Apply links
            </span>
            <span>
              <strong>4</strong> Pass QA
            </span>
            <span>
              <strong>5</strong> Get paid
            </span>
          </div>
        </Card>
      </Stack>
    </PageBody>
  );
}

function Marketplace({ data }: { data: ReturnType<typeof useBidderWorkflow> }) {
  const [query, setQuery] = useState("");
  const visible = data.tasks.filter((task) =>
    `${task.title} ${task.ownerName} ${task.packages.map((pkg) => pkg.ats).join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <PageBody>
      <Stack gap={24}>
        <Header
          title="Task marketplace"
          description="Job Hunters post task orders here. Choose work that fits your availability and request a connection directly with the task owner."
        />
        <div className="marketplace-page-toolbar">
          <Input
            label="Search tasks"
            placeholder="Search role, Job Hunter, or ATS"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Stats
          items={[
            [String(data.tasks.filter((task) => task.status === "Open").length), "Open tasks"],
            [
              String(data.tasks.filter((task) => task.kind === "Permanent contact").length),
              "Permanent contacts",
            ],
            ["$0.80–$1.85", "Typical rate/link"],
            ["4", "Available packages"],
          ]}
        />
        <div className="bidder-task-grid">
          {visible.map((task) => (
            <Card key={task.id}>
              <div className="marketplace-card-footer">
                <div>
                  <span className="eyebrow">
                    {task.kind} · {task.postedAt}
                  </span>
                  <h2 className="h2">{task.title}</h2>
                  <p className="body-sm text-ink-muted">
                    {task.ownerName} · {task.availability}
                  </p>
                </div>
                <Badge label={task.status} tone={taskTone(task.status)} />
              </div>
              <p className="body-sm">{task.description}</p>
              <div className="marketplace-tag-list">
                {task.packages.map((pkg) => (
                  <Badge key={pkg.id} label={`${pkg.name} · ${pkg.ratePerLink}`} tone="neutral" />
                ))}
              </div>
              <div className="bidder-task-facts">
                <span>
                  <strong>{task.payRange}</strong>
                  <small>Pay range</small>
                </span>
                <span>
                  <strong>{task.dailyTarget}</strong>
                  <small>Expected pace</small>
                </span>
                <span>
                  <strong>{task.qualityExpectation}</strong>
                  <small>Quality bar</small>
                </span>
              </div>
              <div className="marketplace-inline-actions">
                <Button href={`/marketplace/jobs/${task.id}`} variant="secondary">
                  View task
                </Button>
                {task.status === "Open" && (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => data.expressInterest(task.id)}
                  >
                    Notify Job Hunter
                  </Button>
                )}
                {task.status === "Interest sent" && (
                  <Badge label="Waiting for response" tone="primary" />
                )}
              </div>
            </Card>
          ))}
        </div>
      </Stack>
    </PageBody>
  );
}

function MyBids({ data }: { data: ReturnType<typeof useBidderWorkflow> }) {
  const interested = data.tasks.filter(
    (task) => task.status === "Interest sent" || task.status === "Connected",
  );
  return (
    <PageBody>
      <Stack gap={24}>
        <Header
          title="My task interests"
          description="Track the task orders you selected, the Job Hunters you contacted, and whether you are approved to begin work."
          action={
            <Button href="/marketplace/jobs" variant="primary">
              Find more tasks
            </Button>
          }
        />
        <Stats
          items={[
            [String(interested.length), "Selected tasks"],
            [
              String(data.tasks.filter((task) => task.status === "Interest sent").length),
              "Awaiting approval",
            ],
            [String(data.tasks.filter((task) => task.status === "Connected").length), "Connected"],
            [String(data.assignments.length), "Active assignments"],
          ]}
        />
        <Card
          title="Task connection pipeline"
          meta="A task interest is not a job application; it starts a conversation with the owner"
        >
          <div className="marketplace-review-list">
            {interested.map((task) => (
              <div key={task.id}>
                <div className="marketplace-card-footer">
                  <div>
                    <strong className="body-strong">{task.title}</strong>
                    <p className="body-sm text-ink-muted">
                      {task.ownerName} · {task.kind} · {task.payRange}
                    </p>
                  </div>
                  <Badge label={task.status} tone={taskTone(task.status)} />
                </div>
                <p className="body-sm text-ink-muted">
                  {task.status === "Connected"
                    ? "You are approved. Check Messages for instructions and Active Work for assigned links."
                    : "The Job Hunter has been notified. Keep your availability and rate discussion in chat."}
                </p>
                <div className="marketplace-inline-actions">
                  <Button href="/marketplace/candidate/messages" variant="secondary">
                    Open task chat
                  </Button>
                  {task.status === "Connected" && (
                    <Button href="/marketplace/candidate/work" variant="primary">
                      View assignment
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Stack>
    </PageBody>
  );
}

function Invitations({ data }: { data: ReturnType<typeof useBidderWorkflow> }) {
  return (
    <PageBody>
      <Stack gap={24}>
        <Header
          title="Task invitations"
          description="Job Hunters can invite you after reviewing your profile or after you express interest in their task."
        />
        <Card
          title="Pending connection requests"
          meta="Review the task, package, rate, and expectations before you accept"
        >
          <div className="marketplace-review-list">
            {data.tasks
              .filter((task) => task.status === "Interest sent" || task.status === "Connected")
              .map((task) => (
                <div key={task.id}>
                  <div className="marketplace-card-footer">
                    <div>
                      <strong className="body-strong">{task.ownerName}</strong>
                      <p className="body-sm text-ink-muted">{task.title}</p>
                    </div>
                    <Badge
                      label={task.status === "Connected" ? "Approved" : "Under review"}
                      tone={task.status === "Connected" ? "success" : "primary"}
                    />
                  </div>
                  <p className="body-sm">
                    {task.payRange} · {task.dailyTarget} · {task.kind}
                  </p>
                  <Link className="os-link" href="/marketplace/candidate/messages">
                    Continue in chat →
                  </Link>
                </div>
              ))}
          </div>
        </Card>
        <Card
          title="What happens after approval"
          meta="The Job Hunter controls which links are assigned"
        >
          <div className="bidder-flow">
            <span>
              <strong>1</strong> Agree in chat
            </span>
            <span>
              <strong>2</strong> Receive package
            </span>
            <span>
              <strong>3</strong> Apply links
            </span>
            <span>
              <strong>4</strong> Receive QA
            </span>
          </div>
        </Card>
      </Stack>
    </PageBody>
  );
}

function ActiveWork({ data }: { data: ReturnType<typeof useBidderWorkflow> }) {
  const [selectedId, setSelectedId] = useState(data.assignments[0]?.id ?? "");
  const assignment = data.assignments.find((item) => item.id === selectedId) ?? data.assignments[0];
  if (!assignment)
    return (
      <PageBody>
        <Card title="No active assignment">
          <p className="body text-ink-muted">
            You will see job links here after a Job Hunter approves your connection and assigns a
            package.
          </p>
        </Card>
      </PageBody>
    );
  const submitted = assignment.links.filter((link) =>
    ["Submitted", "QA passed"].includes(link.status),
  ).length;
  return (
    <PageBody>
      <Stack gap={24}>
        <Header
          title="Active work"
          description="Complete the job links assigned by your connected Job Hunter and use their feedback to improve your next submission."
          action={
            <Button href="/marketplace/candidate/messages" variant="secondary">
              Ask a question
            </Button>
          }
        />
        <Stats
          items={[
            [String(assignment.links.length), "Assigned links"],
            [String(submitted), "Submitted"],
            [
              String(assignment.links.filter((link) => link.status === "QA passed").length),
              "QA passed",
            ],
            [assignment.pendingEarned, "Pending pay"],
          ]}
        />
        <div className="marketplace-applications-shell">
          <Card title="Assignments" meta="Each package has its own rate and quality rules">
            <div className="marketplace-selection-list">
              {data.assignments.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`marketplace-selection-item ${item.id === assignment.id ? "marketplace-selection-item-active" : ""}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span>
                    <strong className="body-strong">{item.packageName}</strong>
                    <span className="caption text-ink-muted">
                      {item.ownerName} · {item.ratePerLink}/link
                    </span>
                  </span>
                  <Badge label={`${item.links.length} links`} tone="neutral" />
                </button>
              ))}
            </div>
          </Card>
          <Card
            title={assignment.packageName}
            meta={`${assignment.ownerName} · Daily target ${assignment.dailyTarget} links`}
          >
            <div className="bidder-link-list">
              {assignment.links.map((link) => (
                <div key={link.id} className="bidder-link-row">
                  <div>
                    <div className="marketplace-card-footer">
                      <strong className="body-strong">{link.company}</strong>
                      <Badge label={link.status} tone={linkTone(link.status)} />
                    </div>
                    <p className="body-sm text-ink-muted">
                      {link.title} · {link.ats} · Due {link.deadline}
                    </p>
                    {link.feedback && (
                      <p className="body-sm bidder-feedback">Feedback: {link.feedback}</p>
                    )}
                  </div>
                  <div className="marketplace-inline-actions">
                    {link.status === "In progress" && (
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => data.updateLink(assignment.id, link.id, "Submitted")}
                      >
                        Mark submitted
                      </Button>
                    )}
                    {link.status === "Needs fix" && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => data.updateLink(assignment.id, link.id, "Submitted")}
                      >
                        Resubmit
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Stack>
    </PageBody>
  );
}

function Messages({ data }: { data: ReturnType<typeof useBidderWorkflow> }) {
  const [selectedId, setSelectedId] = useState(data.conversations[0]?.id ?? "");
  const [draft, setDraft] = useState("");
  const selected =
    data.conversations.find((item) => item.id === selectedId) ?? data.conversations[0];
  const send = () => {
    if (selected) {
      data.sendMessage(selected.id, draft);
      setDraft("");
    }
  };
  return (
    <PageBody>
      <Stack gap={24}>
        <Header
          title="Messages"
          description="Chat with Job Hunters about task terms, package instructions, application questions, and feedback on your work."
        />
        <div className="marketplace-applications-shell">
          <Card title="Task conversations" meta="Every conversation stays linked to its task">
            <div className="marketplace-selection-list">
              {data.conversations.map((conversation) => (
                <button
                  type="button"
                  key={conversation.id}
                  className={`marketplace-selection-item ${selected?.id === conversation.id ? "marketplace-selection-item-active" : ""}`}
                  onClick={() => setSelectedId(conversation.id)}
                >
                  <span>
                    <strong className="body-strong">{conversation.ownerName}</strong>
                    <span className="caption text-ink-muted">{conversation.taskTitle}</span>
                  </span>
                  {conversation.unread > 0 && (
                    <Badge label={String(conversation.unread)} tone="primary" />
                  )}
                </button>
              ))}
            </div>
          </Card>
          {selected && (
            <Card title={selected.ownerName} meta={selected.taskTitle}>
              <Stack gap={16}>
                <div className="marketplace-review-list">
                  {selected.messages.map((message) => (
                    <div key={message.id}>
                      <div className="marketplace-card-footer">
                        <strong className="body-strong">
                          {message.sender === "bidder" ? "You" : selected.ownerName}
                        </strong>
                        <span className="caption">{message.time}</span>
                      </div>
                      <p className="body-sm">{message.body}</p>
                    </div>
                  ))}
                </div>
                <div className="marketplace-inline-actions">
                  <TextArea
                    label="Message"
                    placeholder="Ask about a link or respond to feedback"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                  <Button type="button" variant="primary" onClick={send}>
                    Send
                  </Button>
                </div>
              </Stack>
            </Card>
          )}
        </div>
      </Stack>
    </PageBody>
  );
}

function Earnings({ data }: { data: ReturnType<typeof useBidderWorkflow> }) {
  const { earnings } = useBidderContext();
  return (
    <PageBody>
      <Stack gap={24}>
        <Header
          title="Earnings"
          description="See how many application links passed review, what is pending, and what has already been paid."
          action={
            <Button href="/marketplace/candidate/work" variant="secondary">
              Review active work
            </Button>
          }
        />
        <Stats
          items={[
            [`$${(earnings.pendingCents / 100).toFixed(2)}`, "Pending QA"],
            [`$${(earnings.heldCents / 100).toFixed(2)}`, "Held"],
            [`$${(earnings.releasedCents / 100).toFixed(2)}`, "Released"],
            [`$${(earnings.paidCents / 100).toFixed(2)}`, "Paid to date"],
          ]}
        />
        <Card
          title="Assignment earnings"
          meta="Rates are agreed with each Job Hunter and applied per QA-passed link"
        >
          <div className="marketplace-review-list">
            {data.assignments.map((assignment) => (
              <div key={assignment.id}>
                <div className="marketplace-card-footer">
                  <div>
                    <strong className="body-strong">{assignment.packageName}</strong>
                    <p className="body-sm text-ink-muted">
                      {assignment.ownerName} · {assignment.ratePerLink}/link
                    </p>
                  </div>
                  <strong>{assignment.totalEarned}</strong>
                </div>
                <p className="body-sm text-ink-muted">
                  {assignment.links.filter((link) => link.status === "QA passed").length} QA-passed
                  links · {assignment.pendingEarned} pending review
                </p>
              </div>
            ))}
          </div>
        </Card>
      </Stack>
    </PageBody>
  );
}

function Performance() {
  const { performance } = useBidderContext();
  return (
    <PageBody>
      <Stack gap={24}>
        <Header
          title="Performance"
          description="Your quality, consistency, and output affect the tasks Job Hunters trust you with and the rates you can negotiate."
        />
        <Stats
          items={[
            [performance.level, "Current level"],
            [`${performance.qaPassRate}%`, "QA pass rate"],
            [`${performance.applicationsToday}/${performance.quota}`, "Today’s pace"],
            [`${performance.levelProgress}%`, "Next level progress"],
          ]}
        />
        <div className="marketplace-dashboard-grid">
          <Card
            title="How your work is judged"
            meta="These signals are visible to connected Job Hunters"
          >
            <div className="marketplace-review-list">
              <div>
                <strong className="body-strong">Quality</strong>
                <p className="body-sm text-ink-muted">
                  QA pass rate, relevance, evidence completeness, and correct use of approved
                  information.
                </p>
              </div>
              <div>
                <strong className="body-strong">Consistency</strong>
                <p className="body-sm text-ink-muted">
                  Daily output against the target agreed in each task.
                </p>
              </div>
              <div>
                <strong className="body-strong">Collaboration</strong>
                <p className="body-sm text-ink-muted">
                  Response time, asking clear questions, and resolving returned applications.
                </p>
              </div>
            </div>
          </Card>
          <Card title="Level progression" meta="Higher performance supports better package rates">
            <div className="bidder-progress">
              <span style={{ width: `${performance.levelProgress}%` }} />
            </div>
            <p className="body-sm text-ink-muted">
              You are {performance.levelProgress}% of the way from {performance.level} to the next
              level.
            </p>
            <Button href="/marketplace/candidate/work" variant="secondary">
              Improve active work
            </Button>
          </Card>
        </div>
      </Stack>
    </PageBody>
  );
}

function Profile() {
  const [saved, setSaved] = useState(false);
  return (
    <PageBody>
      <Stack gap={24}>
        <Header
          title="Bidder profile"
          description="Show Job Hunters what you can handle, how you work, and why they can trust you with application packages."
        />
        <div className="marketplace-dashboard-grid">
          <Card
            title="Public bidder profile"
            meta="This information appears when you express interest in a task"
          >
            <Stack gap={12}>
              <Input label="Display name" value="Alex Morgan" />
              <Input
                label="Specialties"
                value="Product operations · Program management · Greenhouse"
              />
              <Input label="Availability" value="Weekdays · 10–15 application links/day" />
              <TextArea
                label="About your work"
                value="I complete accurate, evidence-backed applications and communicate blockers early. I work best with clear package rules and daily targets."
              />
              <Button type="button" variant="primary" onClick={() => setSaved(true)}>
                {saved ? "Profile saved" : "Save profile"}
              </Button>
            </Stack>
          </Card>
          <Card title="Trust and work signals" meta="Signals Job Hunters use to choose bidders">
            <div className="marketplace-review-list">
              <div className="marketplace-card-footer">
                <span>Identity verification</span>
                <Badge label="Verified" tone="success" />
              </div>
              <div className="marketplace-card-footer">
                <span>Rules training</span>
                <Badge label="In progress" tone="primary" />
              </div>
              <div className="marketplace-card-footer">
                <span>QA pass rate</span>
                <strong>97%</strong>
              </div>
              <div className="marketplace-card-footer">
                <span>Completed application links</span>
                <strong>248</strong>
              </div>
            </div>
          </Card>
        </div>
      </Stack>
    </PageBody>
  );
}
