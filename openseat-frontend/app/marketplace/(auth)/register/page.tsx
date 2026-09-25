"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banner, Button, Card, FormLayout, Input } from "@openseat/design-system";
import { useMockAuth } from "@/src/shared/auth/MockAuthContext";

export default function MarketplaceRegisterPage() {
  const router = useRouter();
  const { registerUser } = useMockAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!fullName || !email || !password) {
      setErrorMessage("Complete your name, email address, and password.");
      return;
    }

    const result = registerUser(fullName, email, password);
    if (!result.success) {
      setErrorMessage(result.error ?? "Registration validation error.");
      return;
    }
    router.push("/marketplace/join");
  };

  return (
    <Card className="marketplace-auth-card">
      <form onSubmit={handleSubmit}>
        <FormLayout>
          <div>
            <h1 className="h1">Create your account</h1>
            <p className="body text-ink-muted">Join the OpenSeat marketplace for focused project work.</p>
          </div>
          {errorMessage && <Banner tone="danger" title={errorMessage} />}
          <Input label="Full name" placeholder="Your name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
          <Input label="Email address" placeholder="you@example.com" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input label="Password" placeholder="Choose a secure password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <Button type="submit" variant="primary" className="marketplace-full-width">
            Create account
          </Button>
          <p className="caption text-ink-muted marketplace-auth-footer">
            Already registered? <Link className="os-link" href="/marketplace/login">Sign in</Link>
          </p>
        </FormLayout>
      </form>
    </Card>
  );
}
