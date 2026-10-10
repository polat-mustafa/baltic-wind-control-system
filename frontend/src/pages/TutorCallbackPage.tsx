/**
 * Return point of "Sign in with OpenRouter" (route /tutor/callback). Hands the one-time code
 * to the backend, which exchanges it for a key it keeps; then goes back to the page the
 * learner came from.
 */

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { openRouterFinish } from "../services/tutorApi";

export default function TutorCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) {
      setError("OpenRouter did not return a sign-in code.");
      return;
    }
    openRouterFinish(code, state)
      .then(() => {
        let back = "/";
        try {
          back = sessionStorage.getItem("of.tutor.return") || "/";
        } catch {
          /* storage blocked: go to the start page */
        }
        navigate(back, { replace: true });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [params, navigate]);

  return (
    <p className="text-sm text-text-secondary">
      {error ? <span className="text-status-alarm">Sign-in failed: {error}</span> : "Connecting the tutor to your OpenRouter account…"}
    </p>
  );
}
