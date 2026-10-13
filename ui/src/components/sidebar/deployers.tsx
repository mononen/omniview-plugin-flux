import React from 'react';

import { shortRevision, timeAgo } from '../../flux';
import { FieldSection, RefLink, RefList, Section, flag, type DetailProps } from './parts';

export const KustomizationDetails: React.FC<DetailProps> = ({ connectionID, object }) => {
  const { spec, status } = object;
  const namespace = object.metadata?.namespace ?? '';
  const source = spec?.sourceRef;
  const applied = status?.lastAppliedRevision as string | undefined;
  const attempted = status?.lastAttemptedRevision as string | undefined;
  const substituteFrom = spec?.postBuild?.substituteFrom as Array<{ kind?: string; name?: string }> | undefined;
  const entries = status?.inventory?.entries as unknown[] | undefined;

  return (
    <>
      <FieldSection
        title="Source"
        rows={[
          [
            'Source',
            source?.name && (
              <RefLink
                connectionID={connectionID}
                kind={source.kind}
                name={source.name}
                namespace={source.namespace ?? namespace}
                home={namespace}
                showKind
              />
            ),
          ],
          ['Path', spec?.path ?? './'],
          ['Applied', applied && shortRevision(applied)],
          ['Attempted', attempted && attempted !== applied && shortRevision(attempted)],
        ]}
      />
      <FieldSection
        title="Apply"
        rows={[
          ['Prune', flag(spec?.prune)],
          ['Wait', flag(spec?.wait)],
          ['Force', flag(spec?.force)],
          ['Target namespace', spec?.targetNamespace],
          ['Service account', spec?.serviceAccountName],
          ['Remote cluster', spec?.kubeConfig?.secretRef?.name],
          ['Decryption', spec?.decryption?.provider],
          ['Health checks', (spec?.healthChecks as unknown[] | undefined)?.length],
          ['Timeout', spec?.timeout],
          ['Retry interval', spec?.retryInterval],
          ['Managed objects', entries?.length],
        ]}
      />
      {!!spec?.dependsOn?.length && (
        <Section title="Depends on">
          <RefList connectionID={connectionID} refs={spec.dependsOn} kind="Kustomization" home={namespace} />
        </Section>
      )}
      {!!substituteFrom?.length && (
        <Section title="Substitutes from">
          <RefList connectionID={connectionID} refs={substituteFrom.map((ref) => ({ ...ref, namespace }))} home={namespace} />
        </Section>
      )}
    </>
  );
};

export const HelmReleaseDetails: React.FC<DetailProps> = ({ connectionID, object }) => {
  const { spec, status } = object;
  const namespace = object.metadata?.namespace ?? '';
  const chartRef = spec?.chartRef;
  const chart = spec?.chart?.spec;
  const source = chartRef ?? chart?.sourceRef;
  // Flux records the HelmChart it generated as "<namespace>/<name>".
  const [chartNamespace, chartName] = ((status?.helmChart as string | undefined) ?? '').split('/');
  const release = status?.history?.[0];
  const valuesFrom = spec?.valuesFrom as Array<{ kind?: string; name?: string }> | undefined;

  return (
    <>
      <FieldSection
        title="Chart"
        rows={[
          ['Chart', chart?.chart],
          ['Version', chart && (chart.version ?? '*')],
          [
            'Source',
            source?.name && (
              <RefLink
                connectionID={connectionID}
                kind={source.kind}
                name={source.name}
                namespace={source.namespace ?? namespace}
                home={namespace}
                showKind
              />
            ),
          ],
          [
            'Helm chart',
            chartName && (
              <RefLink connectionID={connectionID} kind="HelmChart" name={chartName} namespace={chartNamespace} home={namespace} />
            ),
          ],
        ]}
      />
      <FieldSection
        title="Release"
        rows={[
          ['Name', release?.name ?? spec?.releaseName],
          ['Namespace', release?.namespace ?? spec?.targetNamespace],
          ['Revision', release?.version],
          ['Chart version', release?.chartVersion],
          ['App version', release?.appVersion],
          ['Helm status', release?.status],
          ['Deployed', timeAgo(release?.lastDeployed)],
          ['Attempted', status?.lastAttemptedRevision !== release?.chartVersion && status?.lastAttemptedRevision],
          ['Install failures', status?.installFailures || undefined],
          ['Upgrade failures', status?.upgradeFailures || undefined],
        ]}
      />
      <FieldSection
        title="Behaviour"
        rows={[
          ['Drift detection', spec?.driftDetection?.mode],
          ['Install retries', spec?.install?.remediation?.retries],
          ['Upgrade retries', spec?.upgrade?.remediation?.retries],
          ['Service account', spec?.serviceAccountName],
          ['Remote cluster', spec?.kubeConfig?.secretRef?.name],
          ['Timeout', spec?.timeout],
        ]}
      />
      {!!valuesFrom?.length && (
        <Section title="Values from">
          <RefList connectionID={connectionID} refs={valuesFrom.map((ref) => ({ ...ref, namespace }))} home={namespace} />
        </Section>
      )}
      {!!spec?.dependsOn?.length && (
        <Section title="Depends on">
          <RefList connectionID={connectionID} refs={spec.dependsOn} kind="HelmRelease" home={namespace} />
        </Section>
      )}
    </>
  );
};
