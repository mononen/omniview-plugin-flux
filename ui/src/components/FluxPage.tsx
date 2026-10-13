import React from 'react';
// The host shares the @mui/material root; deep imports would bundle a second copy.
import {
  Box,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { usePluginRouter, useResources, useResourceTypes, useRightDrawer } from '@omniviewdev/runtime';

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
  /** Set when one of the page's sub-entries is selected. */
  subPath?: string;
};

/** Sub-pages listed under Flux in the cluster navigation. */
export const FLUX_SUB_PAGES = [
  { path: 'kustomizations', label: 'Kustomization', kind: 'Kustomization' },
  { path: 'helmreleases', label: 'HelmRelease', kind: 'HelmRelease' },
] as const;

/** What the overview summarises: the things that deploy, then where they come from. */
const OVERVIEW_GROUPS: Array<{ title: string; kinds: string[]; subPath?: string }> = [
  { title: 'Kustomizations', kinds: ['Kustomization'], subPath: 'kustomizations' },
  { title: 'HelmReleases', kinds: ['HelmRelease'], subPath: 'helmreleases' },
  { title: 'Sources', kinds: ['GitRepository', 'OCIRepository', 'HelmRepository', 'HelmChart', 'Bucket'] },
];

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

type Row = { resourceKey: string; kind: string; object: FluxObject; state: FluxState };

const centeredSx = { p: 4, width: '100%', textAlign: 'center' } as const;
const pageSx = { width: '100%', height: '100%', minHeight: 0, p: 1.5, gap: 1.5 } as const;
// The cluster view clips its main area, so lists scroll on their own.
const scrollSx = { flex: 1, minHeight: 0, overflow: 'auto' } as const;

const FluxPage: React.FC<Props> = ({ connectionID, subPath }) => {
  const subPage = FLUX_SUB_PAGES.find((p) => p.path === subPath);
  const kinds = React.useMemo(
    () => (subPage ? [subPage.kind] : OVERVIEW_GROUPS.flatMap((g) => g.kinds)),
    [subPage],
  );
  const { loading, installed, rows, loaders } = useFluxRows(connectionID, kinds);

  let body: React.ReactNode;
  if (loading) {
    body = <Typography color="text.secondary" sx={centeredSx}>Loading…</Typography>;
  } else if (!installed) {
    body = (
      <Typography color="text.secondary" sx={centeredSx}>
        {subPage
          ? `This cluster does not serve the ${subPage.kind} resource type.`
          : 'Flux is not installed on this cluster (no Flux resource types found).'}
      </Typography>
    );
  } else if (subPage) {
    body = <KindList connectionID={connectionID} label={subPage.label} rows={rows} />;
  } else {
    body = <Overview connectionID={connectionID} rows={rows} />;
  }

  return (
    <Stack sx={pageSx}>
      {loaders}
      {body}
    </Stack>
  );
};

/**
 * Watches the given Flux kinds on a connection and returns their objects,
 * worst state first. `loaders` must be rendered: each one subscribes to a
 * resource type the cluster serves.
 */
const useFluxRows = (connectionID: string, kinds: string[]) => {
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

const Overview: React.FC<{ connectionID: string; rows: Row[] }> = ({ connectionID, rows }) => {
  const { navigate } = usePluginRouter();
  const notReady = rows.filter((row) => row.state !== 'ready');

  return (
    <>
      <Stack direction="row" sx={{ gap: 1.5, flexWrap: 'wrap' }}>
        {OVERVIEW_GROUPS.map((group) => {
          const groupRows = rows.filter((row) => group.kinds.includes(row.kind));
          const count = (state: FluxState) => groupRows.filter((row) => row.state === state).length;
          const failing = count('failed') + count('stalled');
          const pending = count('reconciling') + count('unknown');
          const suspended = count('suspended');
          const subPath = group.subPath;

          return (
            <Box
              key={group.title}
              onClick={subPath ? () => navigate(subPath) : undefined}
              sx={{
                flex: '1 1 220px',
                p: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                cursor: subPath ? 'pointer' : 'default',
                '&:hover': subPath ? { borderColor: 'primary.main' } : undefined,
              }}
            >
              <Typography variant="body2" color="text.secondary">{group.title}</Typography>
              <Typography variant="h4" sx={{ my: 0.5 }}>{groupRows.length}</Typography>
              <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
                <Chip size="small" variant="outlined" color="success" label={`${count('ready')} ready`} />
                {failing > 0 && <Chip size="small" variant="outlined" color="error" label={`${failing} failing`} />}
                {pending > 0 && <Chip size="small" variant="outlined" color="info" label={`${pending} reconciling`} />}
                {suspended > 0 && <Chip size="small" variant="outlined" color="warning" label={`${suspended} suspended`} />}
              </Stack>
            </Box>
          );
        })}
      </Stack>

      <Typography variant="subtitle2" color="text.secondary">Needs attention ({notReady.length})</Typography>
      {notReady.length === 0 ? (
        <Typography color="text.secondary" sx={centeredSx}>
          {rows.length === 0 ? 'No Flux resources found.' : `All ${rows.length} Flux resources are ready.`}
        </Typography>
      ) : (
        <FluxTable connectionID={connectionID} rows={notReady} />
      )}
    </>
  );
};

const KindList: React.FC<{ connectionID: string; label: string; rows: Row[] }> = ({ connectionID, label, rows }) => {
  const [onlyNotReady, setOnlyNotReady] = React.useState(false);
  const notReady = rows.filter((row) => row.state !== 'ready');
  const visible = onlyNotReady ? notReady : rows;

  return (
    <>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={onlyNotReady ? 'attention' : 'all'}
        onChange={(_e, value) => value && setOnlyNotReady(value === 'attention')}
        sx={{ alignSelf: 'flex-start' }}
      >
        <ToggleButton value="all" sx={{ textTransform: 'none', py: 0.25 }}>
          All ({rows.length})
        </ToggleButton>
        <ToggleButton value="attention" sx={{ textTransform: 'none', py: 0.25 }}>
          Not ready ({notReady.length})
        </ToggleButton>
      </ToggleButtonGroup>

      {visible.length === 0 ? (
        <Typography color="text.secondary" sx={centeredSx}>
          {rows.length === 0 ? `No ${label} resources found.` : `All ${rows.length} are ready.`}
        </Typography>
      ) : (
        <FluxTable connectionID={connectionID} rows={visible} hideKind />
      )}
    </>
  );
};

const FluxTable: React.FC<{ connectionID: string; rows: Row[]; hideKind?: boolean }> = ({ connectionID, rows, hideKind }) => (
  <Box sx={scrollSx}>
    <Table size="small" stickyHeader>
      <TableHead>
        <TableRow>
          <TableCell>Status</TableCell>
          {!hideKind && <TableCell>Kind</TableCell>}
          <TableCell>Namespace</TableCell>
          <TableCell>Name</TableCell>
          <TableCell>Revision</TableCell>
          <TableCell>Since</TableCell>
          <TableCell>Message</TableCell>
          <TableCell />
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <FluxRow
            key={row.object.metadata?.uid ?? `${row.kind}/${row.object.metadata?.namespace}/${row.object.metadata?.name}`}
            connectionID={connectionID}
            row={row}
            hideKind={hideKind}
          />
        ))}
      </TableBody>
    </Table>
  </Box>
);

const FluxRow: React.FC<{ connectionID: string; row: Row; hideKind?: boolean }> = ({ connectionID, row, hideKind }) => {
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
      {!hideKind && <TableCell>{kind}</TableCell>}
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

export default FluxPage;
