import { PluginWindow } from '@omniviewdev/runtime';
import type { ExtensionPointSettings, ExtensionRegistration } from '@omniviewdev/runtime';
import FluxResourceSidebar from './components/FluxResourceSidebar';

const extensionPoints: ExtensionPointSettings[] = [];

export const plugin = new PluginWindow()
  .registerExtensionPoints(extensionPoints);

/**
 * Flux CRD resource keys that this plugin provides sidebar components for.
 * Groups ending in .fluxcd.io are NOT normalized by the k8s discovery provider.
 */
const FLUX_RESOURCE_KEYS = [
  // Kustomize controller
  'kustomize.toolkit.fluxcd.io::v1::Kustomization',
  'kustomize.toolkit.fluxcd.io::v1beta2::Kustomization',
  'kustomize.toolkit.fluxcd.io::v1beta1::Kustomization',

  // Source controller
  'source.toolkit.fluxcd.io::v1::GitRepository',
  'source.toolkit.fluxcd.io::v1beta2::GitRepository',
  'source.toolkit.fluxcd.io::v1::HelmRepository',
  'source.toolkit.fluxcd.io::v1beta2::HelmRepository',
  'source.toolkit.fluxcd.io::v1::HelmChart',
  'source.toolkit.fluxcd.io::v1beta2::HelmChart',
  'source.toolkit.fluxcd.io::v1::OCIRepository',
  'source.toolkit.fluxcd.io::v1beta2::OCIRepository',
  'source.toolkit.fluxcd.io::v1beta2::Bucket',

  // Helm controller
  'helm.toolkit.fluxcd.io::v2::HelmRelease',
  'helm.toolkit.fluxcd.io::v2beta2::HelmRelease',
  'helm.toolkit.fluxcd.io::v2beta1::HelmRelease',

  // Notification controller
  'notification.toolkit.fluxcd.io::v1beta3::Alert',
  'notification.toolkit.fluxcd.io::v1beta3::Provider',
  'notification.toolkit.fluxcd.io::v1::Receiver',
  'notification.toolkit.fluxcd.io::v1beta2::Receiver',

  // Image automation controller
  'image.toolkit.fluxcd.io::v1beta2::ImageRepository',
  'image.toolkit.fluxcd.io::v1beta2::ImagePolicy',
  'image.toolkit.fluxcd.io::v1beta2::ImageUpdateAutomation',
  'image.toolkit.fluxcd.io::v1beta1::ImageRepository',
  'image.toolkit.fluxcd.io::v1beta1::ImagePolicy',
  'image.toolkit.fluxcd.io::v1beta1::ImageUpdateAutomation',
];

/**
 * Extension registrations into core extension points.
 * The loader picks these up and calls store.register() for each.
 */
export const extensionRegistrations: ExtensionRegistration[] = [
  {
    extensionPointId: 'omniview/resource/sidebar/infopanel',
    registration: {
      id: 'flux/sidebar/infopanel',
      plugin: 'flux',
      label: 'Flux Resource Sidebar',
      description: 'Rich sidebar view for Flux CD resources',
      component: FluxResourceSidebar as any,
      meta: { resourceKeys: FLUX_RESOURCE_KEYS },
    },
  },
];
