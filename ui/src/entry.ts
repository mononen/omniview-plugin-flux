import { createElement } from 'react';
import { LuGitBranch } from 'react-icons/lu';
import { PluginWindow } from '@omniviewdev/runtime';
import type { ExtensionPointSettings, ExtensionRegistration } from '@omniviewdev/runtime';

import FluxResourceSidebar from './components/FluxResourceSidebar';
import FluxPage, { FLUX_SUB_PAGES } from './components/FluxPage';
import { FLUX_RESOURCE_KEYS, KUBERNETES_PLUGIN } from './flux';

const extensionPoints: ExtensionPointSettings[] = [];

// Flux has no pages of its own: everything it provides is contributed into
// the Kubernetes plugin's cluster view.
export const plugin = new PluginWindow().registerExtensionPoints(extensionPoints);

/**
 * Extension registrations into core extension points.
 * The loader picks these up and calls store.register() for each.
 */
export const extensionRegistrations: ExtensionRegistration<any>[] = [
  // The host matches side panels on exactly one { pluginId, resourceKey } pair,
  // so each served Flux version gets its own registration.
  ...FLUX_RESOURCE_KEYS.map((resourceKey) => ({
    extensionPointId: 'omniview/resource/sidebar/infopanel',
    registration: {
      id: `sidebar/${resourceKey}`,
      label: 'Flux resource overview',
      value: FluxResourceSidebar,
      meta: { pluginId: KUBERNETES_PLUGIN, resourceKey },
    },
  })),
  // A page in the cluster's side navigation, next to Dashboard: the overview,
  // with one sub-entry per commonly used kind.
  {
    extensionPointId: 'kubernetes/cluster/page',
    registration: {
      id: 'page/flux',
      label: 'Flux',
      value: FluxPage,
      meta: {
        path: 'flux',
        icon: createElement(LuGitBranch),
        children: FLUX_SUB_PAGES.map(({ path, label }) => ({ path, label })),
      },
    },
  },
];
