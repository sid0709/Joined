import { Avatar, type AvatarSize } from "@openseat/design-system";

/** A company’s mark: initials on a tinted tile until real logos arrive. */
export function CompanyLogo({ name, size = 48 }: { name: string; size?: AvatarSize }) {
  return <Avatar name={name} size={size} shape="rounded" tooltip={false} />;
}
