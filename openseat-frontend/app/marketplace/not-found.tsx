import Link from "next/link";
import { EmptyState, PageBody } from "@openseat/design-system";

export default function MarketplaceNotFound() {
  return (
    <PageBody>
      <EmptyState
        title="Marketplace page not found"
        description="The marketplace route you requested does not exist."
      />
      <Link className="os-link marketplace-back-link" href="/marketplace">
        Return to marketplace sign in
      </Link>
    </PageBody>
  );
}
