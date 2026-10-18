import { Trans } from "@lingui/react/macro";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { WindowChrome } from "./WindowChrome";

export function WelcomePage() {
  const navigate = useNavigate();
  // Both actions here open the lazy Auth page; fetch it now so the click doesn't land on a blank frame.
  useEffect(() => {
    void import("./Auth");
  }, []);
  return (
    <div className="flex min-h-full flex-col bg-background" data-rakazo-surface="welcome">
      <div className="app-drag flex gap-2 px-5 py-[18px]">
        <WindowChrome />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-11 pb-[90px]">
        <div className="flex items-center gap-[26px]">
          <div aria-hidden="true" className="flex gap-2">
            <span className="milo-blink h-6 w-[11px] rounded-full bg-foreground" />
            <span className="milo-blink h-6 w-[11px] rounded-full bg-foreground" />
          </div>
          <div className="text-[76px] leading-none tracking-[-0.03em] text-foreground">Milo</div>
        </div>
        <p className="max-w-[600px] text-center text-[27px] leading-[1.4] text-muted-foreground">
          <Trans>
            Your team of always-on agents
            <br />
            that you can give real work to.
          </Trans>
        </p>
        <button
          type="button"
          onClick={() => navigate("/sign-up")}
          className="app-no-drag inline-flex h-[58px] items-center rounded-full bg-muted px-[34px] text-[19px] whitespace-nowrap text-foreground transition-transform hover:scale-[1.04] motion-reduce:transition-none"
        >
          <Trans>Sign up</Trans>&nbsp;&nbsp;→
        </button>
        <p className="-mt-6 text-muted-foreground">
          <Trans>Already have an account?</Trans>{" "}
          <Link to="/sign-in" className="app-no-drag font-medium text-foreground">
            <Trans>Sign in</Trans>
          </Link>
        </p>
      </div>
    </div>
  );
}
