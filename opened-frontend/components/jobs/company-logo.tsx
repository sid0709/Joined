import { Avatar, type AvatarSize } from "@openseat/design-system";
import { companyLogoSrc } from "@/lib/jobs";

/** A company’s mark. `src` is the stored logo URL; we load it through our own route. */
export function CompanyLogo({
  name,
  src,
  companyId,
  size = 48,
}: {
  name: string;
  src?: string;
  companyId?: string;
  size?: AvatarSize;
}) {
  return (
    <Avatar
      name={name}
      src={companyLogoSrc(companyId, src)}
      size={size}
      shape="rounded"
      tooltip={false}
    />
  );
}
