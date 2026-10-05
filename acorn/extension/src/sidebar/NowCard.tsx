import { Badge, Button, Card, Glyph, HStack, ProgressBar, Text, VStack } from "sid-ui";
import type { PipelineProgress } from "@acorn/shared/pipeline-types";
import type { CustomUiProgress } from "../pipeline/custom-generate-progress";
import { customTabResumeLine, hostOf } from "./custom-tab-resume";
import { GenerateProgressBar } from "./GenerateProgressBar";
import { hasAssignedResume, resumeMetaText } from "./JobResumeActions";
import type { AcornMainTab } from "./SidebarNav";
import type { useTabSession } from "./use-tab-session";
import type { AcornWorkerJob } from "./WorkerPoolList";

type TabSession = ReturnType<typeof useTabSession>;

export type NowAction = {
  label: string;
  title: string;
  disabled: boolean;
  onClick: () => void;
};

type NowCardProps = {
  mainTab: Exclude<AcornMainTab, "qa">;
  tabJob: TabSession["tabJob"];
  /** The Worker pool row for tabJob, when the list has loaded it. */
  job: AcornWorkerJob | null;
  jobGenerate: TabSession["jobGenerates"][string] | null;
  customTab: TabSession["customTab"];
  progress: PipelineProgress;
  fillBusy: boolean;
  fill: NowAction;
  generate: NowAction;
  recommend: NowAction;
  remember: NowAction;
};

/** What the card says about the active tab, and which generate run (if any) it shows. */
function describe({
  mainTab,
  tabJob,
  job,
  jobGenerate,
  customTab,
  fillBusy,
}: Pick<NowCardProps, "mainTab" | "tabJob" | "job" | "jobGenerate" | "customTab" | "fillBusy">) {
  if (mainTab === "custom") {
    if (!customTab) {
      return {
        title: "This tab isn’t remembered",
        subtitle: "Remember it to generate or recommend a résumé, then Fill.",
        status: null,
        run: null,
      };
    }
    const line = customTabResumeLine(customTab, fillBusy);
    return {
      title: customTab.title || "Untitled",
      subtitle: hostOf(customTab.url),
      status: line,
      run: customTab.generateProgress ?? null,
    };
  }
  if (!tabJob) {
    return {
      title: "No job on this tab",
      subtitle: "Open a job below, or fill this page without a résumé.",
      status: null,
      run: null,
    };
  }
  const generating =
    jobGenerate?.generateStatus === "queued" || jobGenerate?.generateStatus === "running";
  const text = generating
    ? jobGenerate?.generateProgress?.label || "Generating…"
    : jobGenerate?.generationId
      ? "Generated"
      : job
        ? resumeMetaText(job)
        : "Résumé status loading…";
  return {
    title: tabJob.title,
    subtitle: tabJob.company,
    status: {
      text,
      ready:
        !generating &&
        (Boolean(jobGenerate?.generationId) || (job ? hasAssignedResume(job) : false)),
      failed: false,
    },
    run: generating ? (jobGenerate?.generateProgress ?? null) : null,
  };
}

function RunProgress({ run }: { run: CustomUiProgress }) {
  return (
    <VStack gap={1}>
      <GenerateProgressBar progress={run} />
      <Text type="supporting">{run.label}</Text>
    </VStack>
  );
}

/**
 * The active Chrome tab at the top of Jobs and Tabs: which job or remembered page it is,
 * its résumé, any run in flight, and the actions that work on it.
 */
export function NowCard(props: NowCardProps) {
  const { mainTab, customTab, progress, fillBusy, fill, generate, recommend, remember } = props;
  const { title, subtitle, status, run } = describe(props);
  const needsRemember = mainTab === "custom" && !customTab;
  const hasTarget = mainTab === "custom" ? Boolean(customTab) : Boolean(props.tabJob);

  return (
    <Card padding={4} className="acorn-now" elevation="low">
      <VStack gap={3}>
        <HStack gap={2} align="center" justify="between">
          <Text type="supporting" weight="semibold" color="accent">
            On this tab
          </Text>
          {status ? (
            <Badge
              variant={status.failed ? "error" : status.ready ? "green" : "neutral"}
              label={status.text}
            />
          ) : null}
        </HStack>
        <VStack gap={0}>
          <Text type="large" weight="semibold" maxLines={2}>
            {title}
          </Text>
          <Text type="supporting" maxLines={2}>
            {subtitle}
          </Text>
        </VStack>
        {run ? <RunProgress run={run} /> : null}
        {fillBusy ? <ProgressBar label={progress.message || "Filling…"} isIndeterminate /> : null}
        {needsRemember ? (
          <Button
            variant="primary"
            icon={<Glyph name="pin" />}
            label={remember.label}
            tooltip={remember.title}
            isDisabled={remember.disabled}
            width="100%"
            onClick={remember.onClick}
          />
        ) : (
          <VStack gap={2}>
            <Button
              variant="primary"
              icon={<Glyph name="edit" />}
              label={fill.label}
              tooltip={fill.title}
              isDisabled={fill.disabled}
              width="100%"
              onClick={fill.onClick}
            />
            {hasTarget ? (
              <HStack gap={2} className="acorn-now-row">
                <Button
                  variant="secondary"
                  label={generate.label}
                  tooltip={generate.title}
                  isDisabled={generate.disabled}
                  onClick={generate.onClick}
                />
                <Button
                  variant="secondary"
                  label={recommend.label}
                  tooltip={recommend.title}
                  isDisabled={recommend.disabled}
                  onClick={recommend.onClick}
                />
              </HStack>
            ) : null}
          </VStack>
        )}
      </VStack>
    </Card>
  );
}
