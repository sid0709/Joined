"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, GridColumn, GridSystem, HStack, Stack, Sticky, Text, useToast } from "sid-ui";
import { CompanyPageFields } from "@/components/company/about/company-page-fields";
import { CompanyCard } from "@/components/jobs/company-card";
import { SaveFooter } from "@/components/save-footer";
import {
  deleteCompanyLogo,
  fetchCompanyPage,
  saveCompanyPage,
  uploadCompanyLogo,
} from "@/lib/company/api";
import {
  emptyPageWrite,
  pageWriteFrom,
  type CompanyPage,
  type CompanyPageWrite,
} from "@/lib/company/page";
import type { AuthCompany } from "@/lib/auth/types";
import { companyLogoSrc } from "@/lib/jobs";

/** Edit the public company page on the left; see the card candidates get on the right. */
export function CompanyPageEditor({
  company,
  canEdit,
}: {
  company: AuthCompany;
  canEdit: boolean;
}) {
  const toast = useToast();
  const [page, setPage] = useState<CompanyPage | null>(null);
  const [draft, setDraft] = useState<CompanyPageWrite>(emptyPageWrite(company));
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoCleared, setLogoCleared] = useState(false);
  const [version, setVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const objectUrl = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : null), [logoFile]);

  useEffect(() => {
    if (!objectUrl) return;
    return () => URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  useEffect(() => {
    let active = true;
    fetchCompanyPage()
      .then((loaded) => {
        if (!active) return;
        setPage(loaded);
        setDraft(pageWriteFrom(loaded));
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }));
    return () => {
      active = false;
    };
  }, [toast]);

  const typedLogo = draft.logo.trim();
  const savedLogo = page?.logo?.trim() ?? "";
  const logoChanged = logoCleared || (typedLogo !== "" && typedLogo !== savedLogo);
  const logoPreview =
    objectUrl ||
    (logoChanged
      ? typedLogo || undefined
      : companyLogoSrc(page?.id ?? company.id, page?.logo, Boolean(page?.hasLogoFile), version));
  const canRemoveLogo = Boolean(logoFile || (page?.hasLogoFile && !logoCleared));

  const save = () => {
    if (!canEdit || saving) return;
    setSaving(true);
    saveCompanyPage(draft)
      .then(async (saved) => {
        if (logoFile) return uploadCompanyLogo(logoFile);
        if (logoCleared && page?.hasLogoFile) return deleteCompanyLogo();
        return saved;
      })
      .then((saved) => {
        setPage(saved);
        setDraft(pageWriteFrom(saved));
        setLogoFile(null);
        setLogoCleared(false);
        setVersion((token) => token + 1);
        toast({ body: "Company page published" });
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }))
      .finally(() => setSaving(false));
  };

  const footer = canEdit ? (
    <SaveFooter
      hint="Changes go live on your public page and every job card."
      message="Company page published"
      action={
        <Button label="Save" variant="primary" size="sm" onClick={save} isDisabled={saving} />
      }
    />
  ) : null;
  const benefits = draft.benefitCategories.flatMap((group) => group.items);

  return (
    <GridSystem gap={6} align="start">
      <GridColumn span="full" lg={7}>
        <CompanyPageFields
          draft={draft}
          onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
          footer={footer}
          logoPreview={logoPreview}
          logoFile={logoFile}
          canRemoveLogo={canRemoveLogo}
          onLogoFile={(file) => {
            setLogoFile(file);
            setLogoCleared(false);
          }}
          onLogoClear={() => {
            setLogoFile(null);
            setLogoCleared(true);
          }}
          taglineKey={version}
          canEdit={canEdit}
        />
      </GridColumn>

      <GridColumn span="full" lg={5}>
        <Sticky offset={4}>
          <Stack gap={3}>
            <HStack gap={2} vAlign="center">
              <Text type="label">Live preview</Text>
              <Text type="supporting" color="secondary">
                · as candidates see it
              </Text>
            </HStack>
            <CompanyCard
              company={{
                id: page?.id ?? company.id,
                slug: page?.id ?? company.id,
                name: draft.name,
                about: draft.about,
                industry: draft.industry,
                size: draft.size,
                founded: draft.founded || undefined,
                replyDays: draft.replyDays || undefined,
                locations: draft.locations,
                tagline: draft.tagline,
                benefits,
                logo: page?.logo,
                hasLogoFile: Boolean(page?.hasLogoFile) && !logoCleared && !logoFile,
                logoVersion: version,
                logoSrc: logoPreview,
              }}
              hasActions={false}
            />
          </Stack>
        </Sticky>
      </GridColumn>
    </GridSystem>
  );
}
