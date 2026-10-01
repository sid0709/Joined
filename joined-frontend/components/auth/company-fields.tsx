"use client";

import { useMemo, useState } from "react";
import {
  HStack,
  Icon,
  RadioList,
  RadioListItem,
  Stack,
  Text,
  TextInput,
  Typeahead,
  icons,
  type SearchSource,
  type SearchableItem,
} from "@joined/design-system";
import type { CompanyChoice, CompanyOption } from "@/lib/auth/types";
import { CompanyLogo } from "@/components/jobs/company-logo";

const SEARCH_DELAY_MS = 250;
const MIN_QUERY = 2;

export type HiringPath = "link" | "create";

type CompanyItem = SearchableItem<{ url?: string; logo?: string }>;

/** Join a company already in Joined, or start a new company page. */
export function CompanyFields({
  path,
  onPath,
  onChoice,
}: {
  path: HiringPath;
  onPath: (path: HiringPath) => void;
  onChoice: (choice: CompanyChoice | null) => void;
}) {
  const [selected, setSelected] = useState<CompanyItem | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const companies = useMemo(() => companySearch(), []);

  const choosePath = (next: HiringPath) => {
    onPath(next);
    if (next === "link") {
      onChoice(selected ? { id: selected.id } : null);
      return;
    }
    onChoice(name.trim() ? { name: name.trim(), url: url.trim() } : null);
  };

  return (
    <Stack gap={4}>
      <RadioList label="Company" value={path} onChange={(value) => choosePath(value as HiringPath)}>
        <RadioListItem
          value="link"
          label="Link a company already on Joined"
          description="Join a company page that already exists."
        />
        <RadioListItem
          value="create"
          label="Create a new company"
          description="Required if you don’t link an existing company."
        />
      </RadioList>

      {path === "link" ? (
        <Typeahead
          label="Find a company"
          placeholder="Company name"
          searchSource={companies}
          value={selected}
          onChange={(company) => {
            setSelected(company);
            onChoice(company ? { id: company.id } : null);
          }}
          minQueryLength={MIN_QUERY}
          debounceMs={SEARCH_DELAY_MS}
          emptySearchResultsText="No companies match."
          startIcon={<Icon icon={icons.search} />}
          renderItem={(company) => (
            <HStack gap={2} vAlign="center">
              <CompanyLogo
                name={company.label}
                companyId={company.id}
                src={company.auxiliaryData?.logo}
                size={32}
              />
              <Stack gap={0}>
                <Text>{company.label}</Text>
                {company.auxiliaryData?.url ? (
                  <Text type="supporting" color="secondary">
                    {company.auxiliaryData.url}
                  </Text>
                ) : null}
              </Stack>
            </HStack>
          )}
        />
      ) : (
        <Stack gap={3}>
          <TextInput
            label="Company name"
            value={name}
            onChange={(value) => {
              setName(value);
              onChoice(value.trim() ? { name: value.trim(), url: url.trim() } : null);
            }}
          />
          <TextInput
            label="Website"
            value={url}
            onChange={(value) => {
              setUrl(value);
              onChoice(name.trim() ? { name: name.trim(), url: value.trim() } : null);
            }}
            placeholder="company.com"
            isOptional
          />
        </Stack>
      )}
    </Stack>
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
      try {
        const response = await fetch(`/api/auth/companies?q=${encodeURIComponent(query)}`, {
          signal,
        });
        if (!response.ok) return [];
        const body = (await response.json()) as { companies?: CompanyOption[] };
        return (body.companies ?? []).map((company) => ({
          id: company.id,
          label: company.name,
          auxiliaryData: { url: company.url, logo: company.logo },
        }));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        return [];
      }
    },
  };
}
