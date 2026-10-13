import React from 'react';
// The host shares the @mui/material root; deep imports would bundle a second copy.
import { Box, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useResources, useResourceTypes, useRightDrawer } from '@omniviewdev/runtime';

import FluxActions from './FluxActions';
import {
  KUBERNETES_PLUGIN,
  fluxRevision,
  fluxState,
  readyCondition,
  resolveFluxKey,
  shortRevision,
  timeAgo,
  type FluxObject,
  type FluxState,
} from '../flux';

type Props = {
  pluginID: string;
  connectionID: string;
};

/** The kinds that actually deploy things; sources are reachable from their rows. */
const WORKLOAD_KINDS = ['Kustomization', 'HelmRelease'] as const;

const STATE_LABEL: Record<FluxState, string> = {
  ready: 'Ready',
  failed: 'Failed',
  stalled: 'Stalled',
  reconciling: 'Reconciling',
  suspended: 'Suspended',
  unknown: 'Unknown',
};

const STATE_COLOR: Record<FluxState, 'success' | 'error' | 'info' | 'warning' | 'default'> = {
  ready: 'success',
  failed: 'error',
  stalled: 'error',
  reconciling: 'info',
  suspended: 'warning',
  unknown: 'default',
};

/** Worst first, so the things that need attention sit at the top. */
const STATE_ORDER: FluxState[] = ['failed', 'stalled', 'reconciling', 'unknown', 'suspended', 'ready'];

type Row = { resourceKey: string; kind: string; object: FluxObject };

const centeredSx = { p: 4, width: '100%', textAlign: 'center' } as const;

const GitOpsPage: React.FC<Props> = ({ connectionID }) => {
  const { types } = useResourceTypes({ pluginID: KUBERNETES_PLUGIN, connectionID });
  const [rowsByKind, setRowsByKind] = React.useState<Record<string, Row[]>>({});
  const [showAll, setShowAll] = React.useState(false);

  const kinds = WORKLOAD_KINDS.map((kind) => ({ kind, resourceKey: resolveFluxKey(types.data, kind) })).filter(
    (k): k is { kind: (typeof WORKLOAD_KINDS)[number]; resourceKey: string } => !!k.resourceKey,
  );

  const onRows = React.useCallback((kind: string, rows: Row[]) => {
    setRowsByKind((prev) => ({ ...prev, [kind]: rows }));
  }, []);

  if (types.isLoading) {
    return <Typography color="text.secondary" sx={centeredSx}>Loading…</Typography>;
  }

  if (kinds.length === 0) {
    return (
      <Typography color="text.secondary" sx={centeredSx}>
        Flux is not installed on this cluster (no Kustomization or HelmRelease resource types found).
      </Typography>
    );
  }

  const all = kinds
    .flatMap(({ kind }) => rowsByKind[kind] ?? [])
    .map((row) => ({ ...row, state: fluxState(row.object) }))
    .sort(
      (a, b) =>
        STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state) ||
        (a.object.metadata?.namespace ?? '').localeCompare(b.object.metadata?.namespace ?? '') ||
        (a.object.metadata?.name ?? '').localeCompare(b.object.metadata?.name ?? ''),
    );
  const notReady = all.filter((row) => row.state !== 'ready');
  const visible = showAll ? all : notReady;

  return (
    <Stack sx={{ width: '100%', p: 1.5, gap: 1.5 }}>
      {kinds.map(({ kind, resourceKey }) => (
        <KindLoader key={resourceKey} kind={kind} resourceKey={resourceKey} connectionID={connectionID} onRows={onRows} />
      ))}

      <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={showAll ? 'all' : 'attention'}
          onChange={(_e, value) => value && setShowAll(value === 'all')}
        >
          <ToggleButton value="attention" sx={{ textTransform: 'none', py: 0.25 }}>
            Not ready ({notReady.length})
          </ToggleButton>
          <ToggleButton value="all" sx={{ textTransform: 'none', py: 0.25 }}>
            All ({all.length})
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {visible.length === 0 ? (
        <Typography color="text.secondary" sx={centeredSx}>
          {all.length === 0
            ? 'No Kustomizations or HelmReleases found.'
            : `All ${all.length} Kustomizations and HelmReleases are ready.`}
        </Typography>
      ) : (
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Status</TableCell>
              <TableCell>Kind</TableCell>
              <TableCell>Namespace</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Revision</TableCell>
              <TableCell>Since</TableCell>
              <TableCell>Message</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((row) => (
              <GitOpsRow key={row.object.metadata?.uid ?? `${row.kind}/${row.object.metadata?.namespace}/${row.object.metadata?.name}`} connectionID={connectionID} row={row} />
            ))}
          </TableBody>
        </Table>
      )}
    </Stack>
  );
};

type KindLoaderProps = {
  kind: string;
  resourceKey: string;
  connectionID: string;
  onRows: (kind: string, rows: Row[]) => void;
};

/** Subscribes to one resource type and reports its objects up; renders nothing. */
const KindLoader: React.FC<KindLoaderProps> = ({ kind, resourceKey, connectionID, onRows }) => {
  const { resources } = useResources({
    pluginID: KUBERNETES_PLUGIN,
    connectionID,
    resourceKey,
    idAccessor: 'metadata.uid',
  });
  const result = resources.data?.result;

  React.useEffect(() => {
    onRows(kind, ((result ?? []) as FluxObject[]).map((object) => ({ resourceKey, kind, object })));
  }, [kind, resourceKey, result, onRows]);

  return null;
};

const GitOpsRow: React.FC<{ connectionID: string; row: Row & { state: FluxState } }> = ({ connectionID, row }) => {
  const { showResourceSidebar } = useRightDrawer();
  const { object, kind, resourceKey, state } = row;
  const ready = readyCondition(object);
  const revision = fluxRevision(object);
  const name = object.metadata?.name ?? '';
  const namespace = object.metadata?.namespace ?? '';

  return (
    <TableRow
      hover
      sx={{ cursor: 'pointer' }}
      onClick={() =>
        showResourceSidebar({
          pluginID: KUBERNETES_PLUGIN,
          connectionID,
          resourceKey,
          resourceID: name,
          resourceName: name,
          namespace,
        })
      }
    >
      <TableCell>
        <Chip size="small" variant="outlined" color={STATE_COLOR[state]} label={STATE_LABEL[state]} />
      </TableCell>
      <TableCell>{kind}</TableCell>
      <TableCell>{namespace}</TableCell>
      <TableCell>{name}</TableCell>
      <TableCell sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{revision ? shortRevision(revision) : ''}</TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{timeAgo(ready?.lastTransitionTime)}</TableCell>
      <TableCell sx={{ maxWidth: 420 }}>
        {state !== 'ready' && ready?.message && (
          <Box sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={ready.message}>
            {ready.message}
          </Box>
        )}
      </TableCell>
      <TableCell align="right">
        <FluxActions dense connectionID={connectionID} resourceKey={resourceKey} object={object} />
      </TableCell>
    </TableRow>
  );
};

export default GitOpsPage;
