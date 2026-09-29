/** The public page fields the company editor saves. */

export type Workspace = {
  id: string;
  slug: string;
  name: string;
  locations: string;
  about: string;
  industry: string;
  size: string;
  founded: number;
  replyDays: number;
  tagline: string;
  website: string;
  verified: boolean;
  benefits: string[];
};

export function emptyWorkspace(company: { id: string; name: string; url?: string }): Workspace {
  return {
    id: company.id,
    slug: company.id,
    name: company.name,
    locations: "",
    about: "",
    industry: "",
    size: "",
    founded: 0,
    replyDays: 0,
    tagline: "",
    website: company.url ?? "",
    verified: false,
    benefits: [],
  };
}
