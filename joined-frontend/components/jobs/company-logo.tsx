import { Avatar, type AvatarSize } from "sid-ui";
import { companyLogoSrc } from "@/lib/jobs";

/** A company’s mark. `src` is the stored logo URL; we load it through our own route. */
export function CompanyLogo({
  name,
  src,
  companyId,
  hasFile = false,
  size = 48,
  version = 0,
  srcOverride,
}: {
  name: string;
  src?: string;
  companyId?: string;
  hasFile?: boolean;
  size?: AvatarSize;
  version?: number;
  /** A draft or local preview. Used as-is, instead of the saved logo route. */
  srcOverride?: string;
}) {
  return (
    <Avatar
      name={name}
      src={srcOverride || companyLogoSrc(companyId, src, hasFile, version) || undefined}
      size={size}
      shape="rounded"
      tooltip={false}
    />
  );
}
