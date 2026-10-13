import React from 'react';

import { ChipList, FieldSection, RefLink, RefList, Section, type DetailProps } from './parts';

export const AlertDetails: React.FC<DetailProps> = ({ connectionID, object }) => {
  const { spec } = object;
  const namespace = object.metadata?.namespace ?? '';

  return (
    <>
      <FieldSection
        title="Alert"
        rows={[
          [
            'Provider',
            spec?.providerRef?.name && (
              <RefLink connectionID={connectionID} kind="Provider" name={spec.providerRef.name} namespace={namespace} />
            ),
          ],
          ['Severity', spec?.eventSeverity ?? 'info'],
          ['Summary', spec?.summary ?? spec?.eventMetadata?.summary],
          ['Include patterns', (spec?.inclusionList as string[] | undefined)?.length],
          ['Exclude patterns', (spec?.exclusionList as string[] | undefined)?.length],
        ]}
      />
      {!!spec?.eventSources?.length && (
        <Section title="Event sources">
          <RefList connectionID={connectionID} refs={spec.eventSources} home={namespace} />
        </Section>
      )}
    </>
  );
};

export const ProviderDetails: React.FC<DetailProps> = ({ connectionID, object }) => {
  const { spec } = object;
  const namespace = object.metadata?.namespace ?? '';

  return (
    <FieldSection
      title="Provider"
      rows={[
        ['Type', spec?.type],
        ['Channel', spec?.channel],
        ['Address', spec?.address],
        ['Username', spec?.username],
        [
          'Secret',
          spec?.secretRef?.name && (
            <RefLink connectionID={connectionID} kind="Secret" name={spec.secretRef.name} namespace={namespace} />
          ),
        ],
        ['Proxy', spec?.proxy],
        ['Timeout', spec?.timeout],
      ]}
    />
  );
};

export const ReceiverDetails: React.FC<DetailProps> = ({ connectionID, object }) => {
  const { spec, status } = object;
  const namespace = object.metadata?.namespace ?? '';
  const events = spec?.events as string[] | undefined;

  return (
    <>
      <FieldSection
        title="Receiver"
        rows={[
          ['Type', spec?.type],
          ['Webhook path', status?.webhookPath],
          [
            'Secret',
            spec?.secretRef?.name && (
              <RefLink connectionID={connectionID} kind="Secret" name={spec.secretRef.name} namespace={namespace} />
            ),
          ],
        ]}
      />
      {!!events?.length && (
        <Section title="Events">
          <ChipList values={events} />
        </Section>
      )}
      {!!spec?.resources?.length && (
        <Section title="Reconciles">
          <RefList connectionID={connectionID} refs={spec.resources} home={namespace} />
        </Section>
      )}
    </>
  );
};
