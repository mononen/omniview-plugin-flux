/** The plugin whose connections and resources Flux objects are served by. */
export const KUBERNETES_PLUGIN = 'kubernetes';

/** Path of the Flux page under the cluster view's `page/` routes. */
export const FLUX_PAGE_PATH = 'flux';

/** What the overview summarises: the things that deploy, then where they come from. */
export const OVERVIEW_GROUPS: Array<{ title: string; kinds: string[]; subPath?: string }> = [
  { title: 'Kustomizations', kinds: ['Kustomization'], subPath: 'kustomizations' },
  { title: 'HelmReleases', kinds: ['HelmRelease'], subPath: 'helmreleases' },
  { title: 'Sources', kinds: ['GitRepository', 'OCIRepository', 'HelmRepository', 'HelmChart', 'Bucket'] },
];

export const OVERVIEW_KINDS: string[] = OVERVIEW_GROUPS.flatMap((g) => g.kinds);

export const RECONCILE_ANNOTATION = 'reconcile.fluxcd.io/requestedAt';

/** Flux API groups, their kinds, and every served version we provide a panel for. */
const FLUX_APIS: Record<string, Record<string, string[]>> = {
  'kustomize.toolkit.fluxcd.io': {
    Kustomization: ['v1', 'v1beta2', 'v1beta1'],
  },
  'helm.toolkit.fluxcd.io': {
    HelmRelease: ['v2', 'v2beta2', 'v2beta1'],
  },
  'source.toolkit.fluxcd.io': {
    GitRepository: ['v1', 'v1beta2'],
    HelmRepository: ['v1', 'v1beta2'],
    HelmChart: ['v1', 'v1beta2'],
    OCIRepository: ['v1', 'v1beta2'],
    Bucket: ['v1', 'v1beta2'],
  },
  'notification.toolkit.fluxcd.io': {
    Alert: ['v1beta3'],
    Provider: ['v1beta3'],
    Receiver: ['v1', 'v1beta2'],
  },
  'image.toolkit.fluxcd.io': {
    ImageRepository: ['v1', 'v1beta2', 'v1beta1'],
    ImagePolicy: ['v1', 'v1beta2', 'v1beta1'],
    ImageUpdateAutomation: ['v1', 'v1beta2', 'v1beta1'],
  },
};

export const FLUX_RESOURCE_KEYS: string[] = Object.entries(FLUX_APIS).flatMap(([group, kinds]) =>
  Object.entries(kinds).flatMap(([kind, versions]) => versions.map((v) => `${group}::${v}::${kind}`)),
);

const groupOf = (kind: string): string | undefined =>
  Object.keys(FLUX_APIS).find((group) => kind in FLUX_APIS[group]);

/**
 * Pick the resource key the cluster actually serves for a Flux kind, preferring
 * the newest version. Returns undefined when the kind is not installed.
 */
export const resolveFluxKey = (
  available: Record<string, unknown> | undefined,
  kind: string,
): string | undefined => {
  const group = groupOf(kind);
  if (!group || !available) return undefined;
  return FLUX_APIS[group][kind].map((v) => `${group}::${v}::${kind}`).find((key) => key in available);
};

export type FluxCondition = {
  type: string;
  status: string;
  reason?: string;
  message?: string;
  lastTransitionTime?: string;
};

export type FluxObject = {
  apiVersion?: string;
  kind?: string;
  metadata?: {
    name?: string;
    namespace?: string;
    uid?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: Record<string, any>;
  status?: Record<string, any> & { conditions?: FluxCondition[] };
};

export type FluxState = 'ready' | 'failed' | 'stalled' | 'reconciling' | 'suspended' | 'unknown';

export const STATE_LABEL: Record<FluxState, string> = {
  ready: 'Ready',
  failed: 'Failed',
  stalled: 'Stalled',
  reconciling: 'Reconciling',
  suspended: 'Suspended',
  unknown: 'Unknown',
};

/**
 * Objects no controller reports status for: they are configuration other
 * objects read, so there is nothing to be ready or failed.
 */
export const isStatic = (obj: FluxObject): boolean =>
  !obj.status?.conditions?.length &&
  (obj.kind === 'Alert' || obj.kind === 'Provider' || (obj.kind === 'HelmRepository' && obj.spec?.type === 'oci'));

export const fluxState = (obj: FluxObject): FluxState => {
  if (obj.spec?.suspend) return 'suspended';
  if (isStatic(obj)) return 'ready';
  const conditions = obj.status?.conditions ?? [];
  const is = (type: string, status: string) => conditions.some((c) => c.type === type && c.status === status);
  if (is('Stalled', 'True')) return 'stalled';
  if (is('Ready', 'True')) return 'ready';
  // A failed object that is being retried reports Reconciling too; it is still failing.
  if (is('Ready', 'False')) return 'failed';
  if (is('Reconciling', 'True') || is('Ready', 'Unknown')) return 'reconciling';
  return 'unknown';
};

export const readyCondition = (obj: FluxObject): FluxCondition | undefined =>
  obj.status?.conditions?.find((c) => c.type === 'Ready');

/** The revision Flux last applied (or, for sources, last fetched). */
export const fluxRevision = (obj: FluxObject): string | undefined =>
  obj.status?.lastAppliedRevision ?? obj.status?.artifact?.revision ?? obj.status?.lastAttemptedRevision;

export type SourceRef = { kind: string; name: string; namespace: string };

/** The source a Kustomization or HelmRelease pulls from, if it declares one. */
export const sourceRefOf = (obj: FluxObject): SourceRef | undefined => {
  const ref = obj.spec?.sourceRef ?? obj.spec?.chartRef ?? obj.spec?.chart?.spec?.sourceRef;
  if (!ref?.kind || !ref?.name) return undefined;
  return { kind: ref.kind, name: ref.name, namespace: ref.namespace ?? obj.metadata?.namespace ?? '' };
};

/** Copy of the object asking its controller to reconcile it now. */
export const withReconcileRequest = <T extends FluxObject>(obj: T): T => ({
  ...obj,
  metadata: {
    ...obj.metadata,
    annotations: { ...obj.metadata?.annotations, [RECONCILE_ANNOTATION]: new Date().toISOString() },
  },
});

export const withSuspend = <T extends FluxObject>(obj: T, suspend: boolean): T => ({
  ...obj,
  spec: { ...obj.spec, suspend },
});

/** Only reconcilers that honour spec.suspend get suspend/resume controls. */
export const isSuspendable = (obj: FluxObject): boolean =>
  !['Alert', 'Provider', 'ImagePolicy'].includes(obj.kind ?? '');

export const shortRevision = (rev: string): string => {
  const at = rev.lastIndexOf(':');
  const prefix = at >= 0 ? rev.slice(0, at + 1) : '';
  const hash = at >= 0 ? rev.slice(at + 1) : rev;
  return hash.length > 12 ? `${prefix}${hash.slice(0, 12)}` : rev;
};

/** Kinds outside Flux that Flux objects commonly point at. */
const CORE_KEYS: Record<string, string> = {
  Secret: 'core::v1::Secret',
  ConfigMap: 'core::v1::ConfigMap',
  ServiceAccount: 'core::v1::ServiceAccount',
};

/** Resource key for a referenced kind, Flux or core, if the cluster serves it. */
export const resolveRefKey = (available: Record<string, unknown> | undefined, kind: string): string | undefined =>
  resolveFluxKey(available, kind) ?? (available && CORE_KEYS[kind] in available ? CORE_KEYS[kind] : undefined);

export const formatBytes = (bytes?: number): string | undefined => {
  if (bytes === undefined) return undefined;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
};

export const timeAgo = (iso?: string): string => {
  if (!iso) return '';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};
