import React from 'react';

import { formatBytes, shortRevision, timeAgo, type FluxObject } from '../../flux';
import { FieldSection, RefLink, flag, type DetailProps, type Field } from './parts';

/** The reference a Git or OCI source tracks, in the order Flux resolves them. */
const refOf = (ref: Record<string, string> | undefined): string | undefined => {
  if (!ref) return undefined;
  const key = ['commit', 'digest', 'name', 'semver', 'tag', 'branch'].find((k) => ref[k]);
  return key ? `${key} ${ref[key]}` : undefined;
};

const secretRow = ({ connectionID, object }: DetailProps, label = 'Secret'): Field => {
  const name = object.spec?.secretRef?.name as string | undefined;
  const namespace = object.metadata?.namespace ?? '';
  return [label, name && <RefLink connectionID={connectionID} kind="Secret" name={name} namespace={namespace} />];
};

/** What the source last fetched and is serving to the objects that use it. */
const Artifact: React.FC<{ object: FluxObject }> = ({ object }) => {
  const artifact = object.status?.artifact;
  return (
    <FieldSection
      title="Artifact"
      rows={[
        ['Revision', artifact?.revision && shortRevision(artifact.revision)],
        ['Fetched', timeAgo(artifact?.lastUpdateTime)],
        ['Size', formatBytes(artifact?.size)],
      ]}
    />
  );
};

export const GitRepositoryDetails: React.FC<DetailProps> = (props) => {
  const { spec } = props.object;
  return (
    <>
      <FieldSection
        title="Repository"
        rows={[
          ['URL', spec?.url],
          ['Tracking', refOf(spec?.ref) ?? 'branch master'],
          secretRow(props),
          ['Provider', spec?.provider],
          ['Submodules', flag(spec?.recurseSubmodules)],
          ['Verify', spec?.verify && `${spec.verify.mode ?? 'HEAD'} signature`],
          ['Ignore', spec?.ignore && 'custom rules'],
          ['Timeout', spec?.timeout],
        ]}
      />
      <Artifact object={props.object} />
    </>
  );
};

export const OCIRepositoryDetails: React.FC<DetailProps> = (props) => {
  const { spec, status } = props.object;
  const metadata = status?.artifact?.metadata as Record<string, string> | undefined;
  return (
    <>
      <FieldSection
        title="Repository"
        rows={[
          ['URL', spec?.url],
          ['Tracking', refOf(spec?.ref) ?? 'tag latest'],
          ['Provider', spec?.provider],
          secretRow(props),
          ['Verify', spec?.verify?.provider],
          ['Layer', spec?.layerSelector?.mediaType],
          ['Insecure', flag(spec?.insecure)],
          ['Timeout', spec?.timeout],
        ]}
      />
      <Artifact object={props.object} />
      <FieldSection
        title="Built from"
        rows={[
          ['Source', metadata?.['org.opencontainers.image.source']],
          ['Revision', metadata?.['org.opencontainers.image.revision']],
          ['Created', metadata?.['org.opencontainers.image.created']],
        ]}
      />
    </>
  );
};

export const HelmRepositoryDetails: React.FC<DetailProps> = (props) => {
  const { spec } = props.object;
  const oci = spec?.type === 'oci';
  return (
    <>
      <FieldSection
        title="Repository"
        rows={[
          ['URL', spec?.url],
          ['Type', oci ? 'OCI registry' : 'HTTP index'],
          ['Provider', spec?.provider],
          secretRow(props),
          ['Pass credentials', flag(spec?.passCredentials)],
          ['Insecure', flag(spec?.insecure)],
          ['Timeout', spec?.timeout],
        ]}
      />
      {/* OCI repositories are only read by charts; there is no index to fetch. */}
      {!oci && <Artifact object={props.object} />}
    </>
  );
};

export const HelmChartDetails: React.FC<DetailProps> = (props) => {
  const { connectionID, object } = props;
  const { spec, status } = object;
  const namespace = object.metadata?.namespace ?? '';
  const source = spec?.sourceRef;
  return (
    <>
      <FieldSection
        title="Chart"
        rows={[
          ['Chart', spec?.chart],
          ['Version', spec?.version ?? '*'],
          [
            'Source',
            source?.name && (
              <RefLink connectionID={connectionID} kind={source.kind} name={source.name} namespace={namespace} showKind />
            ),
          ],
          ['Values files', (spec?.valuesFiles as string[] | undefined)?.join(', ')],
          ['Rebuild on', spec?.reconcileStrategy],
          ['Verify', spec?.verify?.provider],
        ]}
      />
      <Artifact object={object} />
      <FieldSection
        title="Observed"
        rows={[
          ['Chart name', status?.observedChartName],
          ['Source revision', status?.observedSourceArtifactRevision && shortRevision(status.observedSourceArtifactRevision)],
        ]}
      />
    </>
  );
};

export const BucketDetails: React.FC<DetailProps> = (props) => {
  const { spec } = props.object;
  return (
    <>
      <FieldSection
        title="Bucket"
        rows={[
          ['Bucket', spec?.bucketName],
          ['Endpoint', spec?.endpoint],
          ['Provider', spec?.provider],
          ['Region', spec?.region],
          ['Prefix', spec?.prefix],
          secretRow(props),
          ['Insecure', flag(spec?.insecure)],
          ['Timeout', spec?.timeout],
        ]}
      />
      <Artifact object={props.object} />
    </>
  );
};
