import { Avatar, type AvatarSize } from "@openseat/design-system";
import { companyLogoSrc } from "@/lib/jobs";

/** A company’s mark. `src` is the stored logo URL; we load it through our own route. */
export function CompanyLogo({
  name,
  src,
  companyId,
  hasFile = false,
  size = 48,
}: {
  name: string;
  src?: string;
  companyId?: string;
  hasFile?: boolean;
  size?: AvatarSize;
}) {
  return (
    <Avatar
      name={name}
      src={companyLogoSrc(companyId, src, hasFile)}
      size={size}
      shape="rounded"
      tooltip={false}
    />
  );
}
