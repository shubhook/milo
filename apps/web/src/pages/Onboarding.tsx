import { Trans, useLingui } from "@lingui/react/macro";
import type { AgentStatus, ConnectionCatalogItem, IntegrationSetupState } from "@milo/contracts";
import { BOT_NAME_MAX_LENGTH } from "@milo/contracts";
import { buildFeaturedConnectorTiles } from "@milo/core";
import { BotAvatar, Button, DEFAULT_GROK_BOT_COLOR, Input } from "@milo/ui-web";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BotColorChoices } from "../components/BotAvatarChoices";
import { IntegrationSetup } from "../components/integrations/IntegrationSetup";
import { rpc } from "../lib/rpc";
import { agentReady, OnboardingAgentStep } from "./OnboardingAgent";
import { OnboardingAppsStep } from "./OnboardingApps";

const FIRST_BOT_NAME = "Chief";
const FIRST_BOT_SPAWN_KEY = "onboarding:first";
const FIRST_BOT_LOCK = "rakazo:onboarding-first-bot";

/** Survives StrictMode remounts; concurrent first-bot creates share one in-flight attempt. */
let firstBotEnsure: Promise<{ id: string }> | null = null;

function findFirstBot(
  bots: Array<{ id: string; name: string; spawnKey: string | null }>,
): { id: string } | undefined {
  const bySpawnKey = bots.find((bot) => bot.spawnKey === FIRST_BOT_SPAWN_KEY);
  if (bySpawnKey) return { id: bySpawnKey.id };
  // Legacy first-run Chief created before spawnKey was set.
  const byName = bots.find((bot) => bot.name === FIRST_BOT_NAME);
  return byName ? { id: byName.id } : undefined;
}

type FirstBot = { name: string; color: string };

async function createOrReuseFirstBot(first: FirstBot): Promise<{ id: string }> {
  const existing = await rpc.bots.list();
  const reuse = findFirstBot(existing);
  if (reuse) return reuse;
  try {
    const created = await rpc.bots.create({
      name: first.name,
      title: "",
      description: "",
      instructions: "",
      notifyOnFinish: true,
      color: first.color,
      spawnKey: FIRST_BOT_SPAWN_KEY,
    });
    return { id: created.id };
  } catch (error) {
    // Another tab won the unique (spaceId, spawnKey) race; reuse that bot only.
    const afterConflict = await rpc.bots.list();
    const winner = afterConflict.find((bot) => bot.spawnKey === FIRST_BOT_SPAWN_KEY);
    if (winner) return { id: winner.id };
    throw error;
  }
}

async function withFirstBotLock<T>(run: () => Promise<T>): Promise<T> {
  const locks = globalThis.navigator?.locks;
  if (!locks?.request) return run();
  return locks.request(FIRST_BOT_LOCK, run);
}

async function ensureFirstBot(first: FirstBot): Promise<{ id: string }> {
  if (firstBotEnsure) return firstBotEnsure;
  // Web Lock serializes cross-tab creates; module promise covers same-tab StrictMode.
  // spawnKey makes create idempotent when locks are unavailable.
  // Clear after settle so a later empty-space visit re-lists instead of reusing a deleted id.
  firstBotEnsure = withFirstBotLock(() => createOrReuseFirstBot(first)).finally(() => {
    firstBotEnsure = null;
  });
  return firstBotEnsure;
}

export function OnboardingPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const [step, setStep] = useState<"loading" | "agent" | "integrations" | "apps" | "meet">(
    "loading",
  );
  const [catalog, setCatalog] = useState<ConnectionCatalogItem[]>([]);
  const [botName, setBotName] = useState(FIRST_BOT_NAME);
  const [botColor, setBotColor] = useState(DEFAULT_GROK_BOT_COLOR);
  const [creating, setCreating] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [integrationSetup, setIntegrationSetup] = useState<IntegrationSetupState | null>(null);
  const [integrationServers, setIntegrationServers] = useState<string[]>([]);
  const createStartedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      rpc.agent.status().catch(() => null),
      rpc.integrationSetup.get().catch(() => null),
      rpc.connections.catalog({}).catch(() => []),
      rpc.bots.list().catch(() => []),
    ])
      .then(([agent, integrations, apps, bots]) => {
        // A stale onboarding URL in a space that already met its first bot goes back to it.
        const existing = findFirstBot(bots);
        if (existing) {
          navigate(`/app/${existing.id}`, { replace: true });
          return;
        }
        setAgentStatus(agent);
        setIntegrationSetup(integrations);
        setCatalog(apps);
        setStep(
          agent && !agentReady(agent)
            ? "agent"
            : integrations?.needsSetup
              ? "integrations"
              : afterIntegrations(apps),
        );
      })
      .catch(() => setStep("meet"));
  }, []);

  function afterIntegrations(apps: ConnectionCatalogItem[]) {
    return buildFeaturedConnectorTiles(apps).some((tile) => tile.item) ? "apps" : "meet";
  }

  async function createFirstBot() {
    if (createStartedRef.current || !botName.trim()) return;
    createStartedRef.current = true;
    setCreating(true);
    setError(null);
    try {
      const bot = await ensureFirstBot({ name: botName.trim(), color: `${botColor}::shape_0` });
      for (const serverId of integrationServers) {
        await rpc.mcp.assignments.approve({ botId: bot.id, serverId });
      }
      // Onboarding continues conversationally in the thread: greeting first,
      // then the focus choice (immediate for the first bot).
      const started = await rpc.onboarding
        .start({ botId: bot.id })
        .then(() => true)
        .catch(() => false);
      if (started) {
        await rpc.onboarding.promptFocus({ botId: bot.id }).catch(() => undefined);
      }
      navigate(`/app/${bot.id}`);
    } catch (err) {
      createStartedRef.current = false;
      setCreating(false);
      setError(err instanceof Error ? err.message : t`Could not create your bot`);
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-[720px]">
        {step === "loading" ? (
          <p className="text-center text-muted-foreground">
            <Trans>Loading…</Trans>
          </p>
        ) : null}
        {step === "agent" && agentStatus ? (
          <OnboardingAgentStep
            initialStatus={agentStatus}
            onContinue={() =>
              setStep(integrationSetup?.needsSetup ? "integrations" : afterIntegrations(catalog))
            }
          />
        ) : null}
        {step === "integrations" ? (
          <div className="mx-auto max-w-[560px]">
            <IntegrationSetup
              serverSetup
              initialState={integrationSetup}
              onDone={() => {
                // Server setup can turn on a catalog that was empty before.
                void rpc.connections
                  .catalog({})
                  .catch(() => [])
                  .then((apps) => {
                    setCatalog(apps);
                    setStep(afterIntegrations(apps));
                  });
              }}
              onServerConnected={(id) =>
                setIntegrationServers((current) => [...new Set([...current, id])])
              }
            />
          </div>
        ) : null}
        {step === "apps" ? (
          <OnboardingAppsStep catalog={catalog} onContinue={() => setStep("meet")} />
        ) : null}
        {step === "meet" ? (
          <form
            className="flex flex-col items-center gap-6"
            onSubmit={(event) => {
              event.preventDefault();
              void createFirstBot();
            }}
          >
            <BotAvatar color={`${botColor}::shape_0`} identity="first-bot" size={148} />
            <h1 className="text-center text-title font-semibold tracking-tight text-foreground">
              <Trans>Meet your first bot</Trans>
            </h1>
            <Input
              aria-label={t`Name`}
              value={botName}
              maxLength={BOT_NAME_MAX_LENGTH}
              onChange={(event) => setBotName(event.target.value)}
              className="h-12 w-full max-w-[320px] text-center text-[18px] font-medium md:text-[18px]"
            />
            <BotColorChoices value={botColor} onChange={setBotColor} className="justify-center" />
            {error ? (
              <p role="alert" className="text-small text-destructive">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              size="lg"
              className="mt-2 px-6"
              disabled={!botName.trim() || creating}
            >
              {creating ? <Trans>Opening chat…</Trans> : <Trans>Say hi</Trans>}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
