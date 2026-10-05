"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  Banner,
  Button,
  Card,
  EmptyState,
  Glyph,
  HStack,
  SegmentedControl,
  SegmentedControlItem,
  Spinner,
  Stack,
  Text,
  TextInput,
  Token,
  useToast,
} from "sid-ui";
import { FormDialog } from "@/components/form-dialog";
import { DEFAULT_FILTERS, type JobFilters } from "@/lib/jobs";
import { CompanyRequestError } from "@/lib/me/client";
import { signInHref } from "@/lib/routes";
import {
  SAVED_SEARCH_CADENCE_OPTIONS,
  type SavedSearch,
  type SavedSearchCadence,
  applySavedSearch,
  createSavedSearch,
  deleteSavedSearch,
  filtersToSavedSearch,
  isSavedSearchLimitError,
  listSavedSearches,
  sameSavedQuery,
  suggestSavedSearchName,
  updateSavedSearch,
} from "@/lib/saved-searches";

/** Save the current browse filters and manage alert cadence for this account. */
export function SavedSearches({
  signedIn,
  filters,
  onApply,
}: {
  signedIn: boolean;
  filters?: JobFilters;
  onApply: (filters: JobFilters) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "error">(
    signedIn ? "loading" : "idle",
  );
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState<"create" | SavedSearch | null>(null);
  const [name, setName] = useState("");
  const [cadence, setCadence] = useState<SavedSearchCadence>("daily");
  const [pendingDelete, setPendingDelete] = useState<SavedSearch | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    listSavedSearches()
      .then((searches) => {
        if (cancelled) return;
        setItems(searches);
        setPhase("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const goSignIn = () => {
    router.push(signInHref(`${window.location.pathname}${window.location.search}`));
  };

  const fail = (error: unknown) => {
    if (error instanceof CompanyRequestError && error.status === 401) {
      goSignIn();
      return;
    }
    if (isSavedSearchLimitError(error)) {
      toast({ body: "You can save up to 20 searches. Delete one to add another." });
      return;
    }
    toast({ body: "Couldn't update saved searches. Try again." });
  };

  const changeCadence = async (search: SavedSearch, next: SavedSearchCadence) => {
    const previous = items;
    setItems((current) =>
      current.map((item) => (item.id === search.id ? { ...item, alertFrequency: next } : item)),
    );
    try {
      const updated = await updateSavedSearch(search.id, { alertFrequency: next });
      setItems((current) => current.map((item) => (item.id === search.id ? updated : item)));
    } catch (error) {
      setItems(previous);
      fail(error);
    }
  };

  const submit = async () => {
    if (!filters && editor === "create") return;
    setSaving(true);
    try {
      if (editor && editor !== "create") {
        const updated = await updateSavedSearch(editor.id, {
          name,
          alertFrequency: cadence,
          ...(filters ? filtersToSavedSearch(filters) : {}),
        });
        setItems((current) => current.map((item) => (item.id === editor.id ? updated : item)));
        toast({ body: "Saved search updated." });
      } else if (filters) {
        const draft = filtersToSavedSearch(filters);
        const created = await createSavedSearch({
          name,
          query: draft.query,
          filters: draft.filters,
          alertFrequency: cadence,
        });
        setItems((current) => [created, ...current]);
        toast({ body: "Search saved." });
      }
      setEditor(null);
    } catch (error) {
      fail(error);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteSavedSearch(target.id);
      setItems((current) => current.filter((item) => item.id !== target.id));
      toast({ body: "Saved search deleted." });
    } catch (error) {
      fail(error);
    }
  };

  const apply = (search: SavedSearch) => {
    if (!filters) {
      onApply(applySavedSearch(DEFAULT_FILTERS, search));
      return;
    }
    onApply(applySavedSearch(filters, search));
  };

  return (
    <Card padding={4} variant="muted">
      <Stack gap={3}>
        <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
          <Text type="label">Saved searches</Text>
          {filters ? (
            <Button
              label="Create job alert"
              variant="secondary"
              size="sm"
              icon={<Glyph name="bell" />}
              onClick={() => {
                if (!signedIn) {
                  goSignIn();
                  return;
                }
                const existing = items.find((item) => sameSavedQuery(item, filters));
                setName(existing?.name ?? suggestSavedSearchName(filters));
                setCadence(existing?.alertFrequency ?? "daily");
                setEditor(existing ?? "create");
              }}
            />
          ) : null}
        </HStack>

        {!signedIn ? (
          <EmptyState
            title="Sign in to save a search"
            description="Saved searches and email alerts stay on your account."
            actions={<Button label="Sign in" variant="primary" onClick={goSignIn} />}
          />
        ) : null}

        {phase === "loading" ? (
          <HStack gap={2} vAlign="center">
            <Spinner size="sm" />
            <Text color="secondary">Loading saved searches…</Text>
          </HStack>
        ) : null}

        {phase === "error" ? (
          <Banner
            status="error"
            title="Saved searches are unavailable"
            description="Refresh the page and try again."
          />
        ) : null}

        {phase === "ready" && items.length === 0 ? (
          <Text color="secondary" display="block">
            No saved searches yet. Recent chips above stay on this device only.
          </Text>
        ) : null}

        {items.length > 0 ? (
          <Stack gap={2}>
            {items.map((search) => (
              <HStack key={search.id} hAlign="between" vAlign="center" gap={2} wrap="wrap">
                <Token label={search.name} size="sm" onClick={() => apply(search)} />
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <SegmentedControl
                    label={`Alerts for ${search.name}`}
                    value={search.alertFrequency}
                    onChange={(value) => {
                      const next = SAVED_SEARCH_CADENCE_OPTIONS.find(
                        (option) => option.value === value,
                      );
                      if (next) void changeCadence(search, next.value);
                    }}
                    size="sm"
                  >
                    {SAVED_SEARCH_CADENCE_OPTIONS.map((option) => (
                      <SegmentedControlItem
                        key={option.value}
                        value={option.value}
                        label={option.label}
                      />
                    ))}
                  </SegmentedControl>
                  <Button
                    label="Rename"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setName(search.name);
                      setCadence(search.alertFrequency);
                      setEditor(search);
                    }}
                  />
                  <Button
                    label="Delete"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPendingDelete(search)}
                  />
                </HStack>
              </HStack>
            ))}
          </Stack>
        ) : null}
      </Stack>

      <FormDialog
        isOpen={editor !== null}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
        title={editor && editor !== "create" ? "Update saved search" : "Save this search"}
        subtitle="Email alerts are off, daily, or weekly. We do not send instant alerts."
        submitLabel={saving ? "Saving…" : "Save"}
        isSubmitDisabled={saving || name.trim().length === 0}
        onSubmit={() => void submit()}
      >
        <Stack gap={4}>
          <TextInput label="Name" value={name} onChange={setName} placeholder="Name this search" />
          <SegmentedControl
            label="Email alerts"
            value={cadence}
            onChange={(value) => {
              const next = SAVED_SEARCH_CADENCE_OPTIONS.find((option) => option.value === value);
              if (next) setCadence(next.value);
            }}
          >
            {SAVED_SEARCH_CADENCE_OPTIONS.map((option) => (
              <SegmentedControlItem key={option.value} value={option.value} label={option.label} />
            ))}
          </SegmentedControl>
        </Stack>
      </FormDialog>

      <AlertDialog
        isOpen={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete this saved search?"
        description="The search and its email alert are removed from your account."
        actionLabel="Delete"
        actionVariant="destructive"
        onAction={() => void remove()}
      />
    </Card>
  );
}
