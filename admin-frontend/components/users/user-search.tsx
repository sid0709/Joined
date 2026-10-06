"use client";

import { useState } from "react";
import { Banner, Button, Link, PageHeader, Stack, Text, TextInput } from "sid-ui";
import { ROUTES } from "@/lib/nav";
import { useAdminQuery } from "@/lib/use-admin-query";
import { userLookupPath, type AdminUser } from "@/lib/users";

export function UserSearch() {
  const [email, setEmail] = useState("");
  const [id, setId] = useState("");
  const [path, setPath] = useState("");
  const { result, loading, error, errorStatus } = useAdminQuery<AdminUser>(path);

  return (
    <Stack gap={4}>
      <PageHeader
        title="Users"
        description="Look up a Joined account by email or id. The address stays masked."
      />
      <TextInput label="Email" value={email} onChange={setEmail} />
      <TextInput label="User id" value={id} onChange={setId} />
      <Button
        label={loading ? "Searching…" : "Search"}
        variant="primary"
        isDisabled={loading || userLookupPath(email, id) === ""}
        clickAction={() => setPath(userLookupPath(email, id))}
      />
      {errorStatus === 401 ? (
        <Banner status="error" title="Sign in again to look up users." />
      ) : null}
      {errorStatus === 404 ? (
        <Banner status="warning" title="No user matched that search." />
      ) : null}
      {error && errorStatus !== 401 && errorStatus !== 404 ? (
        <Banner status="error" title={error} />
      ) : null}
      {!path && !loading ? <Text color="secondary">Search to see a masked profile.</Text> : null}
      {result ? (
        <Stack gap={1}>
          <Text weight="semibold">{result.name || "Unnamed"}</Text>
          <Text color="secondary">{result.email}</Text>
          <Text color="secondary">{result.role}</Text>
          <Link href={ROUTES.user(result.id)}>Open user</Link>
        </Stack>
      ) : null}
    </Stack>
  );
}
