import React from 'react';
import { Card, Stack, Text } from '@omniviewdev/base-ui';

export type StatCardColor = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const VALUE_COLOR: Record<StatCardColor, string> = {
  brand: 'var(--ov-color-brand-500)',
  success: 'var(--ov-color-success)',
  warning: 'var(--ov-color-warning)',
  danger: 'var(--ov-color-danger)',
  info: 'var(--ov-color-info)',
  neutral: 'var(--ov-color-fg-default)',
};

type Props = {
  /** The large metric value. */
  value: string | number;
  /** Label beneath the value. */
  label: string;
  /** Optional description line under the label. */
  description?: React.ReactNode;
  /** Icon in the top-right corner. */
  icon?: React.ReactNode;
  /** Colour of the value. */
  color?: StatCardColor;
  /** Makes the whole card clickable. */
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
};

const cardStyle: React.CSSProperties = { minWidth: 0, height: '100%' };
const bodyStyle: React.CSSProperties = { padding: 16, height: '100%', boxSizing: 'border-box' };
const iconStyle: React.CSSProperties = {
  color: 'var(--ov-color-fg-subtle)',
  fontSize: 24,
  display: 'flex',
};

/**
 * A metric tile: big value, label, optional description and icon. Built on
 * base-ui's Card; replaces the old `@omniviewdev/ui` StatCard.
 */
const StatCard: React.FC<Props> = ({ value, label, description, icon, color = 'brand', onClick, style, className }) => {
  const content = (
    <Stack direction="column" spacing={1} style={bodyStyle}>
      <Stack direction="row" justify="between" align="start" spacing={2}>
        <div>
          <Card.Stat style={{ color: VALUE_COLOR[color] }}>{value}</Card.Stat>
          <Text as="div" size="sm" tone="muted" weight="medium" style={{ marginTop: 2 }}>
            {label}
          </Text>
        </div>
        {icon && <span style={iconStyle}>{icon}</span>}
      </Stack>
      {description && (
        <Text as="div" size="xs" tone="subtle" style={{ marginTop: 4 }}>
          {description}
        </Text>
      )}
    </Stack>
  );

  return (
    <Card className={className} style={{ ...cardStyle, ...style }}>
      {onClick ? <Card.ActionArea onClick={onClick} style={{ height: '100%' }}>{content}</Card.ActionArea> : content}
    </Card>
  );
};

export default StatCard;
