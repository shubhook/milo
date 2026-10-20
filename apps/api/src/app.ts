import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import type {
  AgentRuntime,
  JobPublisher,
  ManagedConnectorProvider,
  RealtimeFanout,
  SandboxProvider,
  TransactionalEmailProvider,
} from "@milo/adapter-kit";
import type {
  ChatGptPlanCredential,
  ChatGptSignInFlow,
  ComposioProvider,
  ConnectorRegistry,
  DestinationEmulator,
  RemoteConnectorDependencies,
} from "@milo/adapters";
import {
  ChatGptSignIn,
  CodexCatalogCache,
  ComposioConnector,
  chatGptHostId,
  createAgentRuntime,
  createBackgroundJobHandlers,
  createConnectorStack,
  createJobReconciler,
  createRunExecutor,
  createRunSandbox,
  createRunSecretWriter,
  createWebProvider,
  destroyBot,
  EmailEmulator,
  EncryptedSecretStore,
  ExpoPushProvider,
  GraphileJobPublisher,
  InMemoryJobQueue,
  InMemoryRealtimeFanout,
  InstalledConnectorProvider,
  IntegrationProviderSettings,
  isComposioEnabled,
  isPipedreamEnabled,
  LocalAgentHomeStore,
  LocalArtifactStore,
  McpConnector,
  McpOAuthBroker,
  PiOAuthLogins,
  PipedreamConnector,
  PostgresRealtimeFanout,
  pipedreamConfigFromEnv,
  piSessionsRoot,
  pushTokenPath,
  reconcileComputerUpdates,
  removePiUserSessions,
  SmtpEmailProvider,
} from "@milo/adapters";
import { createAuth, isBlockedAuthPath, isLoopbackOrigin, loopbackTwinOrigins } from "@milo/auth";
import { signupAllowlistBootUpdate, signupPolicyFromEnv } from "@milo/core";
import type { Pool, PrismaClient } from "@milo/db";
import {
  createDb,
  createPool,
  createThreadEvents,
  parsePositiveInteger,
  requireMembership,
} from "@milo/db";
import type { Logger } from "@milo/logging";
import {
  createServiceLogger,
  enrichLogContext,
  getLogger,
  installLogger,
  SERVICE_NAMES,
} from "@milo/logging";
import { requestLogging } from "@milo/logging/hono";
import { MarkdownMemoryStore } from "@milo/memory";
import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv } from "./env.js";
import { loadEnv } from "./env.js";
import { healthRoutes } from "./health.js";
import { mountLocalSettings } from "./local-settings.js";
import { mountApiRequestBodyLimits } from "./request-body-limit.js";
import type { RouterDeps } from "./router.js";
import { createRouter, saveChatGptPlan } from "./router.js";
import { mountScreenTarget } from "./screen-proxy.js";
import { mountWebhookHttpRoutes } from "./webhook.js";

/**
 * Native clients always send the app scheme, including in Expo Go, so no
 * exp:// origin is trusted: it would accept any Expo host as a redirect target.
 * The loopback entries are the Expo web dev server.
 */
export const MOBILE_AUTH_ORIGINS = [
  "rakazo://",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:19006",
  "http://127.0.0.1:19006",
];

export interface AppHandles {
  app: Hono;
  prisma: PrismaClient;
  jobs: JobPublisher;
  sandbox: SandboxProvider;
  connector: DestinationEmulator;
  composio?: ComposioProvider;
  connectors: ConnectorRegistry;
  email?: TransactionalEmailProvider;
  executor: ReturnType<typeof createRunExecutor>;
  runtime: AgentRuntime;
  stop: () => Promise<void>;
}

export async function createApp(
  overrides: Partial<AppEnv> & {
    prisma?: PrismaClient;
    realtime?: RealtimeFanout;
    sandbox?: SandboxProvider;
    composio?: ComposioProvider;
    pipedream?: ManagedConnectorProvider;
    email?: TransactionalEmailProvider;
    /** Replaces the OpenAI sign-in flow, for offline tests. */
    chatgpt?: ChatGptSignInFlow;
    remoteConnectors?: RemoteConnectorDependencies;
    logger?: Logger;
  } = {},
): Promise<AppHandles> {
  const {
    prisma: prismaOverride,
    realtime: realtimeOverride,
    sandbox: sandboxOverride,
    composio: composioOverride,
    pipedream: pipedreamOverride,
    email: emailOverride,
    chatgpt: chatgptOverride,
    remoteConnectors,
    logger: loggerOverride,
    ...envOverrides
  } = overrides;
  const env = { ...loadEnv(process.env), ...envOverrides };
  const logger = loggerOverride ?? createServiceLogger({ service: SERVICE_NAMES.api });
  installLogger(logger);
  const created = prismaOverride
    ? { prisma: prismaOverride, pool: undefined }
    : createDb(env.databaseUrl, {
        poolMax: parsePositiveInteger(process.env.DB_POOL_MAX, 4),
        applicationName: "rakazo-api",
      });
  const { prisma } = created;
  const realtime =
    realtimeOverride ??
    (created.pool
      ? new PostgresRealtimeFanout({
          connectionString: env.realtimeDatabaseUrl,
          publisher: created.pool,
        })
      : new InMemoryRealtimeFanout());
  const secrets = new EncryptedSecretStore(env.encryptionKey);
  const events = createThreadEvents(prisma, realtime, {
    runSecretWriter: createRunSecretWriter(secrets),
  });
  const environmentSignupPolicy = signupPolicyFromEnv(env);
  const deploymentSettings = await prisma.deploymentSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      signupsEnabled: environmentSignupPolicy.enabled,
      signupAllowlist: environmentSignupPolicy.allowlist.join(","),
      signupPolicyInitialized: true,
    },
    update: {},
  });
  if (!deploymentSettings.signupPolicyInitialized) {
    // Older versions created this row with schema defaults even though auth
    // still enforced the environment policy. Copy that effective policy once
    // so upgrades preserve behavior. Later starts reapply a non-empty
    // SIGNUP_ALLOWLIST; a blank value leaves the stored list alone.
    await prisma.deploymentSettings.updateMany({
      where: { id: "default", signupPolicyInitialized: false },
      data: {
        signupsEnabled: environmentSignupPolicy.enabled,
        signupAllowlist: environmentSignupPolicy.allowlist.join(","),
        signupPolicyInitialized: true,
      },
    });
  } else {
    const signupAllowlist = signupAllowlistBootUpdate(
      deploymentSettings.signupAllowlist,
      env.signupAllowlist,
      true,
    );
    if (signupAllowlist !== null) {
      await prisma.deploymentSettings.update({
        where: { id: "default" },
        data: { signupAllowlist },
      });
      logger.info("applied SIGNUP_ALLOWLIST from the environment");
    }
  }

  const jobKind = env.wakeupDriver;
  const inMemoryJobs = jobKind === "memory" ? new InMemoryJobQueue() : undefined;
  // prismaOverride skips createDb, so there is no shared pool. The previous
  // GraphileJobPublisher(databaseUrl) path opened its own connections; keep a
  // bounded pool for that override path instead of passing undefined.
  let ownedJobPool: Pool | undefined;
  if (!inMemoryJobs && !created.pool) {
    ownedJobPool = createPool(env.databaseUrl, {
      poolMax: parsePositiveInteger(process.env.DB_POOL_MAX, 4),
      applicationName: "rakazo-api-jobs",
    });
  }
  const jobPool = created.pool ?? ownedJobPool;
  const jobs = inMemoryJobs
    ? inMemoryJobs
    : new GraphileJobPublisher(
        jobPool ??
          (() => {
            throw new Error("Graphile job publisher requires a PostgreSQL pool");
          })(),
      );
  const sandbox: SandboxProvider =
    sandboxOverride ??
    createRunSandbox(env.sandboxProvider, {
      supervisorUrl: env.sandboxSupervisorUrl,
      supervisorToken: env.sandboxSupervisorToken,
      dataDir: env.dataDir,
      prisma,
    });
  const mcpOAuth = new McpOAuthBroker(
    prisma,
    secrets,
    remoteConnectors,
    env.mcpAllowPrivateEndpoint,
  );
  const oauthLogins = new PiOAuthLogins();
  const home = new LocalAgentHomeStore(env.dataDir);
  const artifacts = new LocalArtifactStore(env.dataDir);
  const memory = new MarkdownMemoryStore(prisma);
  const mcp = new McpConnector(
    prisma,
    secrets,
    {
      stdioEnabled: env.mcpStdioEnabled,
      allowedCommands: env.mcpStdioAllowedCommands,
      network: remoteConnectors,
      events,
      allowPrivateEndpoint: env.mcpAllowPrivateEndpoint,
    },
    mcpOAuth,
  );
  const pipedreamConfig = pipedreamConfigFromEnv(env);
  const pipedream =
    pipedreamOverride ??
    (isPipedreamEnabled(pipedreamConfig) ? new PipedreamConnector(pipedreamConfig) : undefined);
  const localEmailEmulator =
    !emailOverride && !env.smtpUrl && env.emailEmulator
      ? new EmailEmulator((message) => {
          getLogger().info("email emulator captured message", {
            "email.subject": message.subject,
          });
        })
      : undefined;
  if (localEmailEmulator && !isLoopbackHost(env.apiHost)) {
    throw new Error("EMAIL_EMULATOR requires API_HOST to be a loopback host");
  }
  const email: TransactionalEmailProvider | undefined =
    emailOverride ??
    (env.smtpUrl
      ? new SmtpEmailProvider({ url: env.smtpUrl, from: env.emailFrom ?? "" })
      : localEmailEmulator);
  const installed = new InstalledConnectorProvider(
    prisma,
    secrets,
    remoteConnectors,
    env.mcpAllowPrivateEndpoint,
  );
  const integrationSettings = new IntegrationProviderSettings(prisma, secrets, env.encryptionKey, {
    composio:
      composioOverride ??
      (isComposioEnabled(env.composioApiKey)
        ? new ComposioConnector(env.composioApiKey)
        : undefined),
    pipedream,
  });
  const stack = createConnectorStack(false, composioOverride, [
    installed,
    ...integrationSettings
      .providers()
      .filter((provider) => !composioOverride || provider.describe().id !== "composio"),
    mcp,
  ]);
  const connector = stack.destination;
  await connector.start();
  integrationSettings.warmDirectories();
  const runtime = createAgentRuntime(env.agentRuntime, {
    sessionRoot: env.piSessionRecording ? piSessionsRoot(env.dataDir) : undefined,
  });
  const notifications = new ExpoPushProvider(env.dataDir);
  // OpenAI only redirects Sign in with ChatGPT to 127.0.0.1, so the browser must share this
  // computer. In a container only the desktop app can catch that redirect for the server.
  const chatgptCapture = isLoopbackOrigin(env.webOrigin)
    ? existsSync("/.dockerenv")
      ? ("desktop" as const)
      : ("browser" as const)
    : null;
  const chatgpt: ChatGptSignInFlow | undefined = chatgptCapture
    ? (chatgptOverride ?? new ChatGptSignIn({ hostId: chatGptHostId(env.authSecret) }))
    : undefined;
  const auth = createAuth(prisma, {
    secret: env.authSecret,
    baseURL: env.authUrl,
    webOrigin: env.webOrigin,
    signupsEnabled: env.signupsEnabled,
    signupAllowlist: env.signupAllowlist,
    email,
    onEmailError: (error) => getLogger().error("transactional email delivery failed", error),
    extraOrigins: MOBILE_AUTH_ORIGINS,
    chatgpt: chatgpt && {
      start: (input) => chatgpt.start(input),
      complete: (flowId, callback) => chatgpt.complete(flowId, callback),
      savePlan: (userId, credential) =>
        saveChatGptPlan(routerDeps, userId, credential as ChatGptPlanCredential),
    },
    beforeDeleteUser: async (userId) => {
      const bots = await prisma.bot.findMany({
        where: { userId },
        select: { id: true, userId: true, spaceId: true, name: true, archivedAt: true },
      });
      await Promise.all(
        bots.map((bot) =>
          destroyBot(
            { prisma, sandbox, home, jobs, artifacts, dataDir: env.dataDir },
            bot,
            {
              operationId: `account-delete:${userId}`,
              traceId: `account-delete:${userId}`,
              spaceId: bot.spaceId,
              userId,
              botId: bot.id,
              signal: new AbortController().signal,
            },
            { deleteMemories: true },
          ),
        ),
      );
      await removePiUserSessions(env.dataDir, userId);
      await rm(pushTokenPath(env.dataDir, userId), { force: true }).catch(() => undefined);
    },
  });
  const shutdown = new AbortController();
  // One cache serves models.list, selection validation, and run-time model
  // resolution alike, so a list call warms the run path in this process.
  const codexCatalog = new CodexCatalogCache();
  const executor = createRunExecutor({
    prisma,
    runtime,
    codexCatalog,
    sandbox,
    memory,
    home,
    artifacts,
    connector: stack.connector,
    connectors: stack.connector,
    listConnectedPluginSlugs: async (userId) => {
      const provider = await integrationSettings.resolve("composio");
      if (!provider) return [];
      return provider.listConnectedExternalIds({
        userId,
        spaceId: "",
        operationId: "connections.sync",
        traceId: "connections.sync",
        signal: AbortSignal.timeout(15_000),
      });
    },
    secrets: [
      env.deploymentModelKey ?? "",
      env.composioApiKey ?? "",
      process.env.TYPESAFE_API_KEY ?? "",
    ].filter(Boolean),
    secretStore: secrets,
    secretHttp: remoteConnectors,
    mcpAllowPrivateEndpoint: env.mcpAllowPrivateEndpoint,
    deploymentModelKey: env.deploymentModelKey,
    dataDir: env.dataDir,
    notifications,
    jobs,
    events,
    web: createWebProvider(),
    shutdownSignal: shutdown.signal,
  });

  const jobHandlers = createBackgroundJobHandlers({
    executor,
    prisma,
    sandbox,
    home,
    jobs,
    events,
    workerId: "api",
    runtime,
    secretStore: secrets,
    deploymentModelKey: env.deploymentModelKey,
  });
  if (inMemoryJobs) {
    await inMemoryJobs.start(jobHandlers);
  }
  const reconciler = inMemoryJobs
    ? createJobReconciler({
        prisma,
        jobs,
        events,
        notifications,
        reconcileComputerUpdates: () => reconcileComputerUpdates({ prisma, jobs }),
      })
    : undefined;
  reconciler?.start();

  const routerDeps: RouterDeps = {
    codexCatalog,
    prisma,
    events,
    auth,
    jobs,
    sandbox,
    memory,
    home,
    secrets,
    oauthLogins,
    integrationSettings,
    mcpOAuth,
    composio: stack.composio,
    connectors: stack.connector,
    remoteConnectors,
    artifacts,
    dataDir: env.dataDir,
    env: {
      agentRuntime: env.agentRuntime,
      defaultProvider: env.defaultProvider,
      defaultModel: env.defaultModel,
      deploymentModelKey: env.deploymentModelKey,
      webOrigin: env.webOrigin,
      privacyPolicyUrl: env.privacyPolicyUrl,
      screenProxySecret: env.screenProxySecret,
      sandboxProvider: env.sandboxProvider,
      gitSha: env.gitSha,
      updaterUrl: env.updaterUrl,
      updaterToken: env.updaterToken,
      imageTag: env.imageTag,
      integrationsCatalogUrl: env.integrationsCatalogUrl,
      mcpAllowPrivateEndpoint: env.mcpAllowPrivateEndpoint,
    },
  };
  const router = createRouter(routerDeps);
  const rpc = new RPCHandler(router, {
    clientInterceptors: [onError((error, { path }) => logUnexpectedRpcError(error, path))],
  });
  const app = new Hono();
  app.use("*", requestLogging(logger));
  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) return env.webOrigin;
        return isTrustedOrigin(origin, env) ? origin : "";
      },
      credentials: true,
    }),
  );
  app.get("/api/auth/capabilities", (c) =>
    c.json({
      passwordReset: Boolean(email),
      resetUrl: email ? new URL("/reset-password", env.webOrigin).href : null,
      chatgpt: chatgptCapture,
    }),
  );
  if (localEmailEmulator && env.nodeEnv === "development") {
    app.get(
      "/api/dev/emails",
      () =>
        new Response(JSON.stringify(localEmailEmulator.sent), {
          headers: { "cache-control": "no-store", "content-type": "application/json" },
        }),
    );
  }
  mountApiRequestBodyLimits(app);
  mountScreenTarget(app, prisma, env.screenProxySecret);
  app.on(["GET", "POST"], "/api/auth/*", async (c) => {
    const path = new URL(c.req.url).pathname.replace("/api/auth", "");
    if (isBlockedAuthPath(path)) {
      return c.json({ error: "Not available in version 1" }, 404);
    }
    return auth.handler(c.req.raw);
  });
  mountLocalSettings(app, { token: env.desktopStackToken, prisma, rpc });
  app.use("/rpc/*", async (c, next) => {
    const session = await auth.api.getSession({ headers: sessionHeaders(c.req.raw) });
    const requestedSpaceId = c.req.header("x-rakazo-space-id");
    const actor = session?.user
      ? await requireMembership(prisma, session.user.id, requestedSpaceId).catch(() => null)
      : null;
    if (actor) {
      enrichLogContext({ "user.id": actor.userId, "space.id": actor.spaceId });
    }
    const { matched, response } = await rpc.handle(c.req.raw, {
      prefix: "/rpc",
      context: { actor, signal: c.req.raw.signal },
    });
    if (matched) return c.newResponse(response.body, response);
    await next();
  });
  mountWebhookHttpRoutes(app, { prisma, secrets, events, jobs });

  app.route(
    "/",
    healthRoutes(() => ({
      runtime: env.agentRuntime,
      sandbox: env.sandboxProvider,
      composio: Boolean(stack.composio),
      pipedream: Boolean(pipedream),
      email: email?.describe().id ?? null,
      jobs: jobKind,
      realtime: realtime.describe().id,
      revision: env.gitSha ?? null,
    })),
  );

  return {
    app,
    prisma,
    jobs,
    sandbox,
    connector,
    composio: stack.composio,
    connectors: stack.connector,
    email,
    executor,
    runtime,
    stop: async () => {
      // Abort in-flight continueRun boot waits before draining jobs so stop() cannot sit
      // on waitForComputerReady for the full boot-wait window during shared Postgres journeys.
      shutdown.abort();
      oauthLogins.abortAll();
      chatgpt?.cancelAll();
      await email?.drain?.();
      await reconciler?.stop();
      await jobs.close();
      await realtime.close();
      await connector.stop();
      await mcp.close();
      await prisma.$disconnect().catch(() => undefined);
      await created.pool?.end().catch(() => undefined);
      await ownedJobPool?.end().catch(() => undefined);
      await logger.flush({ timeoutMs: 2_000 });
    },
  };
}

export function isTrustedOrigin(
  origin: string,
  env: Pick<AppEnv, "webOrigin" | "apiUrl" | "authUrl">,
) {
  if (!origin) return true;
  if (origin.startsWith("rakazo://")) return true;
  const allowed = new Set(
    [env.webOrigin, env.apiUrl, env.authUrl, ...MOBILE_AUTH_ORIGINS].flatMap(originVariants),
  );
  return allowed.has(origin);
}

function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

function originVariants(origin: string): string[] {
  if (!origin || origin === "rakazo://") return [];
  const variants = [origin, ...loopbackTwinOrigins(origin)];
  try {
    const url = new URL(origin);
    if (url.protocol === "http:" || url.protocol === "https:") {
      variants.push(url.origin);
    }
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      const v6 = new URL(origin);
      v6.hostname = "[::1]";
      variants.push(v6.origin);
    }
  } catch {
    return variants;
  }
  return variants;
}

function sessionHeaders(request: Request) {
  const headers = new Headers(request.headers);
  const authz = headers.get("authorization");
  if (authz?.toLowerCase().startsWith("bearer ") && !headers.get("cookie")) {
    headers.set("cookie", `better-auth.session_token=${authz.slice(7).trim()}`);
  }
  return headers;
}

/**
 * An ORPCError is a decision the router made (BAD_REQUEST, UNAUTHORIZED, ...) and reaches the
 * caller intact. Everything else is flattened into an opaque "Internal server error", so
 * unless it is logged here the only record of what actually broke is gone.
 *
 * The cause chain matters as much as the message: undici and most SDKs report a bare
 * "fetch failed" and keep the host and errno one level down.
 */
export function logUnexpectedRpcError(error: unknown, path: readonly string[]): void {
  if (error instanceof ORPCError) return;
  const where = `rpc ${path.join("/")} failed`;
  getLogger().error(where, error);
}
