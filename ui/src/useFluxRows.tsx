import React from 'react';
import { useResources, useResourceTypes } from '@omniviewdev/runtime';

import { KUBERNETES_PLUGIN, fluxState, resolveFluxKey, type FluxObject, type FluxState } from './flux';

/** Worst first, so the things that need attention sit at the top. */
const STATE_ORDER: FluxState[] = ['failed', 'stalled', 'reconciling', 'unknown', 'suspended', 'ready'];

export type Row = { resourceKey: string; kind: string; object: FluxObject; state: FluxState };

/**
 * Watches the given Flux kinds on a connection and returns their objects,
 * worst state first. `loaders` must be rendered: each one subscribes to a
 * resource type the cluster serves.
 */
export const useFluxRows = (connectionID: string, kinds: string[]) => {
  const { types } = useResourceTypes({ pluginID: KUBERNETES_PLUGIN, connectionID });
  const [objectsByKind, setObjectsByKind] = React.useState<Record<string, FluxObject[]>>({});

  const served = kinds
    .map((kind) => ({ kind, resourceKey: resolveFluxKey(types.data, kind) }))
    .filter((k): k is { kind: string; resourceKey: string } => !!k.resourceKey);

  const onObjects = React.useCallback((kind: string, objects: FluxObject[]) => {
    setObjectsByKind((prev) => ({ ...prev, [kind]: objects }));
  }, []);

  const rows: Row[] = served
    .flatMap(({ kind, resourceKey }) =>
      (objectsByKind[kind] ?? []).map((object) => ({ resourceKey, kind, object, state: fluxState(object) })),
    )
    .sort(
      (a, b) =>
        STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state) ||
        a.kind.localeCompare(b.kind) ||
        (a.object.metadata?.namespace ?? '').localeCompare(b.object.metadata?.namespace ?? '') ||
        (a.object.metadata?.name ?? '').localeCompare(b.object.metadata?.name ?? ''),
    );

  const loaders = served.map(({ kind, resourceKey }) => (
    <KindLoader key={resourceKey} kind={kind} resourceKey={resourceKey} connectionID={connectionID} onObjects={onObjects} />
  ));

  return { loading: types.isLoading, installed: served.length > 0, rows, loaders };
};

type KindLoaderProps = {
  kind: string;
  resourceKey: string;
  connectionID: string;
  onObjects: (kind: string, objects: FluxObject[]) => void;
};

/** Subscribes to one resource type and reports its objects up; renders nothing. */
const KindLoader: React.FC<KindLoaderProps> = ({ kind, resourceKey, connectionID, onObjects }) => {
  const { resources } = useResources({
    pluginID: KUBERNETES_PLUGIN,
    connectionID,
    resourceKey,
    idAccessor: 'metadata.uid',
  });
  const result = resources.data?.result;

  React.useEffect(() => {
    onObjects(kind, (result ?? []) as FluxObject[]);
  }, [kind, result, onObjects]);

  return null;
};

/** Tallies rows into the buckets the overview and the dashboard widget show. */
export const countStates = (rows: Row[]) => {
  const count = (...states: FluxState[]) => rows.filter((row) => states.includes(row.state)).length;
  return {
    total: rows.length,
    ready: count('ready'),
    failing: count('failed', 'stalled'),
    pending: count('reconciling', 'unknown'),
    suspended: count('suspended'),
  };
};
