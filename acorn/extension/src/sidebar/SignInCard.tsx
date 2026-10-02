type SignInCardProps = {
  authBusy: boolean;
  onSignIn: () => void;
};

/** Signed-out card: Acorn shares the Joined session, so sign-in is one button. */
export function SignInCard({ authBusy, onSignIn }: SignInCardProps) {
  return (
    <section className="connection">
      <div className="auth-form">
        <p className="auth-hint">
          Acorn uses your Joined account. Sign in to Joined in this browser, then continue.
        </p>
        <button type="button" className="tool-card primary" onClick={onSignIn} disabled={authBusy}>
          {authBusy ? "Connecting…" : "Continue with Joined"}
        </button>
      </div>
    </section>
  );
}
