export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export type AuthCompany = {
  id: string;
  name: string;
  url?: string;
  logo?: string;
  role: "owner" | "member";
  /** True when this person created the company page. */
  isCreator?: boolean;
};

export type AuthSession = {
  user: AuthUser;
  company: AuthCompany | null;
};

export type CompanyOption = {
  id: string;
  name: string;
  url?: string;
  logo?: string;
};

export type CompanyChoice = { id: string } | { name: string; url: string };
