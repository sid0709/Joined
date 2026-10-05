import { Button, PageHeader } from "sid-ui";
import type { Meta } from "@joined/scout";
import { INSTALL_PAGE, ROUTES } from "@/lib/routes";
import { faqItems } from "@/lib/site-copy";
import { FaqList } from "./faq-list";

export function FaqView({ meta }: { meta: Meta }) {
  return (
    <div className="sw-site">
      <PageHeader
        title="Frequently asked questions"
        description="What Scout is, how pay works, how to install the extension, and how to sign in from it."
      />
      <FaqList items={faqItems(meta)} />
      <div className="sw-cta-row">
        <Button label={INSTALL_PAGE.label} variant="primary" href={INSTALL_PAGE.href} />
        <Button label="Become a scout" variant="secondary" href={ROUTES.signUp} />
      </div>
    </div>
  );
}
