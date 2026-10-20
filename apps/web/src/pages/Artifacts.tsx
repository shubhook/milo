import { Trans, useLingui } from "@lingui/react/macro";
import { ChatMarkdown } from "@milo/chat-ui/web";
import type { Artifact, ArtifactVersion, Bot } from "@milo/contracts";
import { isAttachmentImageMimeType } from "@milo/contracts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  BotAvatar,
  Button,
  buttonVariants,
  cn,
  Input,
  NativeSelect,
  NativeSelectOption,
} from "@milo/ui-web";
import {
  Download,
  LayoutGrid,
  List,
  Lock,
  Maximize2,
  MessageSquare,
  Minimize2,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Shimmer } from "../components/ai/primitives";
import { PdfViewer } from "../components/PdfViewer";
import { SandboxedHtmlViewer } from "../components/SandboxedHtmlViewer";
import { SegmentedControl } from "../components/SegmentedControl";
import { decodeArtifactBase64, downloadArtifactBytes } from "../lib/artifact-open";
import { takeInitialBootstrap } from "../lib/bootstrap";
import { formatRelativeTime } from "../lib/relative-time";
import { rpc } from "../lib/rpc";
import { useObjectUrl } from "../lib/use-object-url";

type ViewMode = "grid" | "list";
type DateFilter = "all" | "today" | "week" | "month";
const VIEW_MODE_STORAGE_KEY = "rakazo:artifacts-view-mode";
const LIST_PAGE_SIZE = 60;

type ArtifactSummary = Artifact & { versionCount: number };

function readViewMode(): ViewMode {
  try {
    return window.localStorage.getItem(VIEW_MODE_STORAGE_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

function writeViewMode(mode: ViewMode): void {
  try {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    // Preference only; ignore storage failures.
  }
}

function matchesCalendarDateFilter(iso: string, filter: DateFilter, now: Date): boolean {
  if (filter === "all") return true;
  const date = new Date(iso);
  if (filter === "today") return date.toDateString() === now.toDateString();
  if (filter === "week") {
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    return date >= startOfWeek;
  }
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function ArtifactsPage() {
  const { artifactId } = useParams<{ artifactId?: string }>();
  const navigate = useNavigate();
  const { t } = useLingui();
  const [bots, setBots] = useState<Bot[]>([]);
  const [items, setItems] = useState<ArtifactSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const listingGenerationRef = useRef(0);
  const [activeBotId, setActiveBotId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(readViewMode);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [maximized, setMaximized] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ArtifactSummary | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    void takeInitialBootstrap().then((bootstrap) => setBots(bootstrap.bots));
  }, []);

  useEffect(() => {
    let cancelled = false;
    listingGenerationRef.current += 1;
    loadingMoreRef.current = false;
    setLoadingMore(false);
    setItems(null);
    setLoadError(null);
    setNextCursor(null);
    void rpc.artifacts
      .listSpace({ botId: activeBotId ?? undefined, limit: LIST_PAGE_SIZE })
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : t`Could not load artifacts.`);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeBotId, t]);

  async function loadMore() {
    if (!nextCursor || loadingMoreRef.current) return;
    const generation = listingGenerationRef.current;
    const listingChanged = () => generation !== listingGenerationRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await rpc.artifacts.listSpace({
        botId: activeBotId ?? undefined,
        cursor: nextCursor,
        limit: LIST_PAGE_SIZE,
      });
      if (listingChanged()) return;
      setItems((current) => (current ?? []).concat(page.items));
      setNextCursor(page.nextCursor);
    } catch {
      // Keep the current page so Load more can be retried.
    } finally {
      if (!listingChanged()) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }

  useEffect(() => {
    setMaximized(false);
  }, [artifactId]);

  const botsById = useMemo(() => new Map(bots.map((bot) => [bot.id, bot])), [bots]);

  const filteredItems = useMemo(() => {
    if (!items) return null;
    const now = new Date();
    const query = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (!matchesCalendarDateFilter(item.createdAt, dateFilter, now)) return false;
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) ||
        (item.description?.toLowerCase().includes(query) ?? false)
      );
    });
  }, [items, searchQuery, dateFilter]);

  const clientFilterActive = searchQuery.trim().length > 0 || dateFilter !== "all";
  const autoFetchedCursorRef = useRef<string | null>(null);

  useEffect(() => {
    autoFetchedCursorRef.current = null;
  }, [searchQuery, dateFilter, activeBotId]);

  // Search and date filters only see loaded pages, so keep paging until something matches.
  useEffect(() => {
    if (!clientFilterActive || !nextCursor || loadingMore || items === null) return;
    if (filteredItems && filteredItems.length > 0) return;
    if (autoFetchedCursorRef.current === nextCursor) return;
    autoFetchedCursorRef.current = nextCursor;
    void loadMore();
  }, [clientFilterActive, nextCursor, loadingMore, items, filteredItems]);

  function setMode(mode: ViewMode) {
    setViewMode(mode);
    writeViewMode(mode);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await rpc.artifacts.remove({ artifactId: pendingDelete.id });
      setItems((current) => current?.filter((item) => item.id !== pendingDelete.id) ?? current);
      if (artifactId === pendingDelete.id) navigate("/app/artifacts");
      setPendingDelete(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : t`Could not delete this artifact.`);
    } finally {
      setDeleteBusy(false);
    }
  }

  const openSummary = artifactId ? (items?.find((item) => item.id === artifactId) ?? null) : null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {!maximized || !artifactId ? (
          <main className="rk-scroll min-h-0 min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-4 pt-[18px] pb-10 md:px-7">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="min-w-[120px] flex-1 text-section font-semibold">
                  <Trans>Artifacts</Trans>
                </h1>
                <div className="relative min-w-[200px] max-w-[360px] flex-1">
                  <Search
                    size={16}
                    strokeWidth={1.9}
                    aria-hidden="true"
                    className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={t`Search artifacts…`}
                    aria-label={t`Search artifacts…`}
                    className="h-[38px] rounded-full bg-card ps-9 pe-3.5"
                  />
                </div>
                <SegmentedControl
                  label={t`View`}
                  value={viewMode}
                  onChange={setMode}
                  options={[
                    {
                      value: "grid",
                      label: t`Card view`,
                      icon: <LayoutGrid size={15} strokeWidth={1.9} />,
                    },
                    {
                      value: "list",
                      label: t`List view`,
                      icon: <List size={15} strokeWidth={1.9} />,
                    },
                  ]}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <FilterChip active={activeBotId === null} onClick={() => setActiveBotId(null)}>
                  <Trans>All bots</Trans>
                </FilterChip>
                {bots.map((bot) => (
                  <FilterChip
                    key={bot.id}
                    active={activeBotId === bot.id}
                    onClick={() => setActiveBotId(bot.id)}
                    className="ps-1.5"
                  >
                    <BotAvatar color={bot.color} identity={bot.id} size={20} />
                    <span className="max-w-[120px] truncate">{bot.name}</span>
                  </FilterChip>
                ))}
                <span className="flex-1" />
                <NativeSelect
                  aria-label={t`Filter by date`}
                  className="w-auto text-small [&>select]:rounded-full [&>select]:bg-card [&>select]:ps-3"
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value as DateFilter)}
                >
                  <NativeSelectOption value="all">{t`All time`}</NativeSelectOption>
                  <NativeSelectOption value="today">{t`Today`}</NativeSelectOption>
                  <NativeSelectOption value="week">{t`This week`}</NativeSelectOption>
                  <NativeSelectOption value="month">{t`This month`}</NativeSelectOption>
                </NativeSelect>
              </div>

              <BrowsingPane
                items={filteredItems}
                loadError={loadError}
                viewMode={viewMode}
                botsById={botsById}
                selectedId={artifactId ?? null}
                nextCursor={nextCursor}
                loadingMore={loadingMore}
                onLoadMore={() => void loadMore()}
              />
            </div>
          </main>
        ) : null}
        {artifactId ? (
          <PreviewPane
            key={artifactId}
            artifactId={artifactId}
            summary={openSummary}
            bot={openSummary?.botId ? botsById.get(openSummary.botId) : undefined}
            maximized={maximized}
            onToggleMaximize={() => setMaximized((value) => !value)}
            onRequestDelete={setPendingDelete}
            onClose={() => navigate("/app/artifacts")}
          />
        ) : null}
      </div>

      {pendingDelete ? (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open && !deleteBusy) setPendingDelete(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                <Trans>Delete "{pendingDelete.name}"?</Trans>
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingDelete.versionCount > 1 ? (
                  <Trans>
                    This deletes all {pendingDelete.versionCount} versions of this artifact. This
                    can't be undone.
                  </Trans>
                ) : (
                  <Trans>This can't be undone.</Trans>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteError ? <p className="text-small text-destructive">{deleteError}</p> : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteBusy}>
                <Trans>Cancel</Trans>
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={deleteBusy}
                onClick={() => void confirmDelete()}
              >
                {deleteBusy ? <Trans>Deleting…</Trans> : <Trans>Delete</Trans>}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}

function BrowsingPane({
  items,
  loadError,
  viewMode,
  botsById,
  selectedId,
  nextCursor,
  loadingMore,
  onLoadMore,
}: {
  items: ArtifactSummary[] | null;
  loadError: string | null;
  viewMode: ViewMode;
  botsById: Map<string, Bot>;
  selectedId: string | null;
  nextCursor: string | null;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const emptyClass = "py-16 text-center text-muted-foreground";
  if (items === null) {
    return <div className={emptyClass}>{loadError ?? <Trans>Loading…</Trans>}</div>;
  }
  if (items.length === 0) {
    return (
      <EmptyArtifacts
        className={emptyClass}
        nextCursor={nextCursor}
        loadingMore={loadingMore}
        onLoadMore={onLoadMore}
      />
    );
  }
  return (
    <>
      {viewMode === "grid" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
          {items.map((item) => (
            <ArtifactCard
              key={item.id}
              artifact={item}
              bot={item.botId ? botsById.get(item.botId) : undefined}
              selected={item.id === selectedId}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="text-start text-[12.5px] text-muted-foreground">
                <th className="px-4 py-2.5 text-start font-medium">
                  <Trans>Name</Trans>
                </th>
                <th className="px-2 py-2.5 text-start font-medium">
                  <Trans>Bot</Trans>
                </th>
                <th className="px-2 py-2.5 text-start font-medium">
                  <Trans>Type</Trans>
                </th>
                <th className="px-4 py-2.5 text-start font-medium">
                  <Trans>Updated</Trans>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <ArtifactRow
                  key={item.id}
                  artifact={item}
                  bot={item.botId ? botsById.get(item.botId) : undefined}
                  selected={item.id === selectedId}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {nextCursor ? <LoadMoreButton loading={loadingMore} onClick={onLoadMore} /> : null}
    </>
  );
}

function LoadMoreButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <div className="flex justify-center">
      <Button variant="outline" disabled={loading} onClick={onClick}>
        {loading ? <Trans>Loading…</Trans> : <Trans>Load more</Trans>}
      </Button>
    </div>
  );
}

function EmptyArtifacts({
  className,
  nextCursor,
  loadingMore,
  onLoadMore,
}: {
  className: string;
  nextCursor: string | null;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  if (!nextCursor) {
    return (
      <div className={className}>
        <Trans>No artifacts found.</Trans>
      </div>
    );
  }
  return (
    <div className={cn(className, "flex flex-col items-center gap-3")}>
      <span>
        {loadingMore ? <Trans>Loading…</Trans> : <Trans>No matching artifacts on this page.</Trans>}
      </span>
      <LoadMoreButton loading={loadingMore} onClick={onLoadMore} />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  className,
  children,
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Button
      variant="outline"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-8 gap-1.5 px-3 font-normal",
        active && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        className,
      )}
    >
      {children}
    </Button>
  );
}

type ArtifactKind = "doc" | "sheet" | "html" | "image";

const SHEET_MIME_TYPES = new Set([
  "text/csv",
  "text/tab-separated-values",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function artifactKind(mimeType: string): ArtifactKind {
  if (mimeType === "text/html") return "html";
  if (isAttachmentImageMimeType(mimeType)) return "image";
  if (SHEET_MIME_TYPES.has(mimeType)) return "sheet";
  return "doc";
}

const previewLineClass = "h-1.5 rounded-full bg-border";

/** A drawing of the file's type; cards never fetch content. */
function ArtifactThumbnail({ mimeType }: { mimeType: string }) {
  const kind = artifactKind(mimeType);
  if (kind === "image") {
    return (
      <div className="grid w-full grid-cols-3 content-center gap-1.5 p-3.5">
        <div className="aspect-video rounded-md bg-foreground/80" />
        <div className="aspect-video rounded-md bg-foreground/40" />
        <div className="aspect-video rounded-md bg-foreground/15" />
      </div>
    );
  }
  if (kind === "sheet") {
    return (
      <div className="m-3.5 grid flex-1 grid-cols-4 gap-px overflow-hidden rounded-md bg-border p-px shadow-raised">
        {Array.from({ length: 16 }, (_, index) => (
          <div key={index} className={cn("h-[18px]", index < 4 ? "bg-muted" : "bg-card")} />
        ))}
      </div>
    );
  }
  if (kind === "html") {
    return (
      <div className="mx-3.5 mt-3.5 flex flex-1 flex-col overflow-hidden rounded-t-lg bg-card shadow-raised">
        <div className="flex h-3.5 items-center gap-[3px] bg-muted ps-1.5">
          <span className="size-[5px] rounded-full bg-border" />
          <span className="size-[5px] rounded-full bg-border" />
        </div>
        <div className="flex flex-col items-center gap-1.5 p-3">
          <div className="h-[9px] w-1/2 rounded-full bg-foreground/70" />
          <div className={cn(previewLineClass, "w-[70%]")} />
          <div className="mt-1 h-3.5 w-11 rounded-full bg-foreground" />
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto mt-3.5 flex w-[64%] flex-col gap-[7px] rounded-t-md bg-card p-3.5 shadow-raised">
      <div className="h-2 w-[60%] rounded-full bg-foreground/70" />
      <div className={previewLineClass} />
      <div className={previewLineClass} />
      <div className={cn(previewLineClass, "w-[80%]")} />
      <div className={cn(previewLineClass, "w-[40%] bg-muted")} />
      <div className={previewLineClass} />
    </div>
  );
}

function ArtifactCard({
  artifact,
  bot,
  selected,
}: {
  artifact: ArtifactSummary;
  bot: Bot | undefined;
  selected: boolean;
}) {
  return (
    <Link
      to={`/app/artifacts/${artifact.id}`}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "flex flex-col overflow-hidden rounded-[18px] border border-border bg-card text-foreground transition-[box-shadow,translate] hover:-translate-y-px hover:shadow-raised",
        selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
      )}
    >
      <div className="relative flex aspect-[16/10] overflow-hidden bg-muted">
        <ArtifactThumbnail mimeType={artifact.mimeType} />
        <span className="absolute start-2.5 top-2.5 flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {mimeLabel(artifact.mimeType)}
          {artifact.versionCount > 1 ? <span>{`· v${artifact.version}`}</span> : null}
        </span>
      </div>
      <div className="flex flex-col gap-1 px-3.5 py-3">
        <span className="truncate font-medium">{artifact.name}</span>
        <ArtifactByline bot={bot} createdAt={artifact.createdAt} />
      </div>
    </Link>
  );
}

function ArtifactByline({ bot, createdAt }: { bot: Bot | undefined; createdAt: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted-foreground">
      {bot ? (
        <>
          <BotAvatar color={bot.color} identity={bot.id} size={16} />
          <span className="min-w-0 truncate">{bot.name}</span>
          <span aria-hidden="true">·</span>
        </>
      ) : null}
      <span className="shrink-0">{formatRelativeTime(createdAt)}</span>
    </span>
  );
}

function ArtifactRow({
  artifact,
  bot,
  selected,
}: {
  artifact: ArtifactSummary;
  bot: Bot | undefined;
  selected: boolean;
}) {
  return (
    <tr className={cn("border-t border-border", selected ? "bg-muted" : "hover:bg-foreground/5")}>
      <td className="px-4">
        <Link
          to={`/app/artifacts/${artifact.id}`}
          aria-current={selected ? "page" : undefined}
          className="block py-3 font-medium"
        >
          {artifact.name}
        </Link>
      </td>
      <td className="px-2">
        {bot ? (
          <span className="inline-flex items-center gap-1.5">
            <BotAvatar color={bot.color} identity={bot.id} size={18} />
            {bot.name}
          </span>
        ) : null}
      </td>
      <td className="px-2 text-muted-foreground">{mimeLabel(artifact.mimeType)}</td>
      <td className="px-4 text-muted-foreground">{formatRelativeTime(artifact.createdAt)}</td>
    </tr>
  );
}

function mimeLabel(mimeType: string): string {
  if (mimeType === "text/html") return "HTML";
  if (mimeType === "text/markdown") return "MD";
  if (mimeType === "application/pdf") return "PDF";
  const slash = mimeType.indexOf("/");
  return (slash === -1 ? mimeType : mimeType.slice(slash + 1)).toUpperCase().slice(0, 6);
}

function PreviewPane({
  artifactId,
  summary,
  bot,
  maximized,
  onToggleMaximize,
  onRequestDelete,
  onClose,
}: {
  artifactId: string;
  summary: ArtifactSummary | null;
  bot: Bot | undefined;
  maximized: boolean;
  onToggleMaximize: () => void;
  onRequestDelete: (artifact: ArtifactSummary) => void;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const [versions, setVersions] = useState<ArtifactVersion[] | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready"; artifact: Artifact; bytes: Uint8Array }
    | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setVersions(null);
    setSelectedVersionId(null);
    void rpc.artifacts
      .listVersions({ familyId: artifactId })
      .then((list) => {
        if (cancelled) return;
        setVersions(list);
        setSelectedVersionId(list[0]?.id ?? artifactId);
      })
      .catch(() => {
        if (!cancelled) setSelectedVersionId(artifactId);
      });
    return () => {
      cancelled = true;
    };
  }, [artifactId]);

  useEffect(() => {
    if (!selectedVersionId) return;
    let cancelled = false;
    setState({ status: "loading" });
    void rpc.artifacts
      .getById({ artifactId: selectedVersionId })
      .then((artifact) => {
        if (!cancelled) {
          setState({
            status: "ready",
            artifact,
            bytes: decodeArtifactBase64(artifact.contentBase64),
          });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : t`Could not load this artifact.`,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedVersionId, t]);

  const ready = state.status === "ready" ? state : null;
  const name = ready?.artifact.name ?? summary?.name ?? null;

  return (
    <aside
      aria-label={name ?? undefined}
      className={cn(
        "flex min-w-0 flex-col bg-card max-md:absolute max-md:inset-0 max-md:z-10",
        maximized ? "flex-1" : "md:w-[min(560px,55%)] md:flex-none md:border-s md:border-border",
      )}
    >
      <header className="flex items-center gap-1.5 border-b border-border py-3 ps-[18px] pe-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate font-semibold">{name ?? t`Loading…`}</h2>
          {ready ? <ArtifactByline bot={bot} createdAt={ready.artifact.createdAt} /> : null}
        </div>
        {versions && versions.length > 1 && selectedVersionId ? (
          <NativeSelect
            aria-label={t`Version`}
            className="w-auto shrink-0 text-small [&>select]:rounded-full [&>select]:ps-3"
            value={selectedVersionId}
            onChange={(event) => setSelectedVersionId(event.target.value)}
          >
            {versions.map((entry) => (
              <NativeSelectOption key={entry.id} value={entry.id}>
                {`v${entry.version} · ${formatRelativeTime(entry.createdAt)}`}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : null}
        {ready ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t`Download`}
              title={t`Download`}
              onClick={() =>
                downloadArtifactBytes(ready.artifact.name, ready.artifact.mimeType, ready.bytes)
              }
            >
              <Download size={16} strokeWidth={1.9} />
            </Button>
            {ready.artifact.botId ? (
              <Link
                to={`/app/${ready.artifact.botId}`}
                aria-label={t`View chat`}
                title={t`View chat`}
                className={buttonVariants({ variant: "ghost", size: "icon" })}
              >
                <MessageSquare size={16} strokeWidth={1.9} />
              </Link>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              aria-label={maximized ? t`Show list` : t`Maximize`}
              title={maximized ? t`Show list` : t`Maximize`}
              onClick={onToggleMaximize}
              className="max-md:hidden"
            >
              {maximized ? (
                <Minimize2 size={16} strokeWidth={1.9} />
              ) : (
                <Maximize2 size={16} strokeWidth={1.9} />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t`Delete ${ready.artifact.name}`}
              title={t`Delete ${ready.artifact.name}`}
              onClick={() =>
                onRequestDelete(
                  summary ?? { ...ready.artifact, versionCount: versions?.length ?? 1 },
                )
              }
            >
              <Trash2 size={16} strokeWidth={1.9} />
            </Button>
          </>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          aria-label={t`Close`}
          title={t`Close`}
          onClick={onClose}
        >
          <X size={16} strokeWidth={1.9} />
        </Button>
      </header>

      <div className="min-h-0 flex-1 bg-background p-5">
        {state.status === "loading" ? (
          <div className="grid h-full place-items-center">
            <Shimmer>
              <Trans>Loading…</Trans>
            </Shimmer>
          </div>
        ) : state.status === "error" ? (
          <div className="rounded-xl bg-destructive-surface px-4 py-3 text-destructive">
            {state.message}
          </div>
        ) : (
          <div className="relative h-full overflow-hidden rounded-xl border border-border bg-card">
            <ArtifactPreview artifact={state.artifact} bytes={state.bytes} />
            {state.artifact.mimeType === "text/html" ? (
              <div className="absolute bottom-3 end-3 flex items-center gap-1.5 rounded-full bg-foreground/80 px-2.5 py-1.5 text-[11px] text-background">
                <Lock size={12} strokeWidth={2} />
                <span>
                  <Trans>Isolated preview — no access to your account</Trans>
                </span>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}

function ArtifactPreview({ artifact, bytes }: { artifact: Artifact; bytes: Uint8Array }) {
  if (artifact.mimeType === "text/html") {
    const html = new TextDecoder("utf-8").decode(bytes);
    return <SandboxedHtmlViewer html={html} title={artifact.name} />;
  }
  if (artifact.mimeType === "text/markdown") {
    const text = new TextDecoder("utf-8").decode(bytes);
    return (
      <div className="h-full overflow-y-auto bg-background">
        <article className="mx-auto w-full max-w-[760px] px-8 py-10 text-[16px] leading-7 text-foreground">
          <ChatMarkdown>{text}</ChatMarkdown>
        </article>
      </div>
    );
  }
  if (artifact.mimeType === "application/pdf") {
    return <PdfViewer bytes={bytes} title={artifact.name} />;
  }
  if (isAttachmentImageMimeType(artifact.mimeType)) {
    return <ImagePreview bytes={bytes} mimeType={artifact.mimeType} name={artifact.name} />;
  }
  return (
    <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground/80">
      <Trans>Preview isn't available for this file type — download it to view it.</Trans>
    </div>
  );
}

function ImagePreview({
  bytes,
  mimeType,
  name,
}: {
  bytes: Uint8Array;
  mimeType: string;
  name: string;
}) {
  const url = useObjectUrl(bytes, mimeType);
  if (!url) return null;
  return (
    <div className="grid h-full place-items-center overflow-auto bg-muted/40 p-4">
      <img src={url} alt={name} className="max-h-full max-w-full rounded-lg shadow-sm" />
    </div>
  );
}
