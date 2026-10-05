import "@joined/design-system/styles/joined.css";
import { Button, Spinner } from "@joined/design-system";
import { useAuth } from "../hooks/useAuth";
import { getSignInUrl } from "../api";

function App() {
  const { authState, checkAuth, setSignInTabId } = useAuth();

  const handleSignIn = () => {
    const signInUrl = getSignInUrl();
    const newTab = window.open(signInUrl, "_blank");

    if (newTab) {
      chrome.tabs.query({ url: signInUrl }, (tabs) => {
        if (tabs.length > 0 && tabs[0].id) {
          setSignInTabId(tabs[0].id);
        }
      });

      const checkInterval = setInterval(() => {
        if (newTab.closed) {
          clearInterval(checkInterval);
          setSignInTabId(null);
        }
      }, 500);

      setTimeout(() => {
        clearInterval(checkInterval);
      }, 300000);
    }
  };

  return (
    <div
      style={{
        padding: "var(--spacing-4)",
        minWidth: "300px",
        minHeight: "200px",
      }}
    >
      <h1
        style={{
          fontSize: "var(--font-size-xl)",
          fontWeight: 600,
          marginBottom: "var(--spacing-4)",
        }}
      >
        Scout
      </h1>

      {authState.status === "loading" && (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-2)" }}>
          <Spinner size="sm" />
          <span>Checking sign-in status...</span>
        </div>
      )}

      {authState.status === "signed-out" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-3)" }}>
          <p style={{ color: "var(--color-text-secondary)" }}>
            Sign in to Scout to start capturing jobs.
          </p>
          <Button onClick={handleSignIn} variant="primary" label="Sign In to Scout" />
        </div>
      )}

      {authState.status === "signed-in" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-3)" }}>
          <div>
            <div style={{ fontWeight: 600 }}>{authState.profile.name}</div>
            <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
              {authState.profile.email}
            </div>
          </div>
          <div
            style={{
              padding: "var(--spacing-3)",
              backgroundColor: "var(--color-background-secondary)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
              Level: <strong>{authState.profile.level}</strong>
            </div>
          </div>
        </div>
      )}

      {authState.status === "error" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-3)" }}>
          <div
            style={{
              padding: "var(--spacing-3)",
              backgroundColor: "var(--color-background-error)",
              borderRadius: "var(--radius-md)",
              color: "var(--color-text-error)",
            }}
          >
            Error: {authState.error}
          </div>
          <Button onClick={() => checkAuth()} variant="secondary" label="Try Again" />
        </div>
      )}
    </div>
  );
}

export default App;
