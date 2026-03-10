init:
	cd ui && pnpm --ignore-workspace install

build: init
	cd ui && pnpm build
	mkdir -p dist/ui
	cp plugin.yaml dist/
	cp -rv ui/dist/* dist/ui/

clean:
	rm -rf dist ui/dist
