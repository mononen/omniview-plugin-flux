PLUGIN_ID := flux
# The plugin is UI-only, so every platform gets the same archive.
PLATFORMS ?= darwin_arm64 linux_amd64

.PHONY: init build package clean

init:
	cd ui && pnpm --ignore-workspace install --frozen-lockfile

build: init
	cd ui && pnpm build

# Produces dist/<id>-<os>_<arch>.tar.gz, the names publish-plugin-action uploads.
# Layout is what the app installs: plugin.yaml and assets/ at the archive root.
# The empty bin/ is only there because the marketplace validator requires one.
package: build
	rm -rf dist
	mkdir -p dist/pkg/assets dist/pkg/bin
	cp plugin.yaml dist/pkg/
	cp -R ui/dist/assets/. dist/pkg/assets/
	for platform in $(PLATFORMS); do \
		COPYFILE_DISABLE=1 tar -czf dist/$(PLUGIN_ID)-$$platform.tar.gz -C dist/pkg plugin.yaml assets bin; \
	done
	rm -rf dist/pkg

clean:
	rm -rf dist ui/dist
