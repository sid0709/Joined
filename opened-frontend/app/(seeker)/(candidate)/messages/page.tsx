import type { Metadata } from "next";
import { Sticky } from "@openseat/design-system";
import { CandidateMessages } from "@/components/messages/candidate-messages";
import { PageContainer } from "@/components/page-container";
import { CONTENT_PADDING } from "@/components/shell/app-frame";
import { loadThreads } from "@/lib/me/pipeline";
import { MESSAGES_PAGE } from "@/lib/routes";

export const metadata: Metadata = {
  title: MESSAGES_PAGE.label,
  description: MESSAGES_PAGE.description,
};

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const threads = await loadThreads();
  return (
    <PageContainer width="wide">
      <Sticky fill offset={CONTENT_PADDING}>
        <CandidateMessages threads={threads} />
      </Sticky>
    </PageContainer>
  );
}
