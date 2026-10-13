import React from 'react';
// The host shares the @mui/material root; deep imports would bundle a second copy.
import { Button, Stack } from '@mui/material';
import { useResource, useResourceMutations, useResourceTypes } from '@omniviewdev/runtime';
import { LuPause, LuPlay, LuRefreshCw } from 'react-icons/lu';

import {
  KUBERNETES_PLUGIN,
  isSuspendable,
  resolveFluxKey,
  sourceRefOf,
  withReconcileRequest,
  withSuspend,
  type FluxObject,
  type SourceRef,
} from '../flux';

type Props = {
  connectionID: string;
  resourceKey: string;
  object: FluxObject;
  /** Table-row layout: only the single-object actions. */
  dense?: boolean;
  /** Called after a change has been written, for callers whose data is not watched. */
  onChanged?: () => void;
};

const buttonSx = { textTransform: 'none', whiteSpace: 'nowrap' } as const;

/**
 * Reconcile / suspend / resume controls for a Flux object. Changes are written
 * through the Kubernetes plugin's connection, so they use the same credentials
 * as every other edit in the cluster view.
 */
const FluxActions: React.FC<Props> = ({ connectionID, resourceKey, object, dense, onChanged }) => {
  const { update } = useResourceMutations({ pluginID: KUBERNETES_PLUGIN });
  const [busy, setBusy] = React.useState(false);

  const name = object.metadata?.name ?? '';
  const namespace = object.metadata?.namespace ?? '';
  const suspended = !!object.spec?.suspend;
  const source = sourceRefOf(object);

  const apply = React.useCallback(
    async (next: FluxObject) => {
      setBusy(true);
      try {
        await update({
          opts: { connectionID, resourceKey, resourceID: name, namespace },
          input: { input: next },
        });
        onChanged?.();
      } catch {
        // The mutation hook already reports the failure to the user.
      } finally {
        setBusy(false);
      }
    },
    [update, connectionID, resourceKey, name, namespace, onChanged],
  );

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <Stack direction="row" spacing={0.75} onClick={stop} sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
      <Button
        size="small"
        variant="outlined"
        disabled={busy || suspended}
        startIcon={<LuRefreshCw size={14} />}
        onClick={() => void apply(withReconcileRequest(object))}
        sx={buttonSx}
      >
        Reconcile
      </Button>
      {!dense && source && (
        <ReconcileWithSource
          connectionID={connectionID}
          source={source}
          disabled={busy || suspended}
          onSourceRequested={() => apply(withReconcileRequest(object))}
        />
      )}
      {isSuspendable(object) && (
        <Button
          size="small"
          variant="outlined"
          color={suspended ? 'success' : 'warning'}
          disabled={busy}
          startIcon={suspended ? <LuPlay size={14} /> : <LuPause size={14} />}
          onClick={() => void apply(withSuspend(object, !suspended))}
          sx={buttonSx}
        >
          {suspended ? 'Resume' : 'Suspend'}
        </Button>
      )}
    </Stack>
  );
};

type WithSourceProps = {
  connectionID: string;
  source: SourceRef;
  disabled: boolean;
  onSourceRequested: () => Promise<void>;
};

/** Asks the source to fetch first, then reconciles the object that uses it. */
const ReconcileWithSource: React.FC<WithSourceProps> = ({ connectionID, source, disabled, onSourceRequested }) => {
  const { types } = useResourceTypes({ pluginID: KUBERNETES_PLUGIN, connectionID });
  const sourceKey = resolveFluxKey(types.data, source.kind);

  if (!sourceKey) return null;

  return (
    <ReconcileWithSourceButton
      connectionID={connectionID}
      sourceKey={sourceKey}
      source={source}
      disabled={disabled}
      onSourceRequested={onSourceRequested}
    />
  );
};

const ReconcileWithSourceButton: React.FC<WithSourceProps & { sourceKey: string }> = ({
  connectionID,
  sourceKey,
  source,
  disabled,
  onSourceRequested,
}) => {
  const { resource, update } = useResource({
    pluginID: KUBERNETES_PLUGIN,
    connectionID,
    resourceKey: sourceKey,
    resourceID: source.name,
    namespace: source.namespace,
  });
  const [busy, setBusy] = React.useState(false);
  const sourceObject = resource.data?.result as FluxObject | undefined;

  const run = async () => {
    if (!sourceObject) return;
    setBusy(true);
    try {
      await update({ input: withReconcileRequest(sourceObject) });
      await onSourceRequested();
    } catch {
      // The mutation hook already reports the failure to the user.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="small"
      variant="outlined"
      disabled={disabled || busy || !sourceObject}
      startIcon={<LuRefreshCw size={14} />}
      onClick={() => void run()}
      sx={buttonSx}
    >
      Reconcile with source
    </Button>
  );
};

export default FluxActions;
