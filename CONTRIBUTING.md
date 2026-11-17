# Contributing

Pull requests against `main` are welcome - the control, its examples, their
tests, the build of the branches and the READMEs live here.

| You want to … | Go to |
|---|---|
| change the control | here, `packages/embed-control` - with its changelog entry under "Unreleased" |
| change an example - `freestyle/`, `fiori-elements/`, `fiori-elements-v2/`, `card/` - or its README | here, `examples/` |
| change the RAP service and the abap2UI5 apps of the branch `rap` | here, `examples/fiori-elements-v2/abap` |
| change how the branches are built | here, `scripts/build-bsp.mjs` and `.github/workflows/deliver.yaml` |
| change the abap2UI5 frontend, `?z2ui5-bundle`, the BSP tooling | [abap2UI5/abap2UI5](https://github.com/abap2UI5/abap2UI5), `app/webapp`, `z2ui5_cl_ui5_http_handler`, `tools/` |

**Never against `standard` or `rap`.** The `deliver` workflow rewrites both
on every push to `main`, as one commit on top of it built from `main`'s
content - a commit made on a branch is gone with the next delivery.

A change to the control and the change to an example that uses it go into
one pull request: the examples run the control of the same commit.

Before you push: `npm ci`, `npm run lint`, `npm run format:check`,
`npm test`, `npm run abaplint`, `npm run build`, and - with an abap2UI5
backend on port 3000 (`npm run backend`) - `npx playwright test`. CI runs the
same, and `npm run pack:check`, `npm run consumer:check` and `npm run bsp`.
