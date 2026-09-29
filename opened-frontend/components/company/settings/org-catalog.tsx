"use client";

import { useEffect, useState } from "react";
import { Button, HStack, Stack, Text, TextInput, useToast } from "@openseat/design-system";
import { SaveFooter } from "@/components/save-footer";
import { SettingsGroup } from "@/components/settings-group";
import {
  fetchDepartments,
  fetchOfficeLocations,
  saveDepartments,
  saveOfficeLocations,
} from "@/lib/company/api";
import { MAX_DEPARTMENTS, MAX_OFFICE_LOCATIONS } from "@/lib/layer-a";

function CatalogRow({
  name,
  onRename,
  onRemove,
}: {
  name: string;
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
        onBlur={() => {
          const next = draft.trim();
          if (!next) {
            setDraft(name);
            return;
          }
          if (next !== name) onRename(next);
        }}
      />
      <Button label="Remove" variant="ghost" size="sm" onClick={onRemove} />
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
  onChange,
  onSave,
}: {
  title: string;
  description: string;
  hint: string;
  items: string[];
  placeholder: string;
  max: number;
  onChange: (next: string[]) => void;
  onSave: () => void;
}) {
  const [draft, setDraft] = useState("");
  const value = draft.trim();
  const canAdd =
    Boolean(value) &&
    items.length < max &&
    !items.some((item) => item.toLowerCase() === value.toLowerCase());

  return (
    <SettingsGroup
      title={title}
      description={description}
      footer={
        <SaveFooter
          hint={hint}
          message={`${title} saved`}
          action={<Button label="Save" variant="primary" size="sm" onClick={onSave} />}
        />
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
            onRename={(next) =>
              onChange(
                [...new Set(items.map((entry) => (entry === item ? next : entry)))].filter(Boolean),
              )
            }
            onRemove={() => onChange(items.filter((entry) => entry !== item))}
          />
        ))
      )}
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
    </SettingsGroup>
  );
}

/** Company-wide departments and office locations (Layer A scaffold). */
export function OrgCatalogSettings() {
  const toast = useToast();
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
      .catch((error: Error) => toast({ body: error.message, type: "error" }));
    return () => {
      active = false;
    };
  }, [toast]);

  return (
    <Stack gap={6}>
      <CatalogEditor
        title="Departments"
        description="Shown as Team on job posts. Einstein may later split department from team."
        hint="Mirrored to job teams when /departments is thin."
        items={departments}
        placeholder="Engineering"
        max={MAX_DEPARTMENTS}
        onChange={setDepartments}
        onSave={() =>
          saveDepartments(departments)
            .then((saved) => {
              setDepartments(saved);
              toast({ body: "Departments saved" });
            })
            .catch((error: Error) => toast({ body: error.message, type: "error" }))
        }
      />
      <CatalogEditor
        title="Office locations"
        description="Suggested cities when posting a job. Location on each job stays free text."
        hint="Soft-saved locally until GET/PUT /v1/company/office-locations lands."
        items={locations}
        placeholder="Chicago, IL"
        max={MAX_OFFICE_LOCATIONS}
        onChange={setLocations}
        onSave={() =>
          saveOfficeLocations(locations)
            .then((saved) => {
              setLocations(saved);
              toast({ body: "Office locations saved" });
            })
            .catch((error: Error) => toast({ body: error.message, type: "error" }))
        }
      />
    </Stack>
  );
}
