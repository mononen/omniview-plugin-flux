import React from 'react';
// The host shares the @mui/material root; deep imports would bundle a second copy.
import { Box, Divider } from '@mui/material';
import { Chip } from '@omniviewdev/ui';
import { Stack } from '@omniviewdev/ui/layout';
import { Text } from '@omniviewdev/ui/typography';
import { useResourceTypes, useRightDrawer } from '@omniviewdev/runtime';

import { KUBERNETES_PLUGIN, resolveRefKey, type FluxCondition, type FluxObject } from '../../flux';

/** What every per-kind panel body receives. */
export type DetailProps = { connectionID: string; object: FluxObject };

/** A titled block of the panel, separated from the one above it. */
export const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <>
    <Divider />
    <Stack direction="column" sx={{ gap: 0.5 }}>
      <Text weight="semibold" size="sm" color="text.secondary">{title}</Text>
      {children}
    </Stack>
  </>
);

/** A label and its value; rows whose value is empty are left out. */
export type Field = [label: string, value: React.ReactNode];

const isShown = (value: React.ReactNode): boolean =>
  value !== undefined && value !== null && value !== false && value !== '';

const valueSx = { fontFamily: 'monospace', wordBreak: 'break-all' } as const;

/** A section of label/value rows; renders nothing when every row is empty. */
export const FieldSection: React.FC<{ title: string; rows: Field[]; children?: React.ReactNode }> = ({
  title,
  rows,
  children,
}) => {
  const shown = rows.filter(([, value]) => isShown(value));
  if (shown.length === 0 && !children) return null;

  return (
    <Section title={title}>
      {shown.map(([label, value]) => (
        <Stack key={label} direction="row" sx={{ gap: 0.75, alignItems: 'baseline' }}>
          <Text size="xs" color="text.secondary" sx={{ flexShrink: 0 }}>{label}:</Text>
          {typeof value === 'string' || typeof value === 'number' ? (
            <Text size="xs" sx={valueSx}>{value}</Text>
          ) : (
            value
          )}
        </Stack>
      ))}
      {children}
    </Section>
  );
};

/** `yes` / `no` for a flag that is set, nothing when it is left to its default. */
export const flag = (value: unknown): string | undefined =>
  value === undefined || value === null ? undefined : value ? 'yes' : 'no';

type RefLinkProps = {
  connectionID: string;
  kind: string;
  name: string;
  namespace: string;
  /** Namespace of the object holding the reference; shown only when it differs. */
  home?: string;
  /** Prefix the name with the kind. */
  showKind?: boolean;
};

const linkSx = {
  ...valueSx,
  fontSize: '0.75rem',
  color: 'primary.main',
  cursor: 'pointer',
  '&:hover': { textDecoration: 'underline' },
} as const;

/** A referenced object; opens its side panel when the cluster serves the kind. */
export const RefLink: React.FC<RefLinkProps> = ({ connectionID, kind, name, namespace, home, showKind }) => {
  const { types } = useResourceTypes({ pluginID: KUBERNETES_PLUGIN, connectionID });
  const { showResourceSidebar } = useRightDrawer();
  const resourceKey = resolveRefKey(types.data, kind);
  const label = `${showKind ? `${kind}/` : ''}${name}${home !== undefined && namespace !== home ? ` (${namespace})` : ''}`;

  // Wildcards in event sources match many objects, so there is nothing to open.
  if (!resourceKey || name === '*') {
    return <Text size="xs" sx={valueSx}>{label}</Text>;
  }

  return (
    <Box
      component="span"
      sx={linkSx}
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
      {label}
    </Box>
  );
};

type ObjectRef = { kind?: string; name?: string; namespace?: string };

/** References listed one per line, e.g. dependsOn or an alert's event sources. */
export const RefList: React.FC<{
  connectionID: string;
  refs: ObjectRef[] | undefined;
  /** Kind to assume when the reference does not carry one. */
  kind?: string;
  home: string;
}> = ({ connectionID, refs, kind, home }) => (
  <Stack direction="column" sx={{ gap: 0.25 }}>
    {(refs ?? []).map((ref, i) => (
      <RefLink
        key={`${ref.kind}/${ref.namespace}/${ref.name}/${i}`}
        connectionID={connectionID}
        kind={ref.kind ?? kind ?? ''}
        name={ref.name ?? ''}
        namespace={ref.namespace ?? home}
        home={home}
        showKind={!kind}
      />
    ))}
  </Stack>
);

/** Short values shown as a wrapping row of chips. */
export const ChipList: React.FC<{ values: string[] | undefined }> = ({ values }) => (
  <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
    {(values ?? []).map((value) => (
      <Chip key={value} size="sm" emphasis="outline" label={value} />
    ))}
  </Stack>
);

export const ConditionRow: React.FC<{ condition: FluxCondition }> = ({ condition }) => {
  const isTrue = condition.status === 'True';
  return (
    <Box sx={{ p: 0.75, borderRadius: 1, bgcolor: 'background.default' }}>
      <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center', mb: 0.25 }}>
        <Chip size="sm" color={isTrue ? 'success' : 'danger'} emphasis="soft" label={condition.type} />
        {condition.reason && <Text size="xs" color="text.secondary">{condition.reason}</Text>}
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
