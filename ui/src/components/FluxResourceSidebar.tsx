import React from 'react';
// The host shares the @mui/material root; deep imports would bundle a second copy.
import { Box } from '@mui/material';
import { Stack } from '@omniviewdev/ui/layout';
import { Text } from '@omniviewdev/ui/typography';
import { Chip } from '@omniviewdev/ui';
import { useResource, type DrawerContext } from '@omniviewdev/runtime';
import { LuBox, LuClock } from 'react-icons/lu';

import FluxActions from './FluxActions';
import { KustomizationDetails, HelmReleaseDetails } from './sidebar/deployers';
import { ImagePolicyDetails, ImageRepositoryDetails, ImageUpdateAutomationDetails } from './sidebar/image';
import { AlertDetails, ProviderDetails, ReceiverDetails } from './sidebar/notification';
import { ChipList, ConditionRow, Section, type DetailProps } from './sidebar/parts';
import {
  BucketDetails,
  GitRepositoryDetails,
  HelmChartDetails,
  HelmRepositoryDetails,
  OCIRepositoryDetails,
} from './sidebar/sources';
import {
  KUBERNETES_PLUGIN,
  STATE_LABEL,
  fluxState,
  isStatic,
  readyCondition,
  type FluxObject,
  type FluxState,
} from '../flux';

type Props = {
  ctx: DrawerContext;
};

/** The body of the panel for each Flux kind. */
const DETAILS: Record<string, React.FC<DetailProps>> = {
  GitRepository: GitRepositoryDetails,
  OCIRepository: OCIRepositoryDetails,
  HelmRepository: HelmRepositoryDetails,
  HelmChart: HelmChartDetails,
  Bucket: BucketDetails,
  Kustomization: KustomizationDetails,
  HelmRelease: HelmReleaseDetails,
  ImageRepository: ImageRepositoryDetails,
  ImagePolicy: ImagePolicyDetails,
  ImageUpdateAutomation: ImageUpdateAutomationDetails,
  Alert: AlertDetails,
  Provider: ProviderDetails,
  Receiver: ReceiverDetails,
};

const STATE_COLOR: Record<FluxState, 'success' | 'danger' | 'info' | 'warning' | 'neutral'> = {
  ready: 'success',
  failed: 'danger',
  stalled: 'danger',
  reconciling: 'info',
  suspended: 'warning',
  unknown: 'neutral',
};

/**
 * Side panel for any Flux object: identity, actions and status are common,
 * the middle is specific to the kind.
 */
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
  const kind = resourceKey.split('::').pop() ?? resourceKey;
  // Lists may hand over objects without their kind; the panel bodies rely on it.
  const data: FluxObject = { ...((live.data?.result as FluxObject | undefined) ?? initial), kind };

  // Single-object queries are not watched, so poll briefly after an action to
  // pick up the controller's response.
  const refetch = live.refetch;
  const timers = React.useRef<number[]>([]);
  React.useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const onChanged = React.useCallback(() => {
    void refetch();
    timers.current.push(...[2000, 6000, 15000].map((ms) => window.setTimeout(() => void refetch(), ms)));
  }, [refetch]);

  const name = data.metadata?.name;
  const namespace = data.metadata?.namespace;
  const labels = data.metadata?.labels ?? {};
  const conditions = data.status?.conditions ?? [];
  const state = fluxState(data);
  const ready = readyCondition(data);
  const interval = data.spec?.interval as string | undefined;
  const Details = DETAILS[kind];

  return (
    <Stack direction="column" sx={{ width: '100%', gap: 1.5 }}>
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

      <Section title="Status">
        <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
          {isStatic(data) && state !== 'suspended' ? (
            <Chip size="sm" color="neutral" emphasis="soft" label="No status reported" />
          ) : (
            <Chip size="sm" color={STATE_COLOR[state]} emphasis="soft" label={STATE_LABEL[state]} />
          )}
          {interval && (
            <Chip size="sm" color="neutral" emphasis="soft" icon={<LuClock size={14} />} label={interval} />
          )}
        </Stack>
        {ready?.message && (
          <Text size="xs" color="text.secondary" sx={{ mt: 0.5 }}>
            {ready.message}
          </Text>
        )}
      </Section>

      {Details && <Details connectionID={connectionID} object={data} />}

      {conditions.length > 0 && (
        <Section title="Conditions">
          <Stack direction="column" sx={{ gap: 1 }}>
            {conditions.map((c, i) => (
              <ConditionRow key={`${c.type}-${i}`} condition={c} />
            ))}
          </Stack>
        </Section>
      )}

      {Object.keys(labels).length > 0 && (
        <Section title="Labels">
          <ChipList values={Object.entries(labels).map(([k, v]) => `${k}: ${v}`)} />
        </Section>
      )}
    </Stack>
  );
};

export default FluxResourceSidebar;
