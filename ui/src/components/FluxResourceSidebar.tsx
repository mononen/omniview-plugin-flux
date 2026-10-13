import React from 'react';
import { Stack } from '@omniviewdev/ui/layout';
import { Text } from '@omniviewdev/ui/typography';
import { Chip } from '@omniviewdev/ui';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import { useResource, type DrawerContext } from '@omniviewdev/runtime';
import { LuCheck, LuX, LuClock, LuGitBranch, LuTag, LuBox, LuLink } from 'react-icons/lu';

import FluxActions from './FluxActions';
import { KUBERNETES_PLUGIN, type FluxCondition, type FluxObject } from '../flux';

type Props = {
  ctx: DrawerContext;
};

const get = (obj: unknown, path: string): unknown => {
  return path.split('.').reduce<unknown>((curr, key) => {
    if (curr && typeof curr === 'object' && key in (curr as Record<string, unknown>)) {
      return (curr as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
};

const FluxResourceSidebar: React.FC<Props> = ({ ctx }) => {
  const resourceKey = ctx.resource?.key ?? '';
  const connectionID = ctx.resource?.connectionID ?? '';
  const initial = (ctx.data ?? {}) as FluxObject;

  // The drawer hands us a snapshot; follow the live object so status and the
  // suspend state update after an action without reopening the panel.
  const { resource: live } = useResource({
    pluginID: KUBERNETES_PLUGIN,
    connectionID,
    resourceKey,
    resourceID: initial.metadata?.name ?? ctx.resource?.id ?? '',
    namespace: initial.metadata?.namespace ?? '',
  });
  const data = ((live.data?.result as FluxObject | undefined) ?? initial) as FluxObject;

  // Single-object queries are not watched, so poll briefly after an action to
  // pick up the controller's response.
  const refetch = live.refetch;
  const timers = React.useRef<number[]>([]);
  React.useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const onChanged = React.useCallback(() => {
    void refetch();
    timers.current.push(...[2000, 6000, 15000].map((ms) => window.setTimeout(() => void refetch(), ms)));
  }, [refetch]);

  const kind = resourceKey.split('::').pop() ?? resourceKey;
  const name = get(data, 'metadata.name') as string | undefined;
  const namespace = get(data, 'metadata.namespace') as string | undefined;
  const labels = get(data, 'metadata.labels') as Record<string, string> | undefined;
  const conditions = (get(data, 'status.conditions') ?? []) as FluxCondition[];
  const readyCondition = conditions.find((c) => c.type === 'Ready');
  const isReady = readyCondition?.status === 'True';
  const lastAppliedRevision = get(data, 'status.lastAppliedRevision') as string | undefined;
  const lastAttemptedRevision = get(data, 'status.lastAttemptedRevision') as string | undefined;
  const artifact = get(data, 'status.artifact') as { revision?: string; url?: string } | undefined;
  const sourceRef = get(data, 'spec.sourceRef') as { kind?: string; name?: string; namespace?: string } | undefined;
  const chartRef = get(data, 'spec.chart.spec.sourceRef') as { kind?: string; name?: string } | undefined;
  const interval = get(data, 'spec.interval') as string | undefined;
  const suspend = get(data, 'spec.suspend') as boolean | undefined;
  const url = get(data, 'spec.url') as string | undefined;

  return (
    <Stack direction="column" sx={{ width: '100%', gap: 1.5 }}>
      {/* Header */}
      <Stack direction="column" sx={{ gap: 0.5 }}>
        <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', color: 'primary.main' }}>
            <LuBox size={18} />
          </Box>
          <Text weight="bold" size="md">{name}</Text>
        </Stack>
        {namespace && (
          <Text size="xs" color="text.secondary">Namespace: {namespace}</Text>
        )}
        <Text size="xs" color="text.secondary">{kind}</Text>
      </Stack>

      {connectionID && name && (
        <FluxActions connectionID={connectionID} resourceKey={resourceKey} object={data} onChanged={onChanged} />
      )}

      <Divider />

      {/* Status */}
      <Section title="Status">
        <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
          <Chip
            size="sm"
            color={isReady ? 'success' : 'danger'}
            emphasis="soft"
            icon={isReady ? <LuCheck size={14} /> : <LuX size={14} />}
            label={isReady ? 'Ready' : 'Not Ready'}
          />
          {suspend && (
            <Chip size="sm" color="warning" emphasis="soft" label="Suspended" />
          )}
          {interval && (
            <Chip
              size="sm"
              color="neutral"
              emphasis="soft"
              icon={<LuClock size={14} />}
              label={interval}
            />
          )}
        </Stack>
        {readyCondition?.message && (
          <Text size="xs" color="text.secondary" sx={{ mt: 0.5 }}>
            {readyCondition.message}
          </Text>
        )}
      </Section>

      {/* Source / Revision */}
      {(lastAppliedRevision || lastAttemptedRevision || artifact?.revision) && (
        <>
          <Divider />
          <Section title="Revision">
            {lastAppliedRevision && (
              <InfoRow icon={<LuTag size={14} />} label="Applied" value={truncateRevision(lastAppliedRevision)} />
            )}
            {lastAttemptedRevision && lastAttemptedRevision !== lastAppliedRevision && (
              <InfoRow icon={<LuTag size={14} />} label="Attempted" value={truncateRevision(lastAttemptedRevision)} />
            )}
            {artifact?.revision && !lastAppliedRevision && (
              <InfoRow icon={<LuTag size={14} />} label="Artifact" value={truncateRevision(artifact.revision)} />
            )}
          </Section>
        </>
      )}

      {/* Source Reference */}
      {sourceRef && (
        <>
          <Divider />
          <Section title="Source Reference">
            <InfoRow icon={<LuLink size={14} />} label="Kind" value={sourceRef.kind ?? 'Unknown'} />
            <InfoRow icon={<LuGitBranch size={14} />} label="Name" value={sourceRef.name ?? 'Unknown'} />
            {sourceRef.namespace && (
              <InfoRow label="Namespace" value={sourceRef.namespace} />
            )}
          </Section>
        </>
      )}

      {/* Chart Source (for HelmReleases) */}
      {chartRef && !sourceRef && (
        <>
          <Divider />
          <Section title="Chart Source">
            <InfoRow icon={<LuLink size={14} />} label="Kind" value={chartRef.kind ?? 'HelmRepository'} />
            <InfoRow icon={<LuGitBranch size={14} />} label="Name" value={chartRef.name ?? 'Unknown'} />
          </Section>
        </>
      )}

      {/* URL (for source resources) */}
      {url && (
        <>
          <Divider />
          <Section title="URL">
            <Text size="xs" sx={{ wordBreak: 'break-all' }}>{url}</Text>
          </Section>
        </>
      )}

      {/* Conditions */}
      {conditions.length > 0 && (
        <>
          <Divider />
          <Section title="Conditions">
            <Stack direction="column" sx={{ gap: 1 }}>
              {conditions.map((c, i) => (
                <ConditionRow key={`${c.type}-${i}`} condition={c} />
              ))}
            </Stack>
          </Section>
        </>
      )}

      {/* Labels */}
      {labels && Object.keys(labels).length > 0 && (
        <>
          <Divider />
          <Section title="Labels">
            <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
              {Object.entries(labels).map(([k, v]) => (
                <Chip
                  key={k}
                  size="sm"
                  emphasis="outline"
                  label={`${k}: ${v}`}
                />
              ))}
            </Stack>
          </Section>
        </>
      )}
    </Stack>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Stack direction="column" sx={{ gap: 0.5 }}>
    <Text weight="semibold" size="sm" color="text.secondary">{title}</Text>
    {children}
  </Stack>
);

const InfoRow: React.FC<{ icon?: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <Stack direction="row" sx={{ gap: 0.75, alignItems: 'center' }}>
    {icon && <Box sx={{ display: 'flex', color: 'text.secondary' }}>{icon}</Box>}
    <Text size="xs" color="text.secondary">{label}:</Text>
    <Text size="xs" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{value}</Text>
  </Stack>
);

const ConditionRow: React.FC<{ condition: FluxCondition }> = ({ condition }) => {
  const isTrue = condition.status === 'True';
  return (
    <Box sx={{ p: 0.75, borderRadius: 1, bgcolor: 'background.default' }}>
      <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center', mb: 0.25 }}>
        <Chip
          size="sm"
          color={isTrue ? 'success' : 'danger'}
          emphasis="soft"
          label={condition.type}
        />
        {condition.reason && (
          <Text size="xs" color="text.secondary">{condition.reason}</Text>
        )}
      </Stack>
      {condition.message && (
        <Text size="xs" color="text.secondary" sx={{ pl: 0.5 }}>
          {condition.message}
        </Text>
      )}
      {condition.lastTransitionTime && (
        <Text size="xs" color="text.disabled" sx={{ pl: 0.5, mt: 0.25 }}>
          {condition.lastTransitionTime}
        </Text>
      )}
    </Box>
  );
};

const truncateRevision = (rev: string): string => {
  if (rev.includes(':')) {
    const parts = rev.split(':');
    const hash = parts[parts.length - 1];
    return hash.length > 12
      ? `${parts.slice(0, -1).join(':')}:${hash.slice(0, 12)}`
      : rev;
  }
  return rev.length > 12 ? rev.slice(0, 12) : rev;
};

export default FluxResourceSidebar;
