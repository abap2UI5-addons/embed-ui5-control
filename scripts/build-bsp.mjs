// Builds the branches of this repository: the examples in examples/ the way
// apps take @abap2ui5/embed-control from npm - as UI5 projects, and built into
// BSPs to install with abapGit and try the control on a real system. No copy of the
// abap2UI5 frontend anywhere: the control loads it from the system's
// /sap/bc/z2ui5?z2ui5-bundle, as in any other app.
//
//   npm ci && ABAP2UI5_DIR=../abap2UI5 npm run bsp
//
// The trees land in the git-ignored out/<branch>/ and are everything the
// branches carry. out/standard/ - any abap2UI5 system:
//   freestyle/       freestyle/ as git has it, without ui5-1.71.yaml (the
//                    second UI5 release of the e2e tests): a UI5 freestyle
//                    app with the package as an npm dependency
//   fiori-elements/  a Fiori elements app for OData V4 with the control in a
//                    custom section of its object page. No BSP of it - a
//                    Fiori elements app needs its OData service, which the
//                    example mocks and a system does not have
//   fiori-elements-v2/
//                    a Fiori elements app for OData V2 with the control in an
//                    extension of its object page, and in abap/ the RAP
//                    service it reads. Its BSP is on the branch rap, with the
//                    service
//   card/            a UI Integration Card for SAP Build Work Zone that runs
//                    any abap2UI5 app, its `ui5 build` output the card. No
//                    BSP of it either - a card is deployed to its host, not
//                    to the ABAP system
//   src/             the package and the BSP Z2UI5_HOST - what abapGit pulls:
//                    freestyle/webapp plus the control in
//                    thirdparty/z2ui5/embed/, where `ui5 build` puts it in
//                    any app that names the package under includeDependency.
//                    Neither is patched
//   .abapgit.xml, README.md, LICENSE, VERSION
// The examples sit at the root of a branch, without examples/ - a branch is
// what someone clones to try them, and its README is examples/README.md.
// out/rap/ - a system with RAP and OData V2 (SAP S/4HANA 2020 and later):
//   src/01/          fiori-elements-v2/abap: the RAP service of the Fiori
//                    elements app for OData V2 and the abap2UI5 app it
//                    starts, as git has them
//   src/02/          the BSP Z2UI5_HOST_FE: fiori-elements-v2/webapp without
//                    its mock service, the control in thirdparty/z2ui5/embed/
//                    as above - and starting Z2UI5_CL_EMBED_COUNTRY and
//                    Z2UI5_CL_EMBED_LANGUAGES of src/01 instead of the hello
//                    world app, the one patch of an example (the UI5 project
//                    runs locally too, where only abap2UI5's own apps exist)
//   .abapgit.xml, README.md, LICENSE, VERSION
// The deliver workflow runs this on every push to main and writes each tree
// as one commit on top of main to its branch.
//
// The control is packages/embed-control of the same commit: the examples name
// @abap2ui5/embed-control by a range that covers its version, so npm links
// the workspace package into node_modules instead of taking one from the
// registry - and this build refuses anything else. A branch carries the
// control of the main it is built from; VERSION names both. Someone who
// clones a branch and runs npm install gets the package from the registry,
// by the same range.
//
// The BSPs are made by abap2UI5's own BSP tool, @abap2ui5/bsp - the one that
// builds the BSP of its own frontend - taken from the checkout ABAP2UI5_DIR
// names (tools/bsp, in abap2UI5 since 1.149.0):
//   app2bsp         webapp -> the BSP under its own name: the pages, the page
//                   directory, the path mapping, the ui5_ui5 and bsp nodes,
//                   the package's text
//   checkBspFolder  the page invariants, on the result
// Until abap2UI5 1.151.0 this build ran tools/app2bsp/run.js, which writes the
// BSP Z2UI5, renamed it with tools/bsp_rename and checked it with
// tools/check-pages.mjs. 1.151.0 removed check-pages.mjs and gave bsp_rename
// a limit of 11 characters for the name (it derives an ICF handler class
// from it, which a BSP of an app does not have) - Z2UI5_HOST_FE has 13.

import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = join(root, "out");

// the one place of the control in the app - the package serves it there (its
// ui5.yaml) and the app registers it there (its manifest); if either moves,
// this build has to follow instead of delivering a page that finds nothing
const THIRDPARTY = "thirdparty/z2ui5/embed/";

// The examples, delivered under their names, without what of them only the
// tests use.
const EXAMPLES = ["freestyle", "fiori-elements", "fiori-elements-v2", "card"];
const TESTS_ONLY = { freestyle: ["ui5-1.71.yaml"] };

// What README.md shows of the examples besides the three places
// every one of them takes the package in (package.json, ui5.yaml,
// manifest.json - checked for all): where each places the control. If one of
// them moves, the README points at nothing - so the build fails instead.
const SHOWN = {
  freestyle: [["webapp/view/Main.view.xml", 'xmlns:z2ui5="z2ui5.embed"']],
  "fiori-elements": [
    ["webapp/manifest.json", '"template": "demo.fe.ext.Abap2UI5Section"'],
    ["webapp/ext/Abap2UI5Section.fragment.xml", 'xmlns:z2ui5="z2ui5.embed"'],
  ],
  "fiori-elements-v2": [
    ["webapp/manifest.json", '"AfterFacet|Countries|General"'],
    ["webapp/manifest.json", '"AfterFacet|Countries|Language"'],
    ["webapp/manifest.json", '"/sap/opu/odata/sap/Z2UI5_UI_EMBED_COUNTRY_O2/"'],
    ["webapp/ext/Abap2UI5Section.fragment.xml", 'xmlns:z2ui5="z2ui5.embed"'],
    ["abap/z2ui5_ui_embed_country.srvd.srvdsrv", "as Countries"],
    ["abap/z2ui5_cl_embed_country.clas.abap", "t_comp_params"],
  ],
  card: [
    ["webapp/manifest.json", '"type": "Component"'],
    ["webapp/manifest.json", '"destinations"'],
    ["webapp/Component.js", 'resolveDestination("abap2UI5")'],
    ["webapp/view/Card.view.xml", 'xmlns:z2ui5="z2ui5.embed"'],
  ],
};

// The branches. Each is one abapGit repository with its BSP in src/02; the
// deployment identity of a BSP - its name, the SICF nodes
// /sap/bc/ui5_ui5/sap/<name> and /sap/bc/bsp/sap/<name> - is its own, so it
// installs next to the Z2UI5 BSP of abap2UI5/frontend, and next to the other
// branch, without touching either.
const BRANCHES = {
  standard: {
    examples: EXAMPLES,
    abapgit: "abap2UI5-samples-embed-control",
    devc: "abap2UI5 - embed control example",
    bsp: {
      example: "freestyle",
      name: "z2ui5_host",
      wapa: "abap2UI5 embed control example (generated)",
      devc: "abap2UI5 - embed control example, BSP",
      icf: "abap2UI5 - embed control example",
    },
  },
  rap: {
    examples: [],
    abapgit: "abap2UI5-samples-embed-control-rap",
    devc: "abap2UI5 - embed control example, RAP",
    // the RAP service and the app the BSP starts, as git has them - with
    // their own package.devc.xml, so abapGit makes the subpackage of them
    abap: { example: "fiori-elements-v2", dir: "abap" },
    bsp: {
      example: "fiori-elements-v2",
      name: "z2ui5_host_fe",
      wapa: "abap2UI5 embed control - Fiori elements V2",
      devc: "abap2UI5 - embed control example, Fiori elements BSP",
      icf: "abap2UI5 - embed control, Fiori elements V2",
      // the mock of the RAP service: the system has the real one
      leaveOut: ["localService"],
      // the apps the BSP runs are the ones src/01 brings
      patch: [
        [
          "ext/Abap2UI5Section.js",
          'const APP = "Z2UI5_CL_UI5_APP_HI_WORLD";',
          'const APP = "Z2UI5_CL_EMBED_COUNTRY";',
        ],
        [
          "ext/Abap2UI5Section.js",
          'const LANGUAGES_APP = "Z2UI5_CL_UI5_APP_HI_WORLD";',
          'const LANGUAGES_APP = "Z2UI5_CL_EMBED_LANGUAGES";',
        ],
      ],
    },
  },
};

const NAME = "@abap2ui5/embed-control";

const a2 = process.env.ABAP2UI5_DIR && resolve(process.env.ABAP2UI5_DIR);
const BSP_TOOL = "tools/bsp/index.mjs";
if (process.argv.length > 2) {
  console.error("build-bsp: takes no options");
  process.exit(1);
}
if (!a2 || !existsSync(join(a2, BSP_TOOL))) {
  console.error(
    `build-bsp: set ABAP2UI5_DIR to an abap2UI5 checkout with ${BSP_TOOL} ` +
      "(abap2UI5 1.149.0 or later)",
  );
  process.exit(1);
}
const { app2bsp, checkBspFolder } = await import(
  pathToFileURL(join(a2, BSP_TOOL)).href
);
if (typeof app2bsp !== "function" || typeof checkBspFolder !== "function") {
  console.error(`build-bsp: ${BSP_TOOL} exports no app2bsp or checkBspFolder`);
  process.exit(1);
}

const abapgitXml = (name) => `\uFEFF<?xml version="1.0" encoding="utf-8"?>
<asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
 <asx:values>
  <DATA>
   <NAME>${name}</NAME>
   <MASTER_LANGUAGE>E</MASTER_LANGUAGE>
   <STARTING_FOLDER>/src/</STARTING_FOLDER>
   <FOLDER_LOGIC>PREFIX</FOLDER_LOGIC>
  </DATA>
 </asx:values>
</asx:abap>
`;

const packageXml = (text) => `\uFEFF<?xml version="1.0" encoding="utf-8"?>
<abapGit version="v1.0.0" serializer="LCL_OBJECT_DEVC" serializer_version="v1.0.0">
 <asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
  <asx:values>
   <DEVC>
    <CTEXT>${text}</CTEXT>
   </DEVC>
  </asx:values>
 </asx:abap>
</abapGit>
`;

// Every patch below is an assumption about a file this repository or
// abap2UI5's tools write. If one stops holding, carrying on would deliver a
// branch that is consistent with its sources and still wrong - so it fails.
function mustReplace(file, from, to) {
  const text = readFileSync(file, "utf8");
  if (!text.includes(from)) {
    throw new Error(`build-bsp: '${from}' not found in ${file}`);
  }
  writeFileSync(file, text.split(from).join(to));
}
function mustContain(file, text) {
  if (!readFileSync(file, "utf8").includes(text)) {
    throw new Error(`build-bsp: '${text}' not found in ${file}`);
  }
}

// Quiet on success, never on failure: the discarded output is the only thing
// that says WHY a step failed.
function run(command, commandArgs, cwd) {
  try {
    return execFileSync(command, commandArgs, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    process.stderr.write(String(error.stdout ?? ""));
    process.stderr.write(String(error.stderr ?? ""));
    throw error;
  }
}

// An example as git has it - so never a local .env, node_modules or dist/ -
// without what only the tests use
function copyExample(name, dest) {
  const dir = join("examples", name);
  const files = run("git", ["ls-files", "-z", "--", dir], root)
    .split("\0")
    .filter(Boolean);
  if (!files.length) {
    throw new Error(`build-bsp: git has no file in ${dir}/`);
  }
  for (const file of files) {
    const path = relative(dir, file);
    if ((TESTS_ONLY[name] || []).includes(path)) continue;
    mkdirSync(dirname(join(dest, path)), { recursive: true });
    cpSync(join(root, file), join(dest, path));
  }
}

// The places README.md shows of an example, one each
function checkShown(name, dir) {
  const { dependencies = {} } = JSON.parse(
    readFileSync(join(dir, "package.json"), "utf8"),
  );
  if (!dependencies[NAME]) {
    throw new Error(`build-bsp: ${NAME} is no dependency of ${name}/`);
  }
  mustContain(join(dir, "ui5.yaml"), `- "${NAME}"`);
  mustContain(
    join(dir, "webapp", "manifest.json"),
    `"z2ui5.embed": "./${THIRDPARTY}"`,
  );
  for (const [file, text] of SHOWN[name]) mustContain(join(dir, file), text);
}

// The package the way the examples get it: one copy, at the root of the
// workspace, which every example resolves - and that copy is the workspace
// package, linked by npm. A range that no longer covers the version of
// packages/embed-control makes npm take one from the registry instead.
function installedControl() {
  const dir = join(root, "node_modules", NAME);
  if (!existsSync(join(dir, "package.json"))) {
    throw new Error(`build-bsp: ${NAME} is not installed - run npm ci first`);
  }
  if (
    realpathSync(dir) !== realpathSync(join(root, "packages", "embed-control"))
  ) {
    throw new Error(
      `build-bsp: node_modules/${NAME} is not packages/embed-control - ` +
        "the examples' range does not cover its version",
    );
  }
  for (const name of EXAMPLES) {
    if (existsSync(join(root, "examples", name, "node_modules", NAME))) {
      throw new Error(
        `build-bsp: examples/${name}/ has a copy of ${NAME} of its own`,
      );
    }
  }
  const { version } = JSON.parse(
    readFileSync(join(dir, "package.json"), "utf8"),
  );
  return { dir, version };
}

// What the branch is built from - its VERSION file
function commitOf(dir) {
  try {
    return run("git", ["rev-parse", "HEAD"], dir).trim();
  } catch {
    return "(not a git checkout)";
  }
}

// One BSP: the example's webapp plus the control, through app2bsp, into
// tree/src/02 under the BSP's own name - its nodes and its texts with it.
function buildBsp(tree, work, control, bsp) {
  const source = join(work, "examples", bsp.example, "webapp");
  const left = (bsp.leaveOut || []).map((path) => join(source, path));
  for (const path of left) {
    if (!existsSync(path)) {
      throw new Error(
        `build-bsp: ${relative(work, path)} to leave out is gone`,
      );
    }
  }
  const webapp = join(work, `bsp-${bsp.name}`, "webapp");
  cpSync(source, webapp, {
    recursive: true,
    filter: (path) => !left.some((l) => path === l || path.startsWith(l + "/")),
  });
  for (const [file, from, to] of bsp.patch ?? []) {
    mustReplace(join(webapp, file), from, to);
  }
  cpSync(join(control, "src"), join(webapp, THIRDPARTY), { recursive: true });

  const src02 = join(tree, "src", "02");
  app2bsp({
    webapp,
    target: src02,
    name: bsp.name,
    text: bsp.wapa,
    icfText: bsp.icf,
    packageText: bsp.devc,
  });

  // The control is registered under the path the manifest names, the two
  // nodes are the BSP's own, and the texts are ours
  const pages = join(src02, `${bsp.name}.wapa.xml`);
  mustContain(pages, `<APPLNAME>${bsp.name.toUpperCase()}</APPLNAME>`);
  mustContain(pages, `<PAGENAME>${THIRDPARTY}Container.js</PAGENAME>`);
  mustContain(pages, `<TEXT>${bsp.wapa}</TEXT>`);
  mustContain(join(src02, "package.devc.xml"), `<CTEXT>${bsp.devc}</CTEXT>`);
  const nodes = readdirSync(src02).filter((f) => f.endsWith(".sicf.xml"));
  if (nodes.length !== 2) {
    throw new Error(`build-bsp: 2 ICF nodes expected, found ${nodes.length}`);
  }
  for (const file of nodes) {
    mustContain(join(src02, file), `/sap/${bsp.name}/</URL>`);
    mustContain(join(src02, file), `<ICF_DOCU>${bsp.icf}</ICF_DOCU>`);
  }
}

// The page invariants of abap2UI5's tools, on the BSP of a finished tree:
// page names the system accepts, no line over 255 characters, every page
// file registered, every .js page valid JavaScript as stored - and exactly
// one BSP, in src/02.
function checkPages(tree, branch) {
  const { problems, pages, bsps } = checkBspFolder(join(tree, "src", "02"));
  if (bsps !== 1 || !pages) {
    problems.push(`${bsps} BSP with ${pages} pages in src/02, expected 1`);
  }
  if (problems.length) {
    throw new Error(
      `build-bsp: ${branch}: ${problems.length} page problem(s)\n  ` +
        problems.join("\n  "),
    );
  }
}

// Built in a folder of its own and copied to out/ once complete, so a failed
// build leaves no tree behind that looks like a result.
rmSync(outRoot, { recursive: true, force: true });
const work = mkdtempSync(join(tmpdir(), "embed-control-bsp-"));
let version;
try {
  for (const name of EXAMPLES) {
    copyExample(name, join(work, "examples", name));
    checkShown(name, join(work, "examples", name));
  }

  const { dir: control, ...installed } = installedControl();
  version = installed.version;
  mustContain(join(control, "ui5.yaml"), `/${THIRDPARTY}: ./src/`);
  const provenance = (branch) =>
    [
      `Generated abap2UI5-addons/embed-ui5-control branch ${branch} - provenance`,
      `built from: abap2UI5-addons/embed-ui5-control@${commitOf(root)}`,
      `control:    ${NAME}@${version} (packages/embed-control of that commit)`,
      `BSP tools:  abap2UI5/abap2UI5@${commitOf(a2)}`,
      "",
    ].join("\n");

  // The README every branch carries: the one of the examples, with a first
  // line that says where the branch comes from.
  const readme =
    "> ⚙️ **Generated branch** - built from `main` of this repository by " +
    "its `deliver` workflow; `VERSION` names the commit and the version of " +
    "the control. Do not change it here - change `main`.\n\n" +
    readFileSync(join(root, "examples", "README.md"), "utf8");

  for (const [branch, def] of Object.entries(BRANCHES)) {
    const tree = join(work, "out", branch);
    for (const name of def.examples) {
      cpSync(join(work, "examples", name), join(tree, name), {
        recursive: true,
      });
    }
    if (def.abap) {
      const abap = join(work, "examples", def.abap.example, def.abap.dir);
      mustContain(join(abap, "package.devc.xml"), "<CTEXT>");
      cpSync(abap, join(tree, "src", "01"), { recursive: true });
    }
    buildBsp(tree, work, control, def.bsp);
    writeFileSync(join(tree, ".abapgit.xml"), abapgitXml(def.abapgit));
    writeFileSync(join(tree, "src", "package.devc.xml"), packageXml(def.devc));

    checkPages(tree, branch);

    writeFileSync(join(tree, "README.md"), readme);
    cpSync(join(root, "LICENSE"), join(tree, "LICENSE"));
    writeFileSync(join(tree, "VERSION"), provenance(branch));
  }

  cpSync(join(work, "out"), outRoot, { recursive: true });
} finally {
  rmSync(work, { recursive: true, force: true });
}

for (const [branch, def] of Object.entries(BRANCHES)) {
  const parts = [
    ...def.examples.map((e) => `${e}/`),
    ...(def.abap ? [`the ABAP of ${def.abap.example}/${def.abap.dir}`] : []),
    `BSP ${def.bsp.name.toUpperCase()}`,
  ];
  console.log(`build-bsp: out/${branch}/ - ${parts.join(", ")}`);
}
console.log(`build-bsp: ${NAME}@${version} from packages/embed-control`);
