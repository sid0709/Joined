"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banner, Button, Card, FormLayout, Input } from "@/src/shared/marketplace-ui";
import { useMockAuth } from "@/src/shared/auth/MockAuthContext";

export default function MarketplaceLoginPage() {
  const router = useRouter();
  const { loginUser } = useMockAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage("Enter your email address and password to continue.");
      return;
    }

    const result = loginUser(email, password);
    if (!result.success) {
      setErrorMessage(result.error ?? "Authentication error occurred.");
      return;
    }

    router.push(
      result.role === "Candidate"
        ? "/marketplace/candidate/dashboard"
        : result.role === "Client"
          ? "/marketplace/client/dashboard"
          : "/marketplace/join"
    );
  };

  return (
    <Card className="marketplace-auth-card">
      <form onSubmit={handleSubmit}>
        <FormLayout>
          <div>
            <h1 className="h1">Welcome back</h1>
            <p className="body text-ink-muted">Sign in to your OpenSeat bidding workspace.</p>
          </div>
          {errorMessage && <Banner tone="danger" title={errorMessage} />}
          <Input label="Email address" placeholder="you@example.com" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input label="Password" placeholder="Your password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <Button type="submit" variant="primary" className="marketplace-full-width">
            Sign in
          </Button>
          <p className="caption text-ink-muted marketplace-auth-footer">
            Don&apos;t have an account? <Link className="os-link" href="/marketplace/register">Register here</Link>
          </p>
        </FormLayout>
      </form>
    </Card>
  );
}
