# AGENTS.md — AI Assistant Guide for the abap2UI5 embed control

> This file follows the cross-tool AGENTS.md convention and is the single
> agent instruction file of this repository. `CLAUDE.md` next to it is a
> pointer at this file, nothing more.

## What this repository is

The source of the npm package **`@abap2ui5/embed-control`**
(`packages/embed-control`): the UI5 custom control
`z2ui5.embed.Container`, which runs an abap2UI5 app - an ABAP class
implementing `z2ui5_if_app` - inside any UI5 app. And its examples
(`examples/`): a UI5 freestyle app, Fiori elements apps for OData V4 and V2
(with the RAP service the latter reads) and a UI Integration Card for SAP
Build Work Zone, their Playwright tests (`test/e2e/`) and the build of the
branches `standard` and `rap` that deliver them (`scripts/build-bsp.mjs`,
written by the `deliver` workflow). The examples lived in
abap2UI5-addons/embed-ui5-control until they moved here, with their history.

**Language:** English for all code, comments, docs, commit messages, PRs.

## The package is the control and nothing else

The abap2UI5 frontend - the `z2ui5` UI5 component the control wraps - is
**not** part of this repository or the package. The control loads it at run
time from the abap2UI5 service it talks to
(`GET <endpoint>?z2ui5-bundle`, answered by `z2ui5_cl_ui5_http_handler` from
the generated `z2ui5_cl_ui5f_preload`; its only source is
[abap2UI5 `bundle/webapp`](https://github.com/abap2UI5/abap2UI5/tree/main/bundle/webapp)).

- Never vendor, copy or pin the frontend here, and add nothing to the package
  that has to follow abap2UI5's releases.
- A change the control needs from the frontend (an embedded mode, a new
  `componentData` setting, ...) is a pull request to abap2UI5. Do not work
  around a frontend limitation in the control when the fix belongs there -
  say so instead.
- Nothing is deployed to an ABAP system for the control: it is a plain
  module (no component, no library, no manifest), so it never takes an app
  index entry, and any number of apps carry their own copy.

## Layout

| Path | |
|---|---|
| `packages/embed-control/src/` | The control (`Container.js`) - nothing else since 0.4.0 |
| `packages/embed-control/ui5.yaml` | UI5 CLI project of type `module`: `/thirdparty/z2ui5/embed/` → `src/` |
| `packages/embed-control/README.md` | The consumer documentation - what npm shows |
| `packages/embed-control/CHANGELOG.md` | Every release; the publish checks it |
| `examples/freestyle/` | The freestyle example: a plain UI5 app, `includeDependency` and the `z2ui5.embed` resourceRoot, `ui5-middleware-simpleproxy` to the backend - `ui5.yaml` to an SAP system (`npm start`), `ui5-local.yaml` to abap2UI5 in Node on `localhost:3000` (`npm run start-local`, what the e2e tests use), `ui5-1.71.yaml` for the tests only. Delivered as `freestyle/` and as the BSP - its README is written for both places |
| `examples/fiori-elements/` | The Fiori elements example: SAPUI5, list report and object page on a mock OData V4 service (`@sap-ux/ui5-middleware-fe-mockserver`, `webapp/localService/`), the control in two custom sections of the object page, each its own session (`webapp/ext/`) |
| `examples/fiori-elements-v2/` | The Fiori elements example for OData V2: SAPUI5, list report and object page (`sap.suite.ui.generic.template`) on a mock of the RAP service in `abap/`, under the paths the binding has in a system (`webapp/localService/`), the control in two view extensions, after the facets `General` and `Language` (`webapp/ext/`). Delivered on `standard`, and on `rap` as BSP with the service |
| `examples/fiori-elements-v2/abap/` | The RAP service of that example and the two abap2UI5 apps it starts on a system, in abapGit's format: CDS view entity on `T005T`, metadata extension, service definition, OData V2 binding, `Z2UI5_CL_EMBED_COUNTRY`, `Z2UI5_CL_EMBED_LANGUAGES`. The successor of abap2UI5-addons/fiori-elements-integration. Delivered as `src/01` of `rap` |
| `examples/card/` | The card example: a UI Integration Card of type `Component`, generic - the class it runs is a card parameter, the backend a card destination the host resolves (`webapp/Component.js`, `onCardReady`) - with `webapp/dt/Configuration.js` for the host's configuration editor and a preview page in `webapp/test/` that `ui5 build` leaves out |
| `examples/README.md` | The README of the examples - and, with a first line of its own, of both branches |
| `test/container.test.mjs` | The Node tests of the control: its module run with stubs for UI5 - no browser, no backend (`npm test`) |
| `test/e2e/` | Playwright tests of the examples, one spec file each (`playwright.config.mjs`) |
| `scripts/consumer-check.mjs` | The packed package in an app of its own, built with UI5 CLI 3 and 4 |
| `scripts/release-check.mjs` | The gate before `npm publish`: tag, version, changelog and repository agree |
| `scripts/build-bsp.mjs` | The branches, built with abap2UI5's tools into `out/standard/` and `out/rap/` |
| `scripts/backend.mjs`, `scripts/start-local.mjs` | The local setup: `npm run backend` serves abap2UI5 from `@abap2ui5/node-runtime` (a root devDependency) on `localhost:3000`; `npm run start-local[:fe\|:fe-v2\|:card]` at the root starts it - unless port 3000 answers already - and then the example's own `start-local`. Not delivered: an example's README runs the backend as its own folder |
| `abaplint.jsonc` | abaplint over the examples' ABAP, against abap2UI5's main (`npm run abaplint`) |
| `.github/workflows/` | `ci.yaml` (checks, consumer builds, abaplint, the examples' builds, the branch build, e2e against abap2UI5 main and the backend floor - on every pull request, every night, before every delivery and every publish), `deliver.yaml` (on every push to `main`: the same CI, then the branches), `publish.yaml` (npm, on a GitHub release) |

## The examples take the control of the same commit

The workspace is `packages/*` and the four examples. Every example names
`@abap2ui5/embed-control` by a version range in its `package.json`, like any
app - which is what a branch carries and what `npm install` resolves from the
registry after a clone of `standard`. Here, npm links
`packages/embed-control` into the root `node_modules` instead, as long as the
range covers its version.

- **Never copy the control into an example**, never point an example at it
  by a path (`file:`, `workspace:`) - the branches carry the examples'
  `package.json` as it is, and a clone of `standard` has no `packages/`.
- **One copy, at the root, and it is the workspace package.** Keep the
  ranges of all examples the same, and covering the version of
  `packages/embed-control`. `ci.yaml` (job `check`) and `build-bsp.mjs`
  fail when `node_modules/@abap2ui5/embed-control` is anything but that
  package, or when an example has a copy of its own.
- **A control change and the example that uses it go into one pull
  request.** The examples run the control of the commit in the e2e tests
  and in the branches.
- **Never add a test app or a second copy of an example.** A test of the
  control that renders or talks to a backend is a test in `test/e2e/`,
  against one of the examples; a new case of the control's own decisions -
  the endpoint check and what is requested, what the component gets, when a
  start happens, is repeated or given up - goes into
  `test/container.test.mjs`, which needs no browser.
- **The floor leg of `ci.yaml` names the Playwright projects** of
  `playwright.config.mjs` and the tag `@after-<floor>`; a renamed project is
  renamed there in the same breath.
- **Nor the abap2UI5 frontend.** The control loads it at run time from the
  abap2UI5 service it talks to (`?z2ui5-bundle`); nothing here pins it, and
  a limitation of the frontend is fixed in abap2UI5, not worked around here.

## Rules for `src/`

- **UI5 1.71 is the floor**, as in abap2UI5. Use no module, class, property or
  enum newer than 1.71, and no `sap/ui/core/Lib` / `sap/ui/core/Element`
  static APIs. What the control uses today and since when:
  `sap/ui/core/Control` and `sap/base/Log` (1.58), renderer `apiVersion: 2`
  (1.67). Everything else - the component, its container - is the bundle's,
  which is held to 1.71 in abap2UI5.
  The e2e tests run the freestyle example on 1.71 too
  (`examples/freestyle/ui5-1.71.yaml`, the `ui5-1.71` Playwright project) -
  a change to `src/` is done when every project of the `e2e` job passes, the
  `fiori-elements` and `fiori-elements-v2` ones included.
- **The control is a shell (0.4.0).** It decides where the bundle may come
  from, loads it, and when an app starts and ends - nothing else. How the app
  is made - its component, its component data, its styles - is the bundle's
  `create( )` (the `z2ui5/embed` module, abap2UI5 `bundle/webapp/core/Embed.js`),
  which gets `{ app, endpoint, params, ownsPage, host }` as the host set them
  and hands back a control to render. Never decide something here that the
  bundle can: it always fits the backend it came from, this package does not.
  No fallback for a bundle without `create( )` - that is an abap2UI5 older
  than the backend floor, and the start fails.
- **The bundle is code - load it only from a path on this server.** Keep the
  `sameOriginUrl` check: the `endpoint` is parsed the way the browser parses
  it (`new URL(endpoint, location.href)`), refused before anything is
  requested unless it is http(s) on the page's origin, and only the resolved
  absolute URL is requested and handed to the frontend - never the raw
  string, which the URL parser rewrites (it drops tabs and line breaks, reads
  a backslash as a slash), and never a bare path, which the browser resolves
  against the page's `<base>` - another host, possibly. A path that begins
  with `//` is refused too: the parser drops `.` and `..` segments, so
  `/.//host` comes out on the page's origin with the path `//host`, another
  host wherever that path is used on its own. Load it with a
  `<script src>`, never with `eval`, `new Function` or `fetch` + inject.
- **One frontend per page, one app per control, one backend session per
  app.** The bundle is loaded once, from the endpoint of the first control
  that starts; a load that fails fails every control that waited for it, and
  is forgotten - the next start asks again. A change of `app`, `endpoint`,
  `params` or `ownsPage` replaces the app, and so does `restart()`; nothing
  is patched into a running one. A start is compared by the resolved
  endpoint and the other values as the host set them. A failed start is
  never repeated by the control itself.
- **`width` and `height` go to the live DOM, not through a rendering**
  (`_setSizeProperty`): a re-rendering of the control re-renders the
  ComponentContainer and with it every control of the app, and UI5 1.71
  rebuilds their DOM - the value the user was typing and the focus went with
  it. A property the ComponentContainer does not draw from is written with
  `setProperty(name, value, true)` and applied to the DOM the same way.
- **Nothing starts for a control nobody sees.** UI5 calls
  `onBeforeRendering` for an invisible control too; the control starts only
  while `visible`, and an app that runs keeps running while it is hidden.
- **Every failure reaches the host asynchronously**, from the promise chain
  after the rendering that started the app - the refused endpoint included.
  Never fire `componentFailed` or `componentCreated` inside a rendering hook.
- **`thirdparty/`, not `resources/`.** An app deployed to an ABAP system
  answers every `<app>/resources/` path from the system's UI5; the control is
  served and built under `thirdparty/z2ui5/embed/` and registered with a
  relative resourceRoot. Keep `ui5.yaml`, the consumer README and the
  examples' manifests in step.
- **`z2ui5/embed` is the backend's module, `z2ui5/embed/` this package's
  namespace.** The bundle defines the module; the control's own modules live
  below it. Never add a module named `z2ui5/embed` here.
- **No stylesheet and no `eval`**: a host with a strict
  Content-Security-Policy must need nothing extra. The renderer sets the
  area's own `position` and `overflow`; a rule for what renders inside it
  comes with the bundle (it was `Container.css` up to 0.3.0), scoped under a
  class the bundle sets.
- A UI5 module id is case-sensitive and a wrong one only fails in the browser
  - run the e2e tests.

## Rules for the package

- **The package's `ui5.yaml` stays at specVersion 3.0.** The consumer's UI5
  CLI reads it, and UI5 CLI 3 refuses a dependency with 4.0.
  `npm run consumer:check` builds the packed package with CLI 3 and 4.
- **The backend floor is abap2UI5 1.150.0** - the release after 1.149.0,
  the first whose bundle has `create( )` (0.4.0 needs it; 0.3.0 is the
  version for 1.145.0 to 1.149.0). The package records it in its
  `package.json` (`"abap2ui5": { "minBackend": "1.150.0" }`, the
  custom-field style `@abap2ui5/node-runtime` uses), the package README
  names it in prose, and the e2e job of `ci.yaml` runs the examples against
  it (the published `@abap2ui5/node-runtime` of that version, read from the
  field by the job `floor`) next to abap2UI5 main - **once it is published**:
  until then the job `floor` says so and the leg is skipped, and the local
  `npm run backend` (the root devDependency `@abap2ui5/node-runtime`, a
  release before it) cannot start the examples either - run
  `npm run express` in an abap2UI5 checkout of `main` instead. Raise the
  floor in package.json and the READMEs - the package's and the examples' -
  when the control starts to rely on something newer, and the devDependency
  with it. A test that needs a newer backend is tagged `@after-<floor>`,
  which the floor leg leaves out. The package has no `engines`: it is a
  browser control without Node code, and a UI5 CLI 3 consumer may install it
  on Node 16 or 18.
- **`ownsPage` is the one flag the control hands over of its own**, and only
  when the host sets it: a host whose page is the control and nothing else
  hands the page to the app - the hash, the title, the favicon, the busy
  indicator, the "leave page?" prompt - and may leave `app` empty, the
  page's URL names the class then. Off by default. Its older name `ownsHash`
  is gone since 0.4.0.

## Rules for the examples

- **UI5 1.71 is the floor of the control.** The freestyle example runs on it
  in the e2e tests (`examples/freestyle/ui5-1.71.yaml`, the `ui5-1.71`
  project); keep
  it free of anything newer.
- **abap2UI5 1.150.0 is the backend floor**, the package's. The READMEs name
  it, and every example's README runs the local backend from
  `@abap2ui5/node-runtime` on npm (its version is the abap2UI5 release). A
  test that needs a newer backend is tagged `@after-<floor>`.
- **`thirdparty/`, not `resources/`.** The control is served and built under
  `thirdparty/z2ui5/embed/` and registered with a relative resourceRoot in
  each manifest - an app deployed to an ABAP system answers every
  `<app>/resources/` path from the system's UI5.
- **An example's README is its README on the branch as well** - write it for
  someone who cloned `standard`, no links into `main`-only files.

## Rules for the examples' dev server

- **`npm start` goes to an SAP system, `npm run start-local` to
  `localhost:3000`** - `ui5.yaml` and `ui5-local.yaml`, the split the SAP
  Fiori tools generate. The two differ in the proxy's `baseUri` only; keep
  everything else in step. The e2e tests serve `ui5-local.yaml`.
- **The system's URL stays in `ui5.yaml`, never in `.env`.**
  `ui5-middleware-simpleproxy` loads `.env` itself, and a value from there
  wins over the YAML - a `UI5_MIDDLEWARE_SIMPLE_PROXY_BASEURI` in `.env`
  would send `start-local` to the system too. `.env` carries the user only.
- **No middleware of our own for abap2UI5's CSRF check.** The standard
  proxy sends `X-Forwarded-Host` (`xfwd`), and abap2UI5 compares the
  browser's `Origin` with it (`check_trust_forwarded_host`, on by default
  in every release the control supports). Do not bring back a middleware
  that drops `Origin`; a proxy that does not send the header is the thing to
  fix.
- **The one exception is a GitHub Codespace, in `scripts/backend.mjs`.**
  The port forwarding of a codespace rewrites `Origin` and
  `X-Forwarded-Host` before the request reaches any of our code, so no
  proxy setting can make them match. With `CODESPACES=true` - and only
  then - the local backend drops `Origin`, `Referer` and
  `X-Forwarded-Host`, and abap2UI5's lenient check lets the request
  through. Outside a codespace the backend is `serve()` as it ships; never
  widen the exception, and never move it into a UI5 middleware.

## The branches

`standard`: `freestyle/`, `fiori-elements/`, `fiori-elements-v2/` and
`card/` of `examples/` as UI5 projects, at the root of the branch, `src/` the freestyle app as the BSP `Z2UI5_HOST`, to
try the control on any abap2UI5 system with a plain abapGit pull. `rap`:
`src/01` the RAP service of `fiori-elements-v2` and the abap2UI5 app it
starts, `src/02` that example as the BSP `Z2UI5_HOST_FE` - one pull on a
system with RAP. `deliver.yaml` builds them with `build-bsp.mjs` and
abap2UI5's BSP tools (its main) and force-pushes each as one commit on top
of `main`.

- **Never commit to a branch, and never open a pull request against one.**
  The next delivery replaces it. Change `main`.
- **No frontend in the trees.** A branch is the example apps, their ABAP and
  the control of `packages/embed-control`, nothing else.
- **A branch is one abapGit repository with its BSP in `src/02`** - where
  abap2UI5's `check-pages` looks for it - and an identity of its own: BSP
  name and ICF nodes (`BRANCHES` in `build-bsp.mjs`), so every branch
  installs next to the other and next to abap2UI5/frontend. A new branch
  goes into `BRANCHES` and into the loop of `deliver.yaml`.
- **`standard` stays installable on every abap2UI5 system.** ABAP that needs
  more - RAP, OData - goes onto a branch of its own, as `rap` does; an
  abapGit pull fails on the objects a system cannot activate.
- **Every example is delivered under its name, as git has it**, without
  what only the tests use (`ui5-1.71.yaml` - `TESTS_ONLY` in
  `build-bsp.mjs`). A new example goes into `EXAMPLES` there, into the
  workspaces of `package.json` and into the checks of `ci.yaml`. Only an app
  whose service a branch brings becomes a BSP: the freestyle app on
  `standard`, the Fiori elements app for OData V2 on `rap`, with its RAP
  service. The one for OData V4 mocks a service no system has, and a card is
  deployed to its host. The BSP of `rap` leaves the mock service out and
  starts `Z2UI5_CL_EMBED_COUNTRY` and `Z2UI5_CL_EMBED_LANGUAGES` instead of
  the hello world app - the one patch of an example (`patch` in `BRANCHES`,
  a list of replacements), because the UI5 project has to run locally too,
  where only abap2UI5's own apps exist.
- **`examples/README.md` is the README of every branch.** It shows the
  package's three places in `freestyle/` and where each example places the
  control, linked on the branch; the build fails when one of them no longer
  has what the README shows (`SHOWN`).
- **The guards in `build-bsp.mjs` are assumptions about abap2UI5's tools**
  (the short texts they write, the page paths bsp_rename touches). One that
  fails means the tools moved: follow them, do not loosen the guard.

## Rules for the examples' ABAP

`examples/fiori-elements-v2/abap/` is ABAP in abapGit's file format, pulled into
systems from the branch `rap`. abaplint (`npm run abaplint`,
`abaplint.jsonc`, in the `check` job) checks it against abap2UI5's main, the
CDS sources included; activation it cannot check.

- **Never hand-write the metadata sidecar of an object type nobody has
  exported from a real system.** The sidecars here follow the ones
  abap2UI5-addons/fiori-elements-integration exported (DDLS, DDLX, SRVD,
  SRVB, CLAS); a new object type - a table, a behavior definition - is
  created in a system once and committed as abapGit serializes it.
- **Only DDIC objects every target system has.** `T005T` is on every
  standard ABAP system; ABAP Cloud does not release it.
- **The mock mirrors the service.** `webapp/localService/` answers under the
  paths of the binding, with its entity set, its property names and the
  annotations of the metadata extension. A change to the CDS view, the
  metadata extension or the service definition changes the mock in the same
  commit - the app is tested against the mock only.
- **The app class is built like any abap2UI5 app** - `z2ui5_cl_ui5_view_builder`
  in the house chain layout, lifecycle checks in one IF chain - and only
  with API of the release the READMEs name (1.150.0). The abap2UI5 linter
  (`npx @abap2ui5/linter`) finds the rest.
- Object names stay within 25 characters, the budget of abap2UI5's
  namespace rename.

## Validation

```bash
npm ci
npm run lint && npm run format:check
npm test               # the Node tests of the control (test/), no browser, no backend
npm run pack:check     # package contents: ui5.yaml, src/ and CHANGELOG.md (npm adds README, LICENSE)
npm run consumer:check # the tarball in an app of its own, built with UI5 CLI 3 and 4
npm run abaplint       # the examples' ABAP, against abap2UI5's main
npm run build          # ui5 build of the examples - the control lands in dist/thirdparty/
ABAP2UI5_DIR=../abap2UI5 npm run bsp   # the branches, with abap2UI5's page checks
npx playwright test    # needs an abap2UI5 backend with ?z2ui5-bundle on :3000 - npm run backend
```

All text files are LF-only (`.gitattributes`). The JavaScript, JSON and CSS
files are formatted with Prettier (`.prettierrc`, `npm run format:check`);
the Markdown files are not - Prettier would pad every table to its column
width.

## Publishing

A GitHub release `v<version>` publishes the version in
`packages/embed-control/package.json` - by trusted publishing (OIDC, no
token), after the whole CI passed on that commit (`publish.yaml` calls
`ci.yaml`). The steps are in the README; the one-time setup is in the header
of `publish.yaml`.

- **A version that leaves the examples' range moves the range with it** -
  a new 0.x minor leaves `^0.y.z`. Raise it in every
  `examples/*/package.json` in the same pull request as the version, and run
  `npm install`; otherwise npm takes the control from the registry for the
  examples, and the job `check` fails. Release right after the merge: the
  branches carry the new range from then on.
- **Every release has its section in `packages/embed-control/CHANGELOG.md`**,
  and nothing stays under "Unreleased". `scripts/release-check.mjs` refuses
  the publish otherwise, and a tag that does not name the version.
- **`repository.url` names the repository the workflow runs in** - npm
  refuses the provenance otherwise. A renamed or transferred repository
  needs package.json, the Trusted Publisher entry on npmjs.com and the
  repository check of `deliver.yaml` (job `fan_out`) to follow.
- Running `publish.yaml` by hand is a dry run. Never publish from a
  developer machine except the one-time first version (README, "The first
  version").
