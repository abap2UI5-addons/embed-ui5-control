# abap2UI5 embed control

Home of **[`@abap2ui5/embed-control`](packages/embed-control)**:
a UI5 custom control, published on npm, that runs an
[abap2UI5](https://github.com/abap2UI5/abap2UI5) app inside any UI5 app -
and its **[examples](examples)**: a UI5 freestyle app, Fiori elements apps
for OData V4 and V2 (with the RAP service the latter reads) and a UI
Integration Card for SAP Build Work Zone, delivered on the branches
`standard` and `rap` to clone or to pull with abapGit.

```xml
<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:z2ui5="z2ui5.embed">
  <z2ui5:Container app="Z2UI5_CL_UI5_APP_HI_WORLD" height="400px"/>
</mvc:View>
```

How to use the package is in its [README](packages/embed-control/README.md)
(also what npm shows), how to run and install the examples in
[`examples/README.md`](examples/README.md) (also the README of the
branches). This file is about working on them.

## Layout

```
packages/embed-control/        the npm package - a UI5 CLI project of type "module"
  src/                           the control and its stylesheet
examples/                      the examples, one npm workspace with the package
  freestyle/                     a UI5 freestyle app
  fiori-elements/                Fiori elements for OData V4, on a mock service
  fiori-elements-v2/             Fiori elements for OData V2, on a mock of the
    abap/                          RAP service here, with the apps it starts
  card/                          a UI Integration Card for SAP Build Work Zone
  README.md                      the README of the examples and of the branches
scripts/                       the consumer and release checks, the build of the
                               branches, the local backend
test/                          the Node tests of the control
  e2e/                           the Playwright tests of the examples
```

## The frontend is not here

The control is a thin wrapper around the `z2ui5` UI5 component - the whole
abap2UI5 frontend. The package does not carry it: the control loads it at run
time from the abap2UI5 service it talks to anyway
(`GET /sap/bc/z2ui5?z2ui5-bundle`). Every abap2UI5 installation embeds its
frontend in the ABAP classes generated from
[`app/webapp`](https://github.com/abap2UI5/abap2UI5/tree/main/app/webapp), so
the frontend always has the version of the backend it runs against, and
nothing here has to follow abap2UI5's releases.

A change the control needs from the frontend (an embedded mode, a new
component setting, ...) is a pull request to abap2UI5; the control can rely
on it once the abap2UI5 installations it targets have it.

## The examples

`examples/` are four UI5 projects in the workspace. Each names
`@abap2ui5/embed-control` by a version range like any app; npm links
`packages/embed-control` of the same commit into the root `node_modules` for
all of them, as long as the range covers its version (CI fails otherwise -
see [Publish](#publish)). So every change to the control is built into the
examples, run in a browser and built into the branches before it is
published, and an example can use a new feature of the control in the same
pull request.

```bash
npm ci
npm run start-local              # the freestyle example, against abap2UI5 in Node - nothing else to install
npm run start-local:fe           # the same for start-local:fe-v2 and start-local:card
```

`npm run start-local` is the whole local setup in one command: it starts
abap2UI5 transpiled to JavaScript on `http://localhost:3000`
([`@abap2ui5/node-runtime`](https://www.npmjs.com/package/@abap2ui5/node-runtime),
a devDependency of the workspace; `scripts/backend.mjs`) and then the
example's dev server with `ui5-local.yaml`. A backend already answering on
port 3000 - `npm run backend` in a terminal of its own, or `npm run express`
in an abap2UI5 checkout - is used instead. `npm start`, `start:fe`,
`start:fe-v2` and `start:card` go to the SAP system in the example's
`ui5.yaml`.

It runs in a GitHub Codespace as well: open the forwarded port 8080. The
port forwarding of a codespace rewrites `Origin` and `X-Forwarded-Host`, and
abap2UI5's CSRF check would reject every roundtrip ("CSRF validation
failed - cross-origin request rejected"); in a codespace (`CODESPACES=true`)
the local backend drops those headers before abap2UI5 reads them. Keep the
codespace's ports private.

### The branches

`standard` and `rap` are what the examples' README and abapGit use:
`standard` the four examples as UI5 projects and the freestyle app as the
BSP `Z2UI5_HOST`, `rap` the RAP service of `fiori-elements-v2` and that app
as the BSP `Z2UI5_HOST_FE`. `scripts/build-bsp.mjs` builds them with
abap2UI5's BSP tools, and `deliver.yaml` writes each as one commit on top of
`main` on every push to it, after the whole CI - never change a branch by
hand. A branch carries the control of the `main` it was built from; its
`VERSION` file names the commit and the version.

## Development

| Command | |
|---|---|
| `npm run lint` / `npm run format:check` | ESLint and Prettier |
| `npm test` | the Node tests of the control - its module with stubs for UI5, no browser, no backend |
| `npm run pack:check` | what `npm publish` would put into the package |
| `npm run consumer:check` | the packed package, installed into an app of its own and built with UI5 CLI 3 and 4 |
| `npm run abaplint` | the ABAP of `examples/fiori-elements-v2/abap` against abap2UI5's main (`abaplint.jsonc`) |
| `npm run build` | `ui5 build` of the examples - the control lands in `dist/thirdparty/z2ui5/embed/` |
| `ABAP2UI5_DIR=../abap2UI5 npm run bsp` | the branches in `out/standard/` and `out/rap/`, built with abap2UI5's BSP tools and checked with its page invariants |
| `npm run backend` | abap2UI5 in Node on port 3000 (`scripts/backend.mjs`), for the e2e tests or an example started with its own `npm run start-local` |
| `npx playwright test` | the examples in a browser against the backend on port 3000 - the freestyle one on UI5 1.136 and 1.71, the Fiori elements ones on SAPUI5 1.136, the card on OpenUI5 1.136 (`PW_CHROMIUM_PATH` for an installed Chromium) |

CI (`.github/workflows/ci.yaml`) runs all of them on every pull request -
the e2e tests against an abap2UI5 backend built from
abap2UI5's default branch, and against 1.145.0, the backend floor the
package records. So it tests what a user gets: this control, these examples
and the current abap2UI5. Because abap2UI5 moves on without a pull request
here, CI also runs every night.

## Publish

A published npm version can never be replaced, so a release is a deliberate
step:

1. Bump `version` in `packages/embed-control/package.json`. When the new
   version leaves the examples' range - a new 0.x minor leaves `^0.y.z` -
   raise it in every example with it, and run `npm install`:

   ```bash
   npm pkg set "dependencies.@abap2ui5/embed-control=^<version>" \
     --workspace examples/freestyle --workspace examples/fiori-elements \
     --workspace examples/fiori-elements-v2 --workspace examples/card
   npm install
   ```
2. In [`packages/embed-control/CHANGELOG.md`](packages/embed-control/CHANGELOG.md),
   move the entries under `## Unreleased` under `## <version>`.
3. Merge, then create a GitHub release with the tag `v<version>`.

`publish.yaml` runs the whole CI on that commit, the examples included, checks that
tag, version, changelog and repository agree (`scripts/release-check.mjs`),
and publishes by trusted publishing - no token, with npm provenance. Run by
hand (Actions → publish → Run workflow), it is a dry run: everything except
the publish.

The branches carry the control of `main` from the merge on; someone who
clones `standard` and runs `npm install` gets the published version their
range names - so release right after merging a version bump that moves the
range.

### The first version

npm sets up trusted publishing only for a package that exists, so the first
version goes out by hand, once - by a maintainer of the npm organisation
`abap2ui5`, from a clean checkout of `main` whose CI is green:

```bash
npm ci
node scripts/release-check.mjs v0.1.0   # tag, version and changelog agree
npm run pack:check                      # README, LICENSE, package.json, ui5.yaml, src/
npm login
npm publish --workspace packages/embed-control --access public
```

Then:

1. npmjs.com → `@abap2ui5/embed-control` → Settings → Trusted Publisher →
   GitHub Actions: organisation `abap2UI5-addons`, repository `embed-ui5-control`,
   workflow `publish.yaml`, no environment. From now on `publish.yaml`
   publishes.
2. Create the GitHub release `v0.1.0` on that commit. `publish.yaml` finds
   0.1.0 on the registry and publishes nothing.

## Next steps

What is still open is tracked in abap2UI5 as the
[embed-as-reuse-component](https://github.com/abap2UI5/abap2UI5/blob/main/backlog/items/embed-as-reuse-component.md)
backlog item: an embedded mode of the frontend that leaves page-wide things
to the host app. The first part is there - the bundle marks the component
embedded, and it leaves the URL hash alone (abap2UI5 1.146.0), which
is what the Fiori elements examples need. From 1.147.0 on the frontend leaves
the busy indicator, the title, the favicon and the "leave page?" prompt to
the host as well, and its root is a `sap.m.NavContainer` instead of the
full-screen `sap.m.App`; nothing in the control had to change for it.

## Contributing

Pull requests against `main` are welcome - see [CONTRIBUTING.md](CONTRIBUTING.md)
for where a change goes and what to run before you push. For bug reports or feature requests, open an issue here (the control, the
examples) or in
[abap2UI5/abap2UI5](https://github.com/abap2UI5/abap2UI5/issues) (the
frontend, the backend).

## License

MIT
