import Link from "next/link";

import { BrandLockup, EmptyState, PageBody } from "@/src/shared/marketplace-ui";

export default function MarketplaceNotFound() {
  return (
    <PageBody>
      <BrandLockup />
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
