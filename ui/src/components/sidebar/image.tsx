import React from 'react';

import { timeAgo } from '../../flux';
import { ChipList, FieldSection, RefLink, Section, type DetailProps } from './parts';

export const ImageRepositoryDetails: React.FC<DetailProps> = ({ connectionID, object }) => {
  const { spec, status } = object;
  const namespace = object.metadata?.namespace ?? '';
  const scan = status?.lastScanResult;
  const latestTags = scan?.latestTags as string[] | undefined;

  return (
    <>
      <FieldSection
        title="Image"
        rows={[
          ['Image', status?.canonicalImageName ?? spec?.image],
          ['Provider', spec?.provider],
          [
            'Secret',
            spec?.secretRef?.name && (
              <RefLink connectionID={connectionID} kind="Secret" name={spec.secretRef.name} namespace={namespace} />
            ),
          ],
          ['Exclusions', (spec?.exclusionList as string[] | undefined)?.length],
        ]}
      />
      <FieldSection title="Last scan" rows={[['Tags found', scan?.tagCount], ['Scanned', timeAgo(scan?.scanTime)]]} />
      {!!latestTags?.length && (
        <Section title="Latest tags">
          <ChipList values={latestTags} />
        </Section>
      )}
    </>
  );
};

/** The rule a policy picks a tag by, e.g. `semver >=1.0.0`. */
const policyRule = (policy: Record<string, any> | undefined): string | undefined => {
  if (policy?.semver) return `semver ${policy.semver.range}`;
  if (policy?.alphabetical) return `alphabetical, ${policy.alphabetical.order ?? 'asc'}`;
  if (policy?.numerical) return `numerical, ${policy.numerical.order ?? 'asc'}`;
  return undefined;
};

export const ImagePolicyDetails: React.FC<DetailProps> = ({ connectionID, object }) => {
  const { spec, status } = object;
  const namespace = object.metadata?.namespace ?? '';
  const repository = spec?.imageRepositoryRef;
  const latest = status?.latestRef;

  return (
    <>
      <FieldSection
        title="Policy"
        rows={[
          [
            'Repository',
            repository?.name && (
              <RefLink
                connectionID={connectionID}
                kind="ImageRepository"
                name={repository.name}
                namespace={repository.namespace ?? namespace}
                home={namespace}
              />
            ),
          ],
          ['Select by', policyRule(spec?.policy)],
          ['Tag filter', spec?.filterTags?.pattern],
          ['Extract', spec?.filterTags?.extract],
          ['Digest', spec?.digestReflectionPolicy],
        ]}
      />
      <FieldSection
        title="Selected image"
        rows={[
          ['Latest', latest ? `${latest.name}:${latest.tag}` : status?.latestImage],
          ['Digest', latest?.digest],
          ['Previous', status?.observedPreviousRef ? `${status.observedPreviousRef.name}:${status.observedPreviousRef.tag}` : status?.observedPreviousImage],
        ]}
      />
    </>
  );
};

export const ImageUpdateAutomationDetails: React.FC<DetailProps> = ({ connectionID, object }) => {
  const { spec, status } = object;
  const namespace = object.metadata?.namespace ?? '';
  const source = spec?.sourceRef;
  const author = spec?.git?.commit?.author;
  const policies = Object.keys((status?.observedPolicies as Record<string, unknown> | undefined) ?? {});

  return (
    <>
      <FieldSection
        title="Git"
        rows={[
          [
            'Repository',
            source?.name && (
              <RefLink
                connectionID={connectionID}
                kind={source.kind ?? 'GitRepository'}
                name={source.name}
                namespace={source.namespace ?? namespace}
                home={namespace}
              />
            ),
          ],
          ['Checkout branch', spec?.git?.checkout?.ref?.branch],
          ['Push branch', spec?.git?.push?.branch],
          ['Author', author && `${author.name ?? ''} <${author.email ?? ''}>`],
          ['Update path', spec?.update?.path],
          ['Strategy', spec?.update?.strategy],
        ]}
      />
      <FieldSection
        title="Last run"
        rows={[
          ['Ran', timeAgo(status?.lastAutomationRunTime)],
          ['Pushed commit', (status?.lastPushCommit as string | undefined)?.slice(0, 12)],
          ['Pushed', timeAgo(status?.lastPushTime)],
        ]}
      />
      {policies.length > 0 && (
        <Section title="Policies applied">
          <ChipList values={policies} />
        </Section>
      )}
    </>
  );
};
