import React from 'react';
// The host shares the @mui/material root; deep imports would bundle a second copy.
import {
  Alert,
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
import { usePluginRouter, useRightDrawer } from '@omniviewdev/runtime';

import FluxActions from './FluxActions';
import {
  KUBERNETES_PLUGIN,
  OVERVIEW_GROUPS,
  OVERVIEW_KINDS,
  STATE_LABEL,
  fluxRevision,
  readyCondition,
  shortRevision,
  timeAgo,
  type FluxState,
} from '../flux';
import { useFluxControllers } from '../useFluxControllers';
import { countStates, useFluxRows, type Row } from '../useFluxRows';

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

const STATE_COLOR: Record<FluxState, 'success' | 'error' | 'info' | 'warning' | 'default'> = {
  ready: 'success',
  failed: 'error',
  stalled: 'error',
  reconciling: 'info',
  suspended: 'warning',
  unknown: 'default',
};

const centeredSx = { p: 4, width: '100%', textAlign: 'center' } as const;
const pageSx = { width: '100%', height: '100%', minHeight: 0, p: 1.5, gap: 1.5 } as const;
// The cluster view clips its main area, so lists scroll on their own.
const scrollSx = { flex: 1, minHeight: 0, overflow: 'auto' } as const;

const FluxPage: React.FC<Props> = ({ connectionID, subPath }) => {
  const subPage = FLUX_SUB_PAGES.find((p) => p.path === subPath);
  const kinds = React.useMemo(() => (subPage ? [subPage.kind] : OVERVIEW_KINDS), [subPage]);
  const { loading, installed, rows, loaders } = useFluxRows(connectionID, kinds);

  let body: React.ReactNode;
  if (loading) {
    body = <Typography color="text.secondary" sx={centeredSx}>Loading…</Typography>;
  } else if (!installed) {
    body = <NotInstalled kind={subPage?.kind} />;
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

/** Shown when the cluster serves none of the resource types the page needs. */
const NotInstalled: React.FC<{ kind?: string }> = ({ kind }) => (
  <Stack sx={{ ...centeredSx, alignItems: 'center', gap: 0.5 }}>
    <Typography variant="subtitle1">
      {kind ? `${kind} is not available on this cluster` : 'Flux is not installed on this cluster'}
    </Typography>
    <Typography variant="body2" color="text.secondary">
      {kind
        ? `The cluster does not serve the ${kind} resource type. The Flux controller that provides it may not be installed.`
        : 'None of the Flux resource types were found. Install Flux with `flux bootstrap` or `flux install`, then reopen this page.'}
    </Typography>
  </Stack>
);

/** Controller versions and readiness, so a broken install is visible before its symptoms. */
const Controllers: React.FC<{ connectionID: string }> = ({ connectionID }) => {
  const { known, controllers, fluxVersion } = useFluxControllers(connectionID);

  if (!known) return null;

  if (controllers.length === 0) {
    return (
      <Alert severity="warning" sx={{ py: 0 }}>
        Flux resource types exist on this cluster, but no Flux controllers were found. Nothing will be reconciled.
      </Alert>
    );
  }

  return (
    <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mr: 0.5 }}>
        Controllers{fluxVersion ? ` (Flux ${fluxVersion})` : ''}
      </Typography>
      {controllers.map((c) => (
        <Chip
          key={c.id}
          size="small"
          variant="outlined"
          color={c.ready ? 'success' : 'error'}
          label={`${c.name}${c.version ? ` ${c.version}` : ''}${c.ready ? '' : ` · ${c.readyReplicas}/${c.replicas} ready`}`}
          title={`${c.namespace}/${c.name}: ${c.readyReplicas}/${c.replicas} replicas ready`}
        />
      ))}
    </Stack>
  );
};

const Overview: React.FC<{ connectionID: string; rows: Row[] }> = ({ connectionID, rows }) => {
  const { navigate } = usePluginRouter();
  const notReady = rows.filter((row) => row.state !== 'ready');

  return (
    <>
      <Stack direction="row" sx={{ gap: 1.5, flexWrap: 'wrap' }}>
        {OVERVIEW_GROUPS.map((group) => {
          const { total, ready, failing, pending, suspended } = countStates(
            rows.filter((row) => group.kinds.includes(row.kind)),
          );
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
              <Typography variant="h4" sx={{ my: 0.5 }}>{total}</Typography>
              <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
                <Chip size="small" variant="outlined" color="success" label={`${ready} ready`} />
                {failing > 0 && <Chip size="small" variant="outlined" color="error" label={`${failing} failing`} />}
                {pending > 0 && <Chip size="small" variant="outlined" color="info" label={`${pending} reconciling`} />}
                {suspended > 0 && <Chip size="small" variant="outlined" color="warning" label={`${suspended} suspended`} />}
              </Stack>
            </Box>
          );
        })}
      </Stack>

      <Controllers connectionID={connectionID} />

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
