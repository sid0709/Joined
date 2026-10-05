"use client";

import {
  Banner,
  Button,
  Dialog,
  DialogHeader,
  FileUploader,
  FormLayout,
  HStack,
  Icon,
  Layout,
  LayoutContent,
  LayoutFooter,
  Stack,
  Text,
  TextInput,
  Typeahead,
  icons,
  type SearchSource,
  type SearchableItem,
} from "sid-ui";
import { ApiError } from "@joined/scout";
import { useMemo, useState } from "react";

import { scoutFetch, scoutUpload } from "@/lib/scout/client";

const SEARCH_DELAY_MS = 250;
const MIN_QUERY = 2;
const CREATE_COMPANY_ID = "create-company";
const DIALOG_WIDTH = 480;
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

export type CompanyChoice = {
  id: string;
  name: string;
  url?: string;
};

type CompanyHit = {
  id: string;
  name: string;
  url?: string;
  logo?: string;
};

type CompanyItem = SearchableItem<{
  url?: string;
  logo?: string;
  create?: boolean;
  query?: string;
}>;

/** Search companies already in the pool, or create one with a name, website, and logo. */
export function CompanyField({
  company,
  onCompany,
  status,
}: {
  company: CompanyChoice | null;
  onCompany: (company: CompanyChoice | null) => void;
  status?: { type: "error"; message: string };
}) {
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const companies = useMemo(() => companySearch(), []);
  const selected: CompanyItem | null = company
    ? { id: company.id, label: company.name, auxiliaryData: { url: company.url } }
    : null;

  return (
    <>
      <Typeahead
        label="Company"
        placeholder="Search companies"
        searchSource={companies}
        value={selected}
        onChange={(item) => {
          if (item?.auxiliaryData?.create) {
            setDraftName(item.auxiliaryData.query ?? "");
            setOpen(true);
            return;
          }
          onCompany(item ? { id: item.id, name: item.label, url: item.auxiliaryData?.url } : null);
        }}
        minQueryLength={MIN_QUERY}
        debounceMs={SEARCH_DELAY_MS}
        emptySearchResultsText="No companies match."
        isRequired
        status={status}
        startIcon={<Icon icon={icons.search} />}
        renderItem={(item) =>
          item.auxiliaryData?.create ? (
            <Stack gap={0}>
              <Text weight="medium">Create a company</Text>
              <Text type="supporting" color="secondary">
                {item.auxiliaryData.query} is not in the pool yet.
              </Text>
            </Stack>
          ) : (
            <Stack gap={0}>
              <Text>{item.label}</Text>
              {item.auxiliaryData?.url ? (
                <Text type="supporting" color="secondary">
                  {item.auxiliaryData.url}
                </Text>
              ) : null}
            </Stack>
          )
        }
      />
      <CreateCompanyDialog
        isOpen={open}
        initialName={draftName}
        onOpenChange={setOpen}
        onCreated={(created) => {
          onCompany(created);
          setOpen(false);
        }}
      />
    </>
  );
}

function CreateCompanyDialog({
  isOpen,
  initialName,
  onOpenChange,
  onCreated,
}: {
  isOpen: boolean;
  initialName: string;
  onOpenChange: (isOpen: boolean) => void;
  onCreated: (company: CompanyChoice) => void;
}) {
  return (
    <CreateCompanyForm
      key={`${isOpen}-${initialName}`}
      isOpen={isOpen}
      initialName={initialName}
      onOpenChange={onOpenChange}
      onCreated={onCreated}
    />
  );
}

function CreateCompanyForm({
  isOpen,
  initialName,
  onOpenChange,
  onCreated,
}: {
  isOpen: boolean;
  initialName: string;
  onOpenChange: (isOpen: boolean) => void;
  onCreated: (company: CompanyChoice) => void;
}) {
  const [legalName, setLegalName] = useState(initialName);
  const [website, setWebsite] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const field = (name: string) => {
    const message = error?.field(name);
    return message ? { type: "error" as const, message } : undefined;
  };
  const logoMessage = error?.field("logo");

  const create = async () => {
    setSaving(true);
    setError(null);
    setFailure(null);
    const body = new FormData();
    body.set("legal_name", legalName.trim());
    body.set("url", website.trim());
    if (logo) body.set("logo", logo);
    try {
      const created = await scoutUpload<CompanyHit>("/companies", body);
      onCreated({ id: created.id, name: created.name, url: created.url });
    } catch (err) {
      if (err instanceof ApiError) setError(err);
      else setFailure("Could not create the company. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={DIALOG_WIDTH}>
      <Layout
        height="auto"
        header={
          <DialogHeader
            title="Create a company"
            subtitle="Legal name, website, and logo. The rest of the page is filled in later."
            onOpenChange={onOpenChange}
            hasDivider
          />
        }
        content={
          <LayoutContent>
            <FormLayout>
              <TextInput
                label="Legal name"
                value={legalName}
                onChange={setLegalName}
                isRequired
                status={field("legal_name")}
              />
              <TextInput
                label="Website"
                value={website}
                onChange={setWebsite}
                isRequired
                placeholder="acme.com"
                status={field("url")}
              />
              <FileUploader
                label="Logo"
                description="PNG, JPEG, WebP, or GIF."
                accept={LOGO_ACCEPT}
                maxSize={LOGO_MAX_BYTES}
                maxFiles={1}
                isMultiple={false}
                variant="compact"
                onChange={(files) => setLogo(files[0] ?? null)}
              />
              {logoMessage ? <Banner status="error" title={logoMessage} /> : null}
              {failure ? <Banner status="error" title={failure} /> : null}
              {error && !error.field("legal_name") && !error.field("url") && !logoMessage ? (
                <Banner status="error" title={error.message} />
              ) : null}
            </FormLayout>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="end">
              <Button label="Cancel" variant="ghost" clickAction={() => onOpenChange(false)} />
              <Button
                label={saving ? "Creating…" : "Create company"}
                variant="primary"
                clickAction={create}
                isDisabled={saving || !legalName.trim() || !website.trim()}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}

function companySearch(): SearchSource<CompanyItem> {
  let controller: AbortController | null = null;
  return {
    bootstrap: () => [],
    cancel() {
      controller?.abort();
    },
    async search(query) {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      const trimmed = query.trim();
      const create = createItem(trimmed);
      try {
        const body = await scoutFetch<{ companies?: CompanyHit[] }>(
          `/companies?q=${encodeURIComponent(trimmed)}`,
          signal,
        );
        if (signal.aborted) return [];
        const items = (body.companies ?? []).map((company) => ({
          id: company.id,
          label: company.name,
          auxiliaryData: { url: company.url, logo: company.logo },
        }));
        const exact = items.some((item) => item.label.toLowerCase() === trimmed.toLowerCase());
        return exact ? items : [...items, create];
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw error;
        return [create];
      }
    },
  };
}

function createItem(query: string): CompanyItem {
  return {
    id: CREATE_COMPANY_ID,
    label: "Create a company",
    auxiliaryData: { create: true, query },
  };
}
