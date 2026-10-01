import { Avatar } from "@joined/design-system";

const SIZES = { sm: 36, lg: 64 } as const;

/** A company's logo, or its initial when there is none or it fails to load. */
export function CompanyMark({
  name,
  logo,
  size = "sm",
}: {
  name?: string;
  logo?: string;
  size?: keyof typeof SIZES;
}) {
  return (
    <Avatar
      name={name?.trim() || "Company"}
      src={logo || undefined}
      size={SIZES[size]}
      shape="rounded"
      tooltip={false}
    />
  );
}
