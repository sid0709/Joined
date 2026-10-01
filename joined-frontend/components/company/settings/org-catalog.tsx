"use client";

import { useEffect, useState } from "react";
import { Button, HStack, Stack, Text, TextInput, useToast } from "@joined/design-system";
import { SaveFooter } from "@/components/save-footer";
import { SettingsGroup } from "@/components/settings-group";
import {
  fetchDepartments,
  fetchOfficeLocations,
  saveDepartments,
  saveOfficeLocations,
} from "@/lib/company/api";
import { isForbiddenError } from "@/lib/me/client";
import { MAX_DEPARTMENTS, MAX_OFFICE_LOCATIONS } from "@/lib/layer-a";
import { canPermission, denialReason, type TeamRole } from "@/lib/rbac";

function CatalogRow({
  name,
  canEdit,
  onRename,
  onRemove,
}: {
  name: string;
  canEdit: boolean;
  onRename: (next: string) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(name);
  return (
    <HStack gap={2} vAlign="end" wrap="wrap">
      <TextInput
        label="Name"
        isLabelHidden
        value={draft}
        onChange={setDraft}
        isReadOnly={!canEdit}
        onBlur={() => {
          if (!canEdit) return;
          const next = draft.trim();
          if (!next) {
            setDraft(name);
            return;
          }
          if (next !== name) onRename(next);
        }}
      />
      {canEdit ? <Button label="Remove" variant="ghost" size="sm" onClick={onRemove} /> : null}
    </HStack>
  );
}

function CatalogEditor({
  title,
  description,
  hint,
  items,
  placeholder,
  max,
  canEdit,
  denial,
  onChange,
  onRename,
  onSave,
}: {
  title: string;
  description: string;
  hint: string;
  items: string[];
  placeholder: string;
  max: number;
  canEdit: boolean;
  denial: string;
  onChange: (next: string[]) => void;
  onRename: (from: string, to: string) => void;
  onSave: () => void;
}) {
  const [draft, setDraft] = useState("");
  const value = draft.trim();
  const canAdd =
    canEdit &&
    Boolean(value) &&
    items.length < max &&
    !items.some((item) => item.toLowerCase() === value.toLowerCase());

  return (
    <SettingsGroup
      title={title}
      description={description}
      footer={
        canEdit ? (
          <SaveFooter
            hint={hint}
            message={`${title} saved`}
            action={<Button label="Save" variant="primary" size="sm" onClick={onSave} />}
          />
        ) : (
          <Text type="supporting" color="secondary">
            {denial}
          </Text>
        )
      }
    >
      {items.length === 0 ? (
        <Text type="supporting" color="secondary">
          None yet.
        </Text>
      ) : (
        items.map((item) => (
          <CatalogRow
            key={item}
            name={item}
            canEdit={canEdit}
            onRename={(next) => onRename(item, next)}
            onRemove={() => onChange(items.filter((entry) => entry !== item))}
          />
        ))
      )}
      {canEdit ? (
        <HStack gap={2} vAlign="end" wrap="wrap">
          <TextInput
            label={`Add ${title.toLowerCase()}`}
            isLabelHidden
            value={draft}
            onChange={setDraft}
            placeholder={placeholder}
          />
          <Button
            label="Add"
            variant="secondary"
            isDisabled={!canAdd}
            onClick={() => {
              onChange([...items, value]);
              setDraft("");
            }}
          />
        </HStack>
      ) : null}
    </SettingsGroup>
  );
}

function catalogErrorMessage(error: unknown, fallback: string) {
  if (isForbiddenError(error)) return error.message || fallback;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Company-wide departments and office locations (Layer A). Writes need jobs.edit. */
export function OrgCatalogSettings({ actorRole = null }: { actorRole?: TeamRole | null }) {
  const toast = useToast();
  const canEdit = canPermission(actorRole, "jobs.edit");
  const denial = denialReason(actorRole, "jobs.edit");
  const [departments, setDepartments] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([fetchDepartments(), fetchOfficeLocations()])
      .then(([nextDepartments, nextLocations]) => {
        if (!active) return;
        setDepartments(nextDepartments);
        setLocations(nextLocations);
      })
      .catch((error: unknown) =>
        toast({ body: catalogErrorMessage(error, "Could not load catalogs."), type: "error" }),
      );
    return () => {
      active = false;
    };
  }, [toast]);

  const renameDepartment = (from: string, to: string) => {
    if (!canEdit) {
      toast({ body: denial, type: "error" });
      return;
    }
    const next = [...new Set(departments.map((entry) => (entry === from ? to : entry)))].filter(
      Boolean,
    );
    saveDepartments(next, { from, to })
      .then((saved) => {
        setDepartments(saved);
        toast({ body: `Renamed “${from}” to “${to}”.` });
      })
      .catch((error: unknown) =>
        toast({ body: catalogErrorMessage(error, denial), type: "error" }),
      );
  };

  const renameLocation = (from: string, to: string) => {
    if (!canEdit) {
      toast({ body: denial, type: "error" });
      return;
    }
    const next = [...new Set(locations.map((entry) => (entry === from ? to : entry)))].filter(
      Boolean,
    );
    saveOfficeLocations(next, { from, to })
      .then((saved) => {
        setLocations(saved);
        toast({ body: `Renamed “${from}” to “${to}”.` });
      })
      .catch((error: unknown) =>
        toast({ body: catalogErrorMessage(error, denial), type: "error" }),
      );
  };

  return (
    <Stack gap={6}>
      <CatalogEditor
        title="Departments"
        description="Shown as Team on job posts. Renaming updates open jobs that use that label."
        hint="Saved to GET/PUT /v1/company/departments."
        items={departments}
        placeholder="Engineering"
        max={MAX_DEPARTMENTS}
        canEdit={canEdit}
        denial={denial}
        onChange={setDepartments}
        onRename={renameDepartment}
        onSave={() => {
          if (!canEdit) {
            toast({ body: denial, type: "error" });
            return;
          }
          saveDepartments(departments)
            .then((saved) => {
              setDepartments(saved);
              toast({ body: "Departments saved" });
            })
            .catch((error: unknown) =>
              toast({ body: catalogErrorMessage(error, denial), type: "error" }),
            );
        }}
      />
      <CatalogEditor
        title="Office locations"
        description="Suggested cities when posting a job. Location on each job stays free text."
        hint="Saved to GET/PUT /v1/company/office-locations."
        items={locations}
        placeholder="Chicago, IL"
        max={MAX_OFFICE_LOCATIONS}
        canEdit={canEdit}
        denial={denial}
        onChange={setLocations}
        onRename={renameLocation}
        onSave={() => {
          if (!canEdit) {
            toast({ body: denial, type: "error" });
            return;
          }
          saveOfficeLocations(locations)
            .then((saved) => {
              setLocations(saved);
              toast({ body: "Office locations saved" });
            })
            .catch((error: unknown) =>
              toast({ body: catalogErrorMessage(error, denial), type: "error" }),
            );
        }}
      />
    </Stack>
  );
}
