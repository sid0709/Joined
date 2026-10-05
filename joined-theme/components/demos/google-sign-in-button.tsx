"use client";

import {
  Button,
  Card,
  Divider,
  GoogleMark,
  GoogleSignInButton,
  Heading,
  Stack,
  TextInput,
} from "sid-ui";

import { Examples, Preview } from "./shared";

/** A demo route that goes nowhere, so the examples never start a real sign-in. */
const DEMO_ACTION = "#";

export default function GoogleSignInButtonDemo() {
  return (
    <Examples>
      <Preview label="Default" description="Full width, Google’s mark, the standard label.">
        <GoogleSignInButton action={DEMO_ACTION} />
      </Preview>

      <Preview
        label="Above a password form"
        description="Google first, then “or” and the email form, on sign-in and sign-up pages."
      >
        <Card padding={6}>
          <Stack gap={4}>
            <Heading level={2}>Sign in</Heading>
            <GoogleSignInButton action={DEMO_ACTION} next="/jobs" />
            <Divider label="or" />
            <TextInput label="Email" type="email" value="" onChange={() => undefined} />
            <TextInput label="Password" type="password" value="" onChange={() => undefined} />
            <Button label="Sign in" variant="primary" />
          </Stack>
        </Card>
      </Preview>

      <Preview label="Sign-up label" description="Say what the button does on a sign-up page.">
        <GoogleSignInButton action={DEMO_ACTION} label="Sign up with Google" />
      </Preview>

      <Preview label="Mark alone" description="Google’s “G”, for a connected-account row.">
        <GoogleMark size={24} />
      </Preview>
    </Examples>
  );
}
