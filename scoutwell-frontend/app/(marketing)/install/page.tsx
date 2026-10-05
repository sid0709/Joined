import type { Metadata } from "next";
import { InstallView } from "@/components/site/install-view";
import { extensionStoreUrl } from "@/lib/config";
import { INSTALL_PAGE } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Install the Scout extension",
  description: INSTALL_PAGE.description,
};

export default function InstallPage() {
  return <InstallView storeUrl={extensionStoreUrl()} />;
}
