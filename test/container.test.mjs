// The control, run in Node: its sap.ui.define factory with stubs for what it
// takes from UI5, in a page of its own - a window with a location, a document
// that keeps the scripts it is given, a loader that answers for z2ui5/embed.
// No browser and no backend. What is pinned here is what the control decides
// before either is involved - which endpoints it accepts and what URL it
// requests, what it hands the bundle's create( ), when it starts, restarts
// and gives up - case by case, in milliseconds. How the app is made of that
// (its component, its component data) is the bundle's and tested in
// abap2UI5; the examples' Playwright tests in test/e2e/ run the control in a
// browser against a live abap2UI5 for the rest.
//
//   npm test

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const SOURCE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "packages/embed-control/src/Container.js",
);
const PAGE = "https://host.example/app/index.html";
const APP = "ZCL_MY_APP";
// Loads the control into a fresh page. `page` records what the control does
// to it: the <script> elements in its head (`scripts`), what create( ) was
// asked for (`created`) and what it handed back (`apps`), what was logged
// (`logged`); `page.embed` is what the loader answers for z2ui5/embed - null
// until "the bundle has run" (bundleArrives, or page.embed = page.bundle).
function load({ href = PAGE, hostGlobal } = {}) {
  const page = {
    scripts: [],
    created: [],
    apps: [],
    logged: [],
    embed: null,
  };
  // the bundle's z2ui5/embed module: create( ) hands back the app as a
  // control for the host to render - a ComponentContainer in abap2UI5
  page.bundle = {
    create(settings) {
      page.created.push(settings);
      const app = {
        settings,
        component: { of: settings },
        destroyed: false,
        destroy() {
          this.destroyed = true;
        },
        getComponentInstance() {
          return this.component;
        },
      };
      page.apps.push(app);
      if (page.failCreate) return Promise.reject(new Error(page.failCreate));
      if (!page.holdCreate) return Promise.resolve(app);
      // the test releases the app itself (page.release)
      return new Promise((resolve) => {
        page.release = () => resolve(app);
      });
    },
  };
  const document = {
    head: { appendChild: (script) => page.scripts.push(script) },
    createElement: (tag) => ({
      tag,
      remove() {
        page.scripts.splice(page.scripts.indexOf(this), 1);
      },
    }),
  };
  const sandbox = { URL, setTimeout, document, location: new URL(href) };
  sandbox.window = sandbox;
  if (hostGlobal) sandbox.z2ui5 = hostGlobal;
  let deps, factory;
  sandbox.sap = {
    ui: {
      define: (d, f) => {
        deps = d;
        factory = f;
      },
      require: Object.assign(
        (name) => (name === "z2ui5/embed" ? page.embed : undefined),
        { toUrl: (name) => `./${name}` },
      ),
    },
  };
  vm.runInNewContext(readFileSync(SOURCE, "utf8"), sandbox, {
    filename: SOURCE,
  });
  const stubs = {
    "sap/ui/core/Control": {
      // like UI5 1.x: the class and its renderer go onto the window as well
      extend(name, info) {
        function Container() {}
        Object.assign(Container.prototype, info);
        const path = name.split(".");
        let holder = sandbox;
        for (const key of path.slice(0, -1)) {
          holder = holder[key] = holder[key] || {};
        }
        holder[path.at(-1)] = Container;
        holder[`${path.at(-1)}Renderer`] = info.renderer;
        return Container;
      },
    },
    "sap/base/Log": { error: (...args) => page.logged.push(args) },
  };
  const Container = factory(
    ...deps.map((dep) => {
      if (!(dep in stubs)) throw new Error(`no stub for ${dep}`);
      return stubs[dep];
    }),
  );
  return { Container, page, sandbox };
}

// A control, with the part of ManagedObject it uses stubbed: properties,
// the hidden aggregation, invalidation, the DOM reference, the events.
function control(Container, settings = {}) {
  const props = {
    app: "",
    endpoint: "",
    params: null,
    ownsPage: false,
    bundleVersion: "",
    width: "100%",
    height: "100%",
    visible: true,
  };
  const c = Object.create(Container.prototype);
  Object.assign(c, {
    props,
    sets: [],
    events: [],
    aggregations: {},
    invalidated: 0,
    dom: null,
    getId: () => "host---main--embed",
    getProperty: (name) => props[name],
    setProperty(name, value, suppressInvalidate) {
      props[name] = value;
      c.sets.push([name, value, suppressInvalidate === true]);
      return c;
    },
    invalidate() {
      c.invalidated++;
    },
    getApp: () => props.app,
    getEndpoint: () => props.endpoint,
    getParams: () => props.params,
    getOwnsPage: () => props.ownsPage,
    getBundleVersion: () => props.bundleVersion,
    getVisible: () => props.visible,
    getWidth: () => props.width,
    getHeight: () => props.height,
    getDomRef: () => c.dom,
    getAggregation: (name) => c.aggregations[name] || null,
    setAggregation(name, value) {
      c.aggregations[name] = value;
      return c;
    },
    destroyAggregation(name) {
      if (c.aggregations[name]) c.aggregations[name].destroyed = true;
      delete c.aggregations[name];
      return c;
    },
    fireComponentCreated: (parameters) =>
      c.events.push(["componentCreated", parameters]),
    fireComponentFailed: (parameters) =>
      c.events.push(["componentFailed", parameters]),
  });
  for (const [name, value] of Object.entries(settings)) {
    const setter = `set${name[0].toUpperCase()}${name.slice(1)}`;
    if (typeof c[setter] === "function") c[setter](value);
    else props[name] = value;
  }
  return c;
}

// a few macrotasks, for the promise chains and the setTimeout of the load
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

// one rendering of the control, settled
async function render(c) {
  c.onBeforeRendering();
  await settle();
}

const requested = (page) => page.scripts.map((script) => script.src);
const events = (c) => c.events.map(([name]) => name);
const failure = (c) => {
  const failed = c.events.find(([name]) => name === "componentFailed");
  return failed ? failed[1].reason.message : null;
};
const app = (c) => c.aggregations._app;
// an object made in the control's page has that page's Object.prototype -
// compared as data, not by its prototype
const plain = (value) => JSON.parse(JSON.stringify(value));

// the bundle arrives: the script runs and defines z2ui5/embed
async function bundleArrives(page, embed = page.bundle) {
  page.embed = embed;
  page.scripts.at(-1).onload();
  await settle();
}

test("the default endpoint is /sap/bc/z2ui5 on the page's origin", async () => {
  const { Container, page } = load();
  const c = control(Container, { app: APP });
  await render(c);
  assert.deepEqual(requested(page), [
    "https://host.example/sap/bc/z2ui5?z2ui5-bundle",
  ]);
  assert.deepEqual(events(c), []);
});

test("an endpoint on this server is requested as the URL the browser resolves it to", async () => {
  const cases = {
    "/sap/bc/z2ui5": "https://host.example/sap/bc/z2ui5",
    "/sap/bc/z2ui5/": "https://host.example/sap/bc/z2ui5",
    "/sap/bc/z2ui5//": "https://host.example/sap/bc/z2ui5",
    "sap/bc/z2ui5": "https://host.example/app/sap/bc/z2ui5",
    "../other/node": "https://host.example/other/node",
    "/": "https://host.example/",
    " /sap/bc/z2ui5 ": "https://host.example/sap/bc/z2ui5",
    "/sap/bc/z2ui5?": "https://host.example/sap/bc/z2ui5",
    "/sap/bc/z2ui5#": "https://host.example/sap/bc/z2ui5",
    "/sap/bc/z 2ui5": "https://host.example/sap/bc/z%202ui5",
    "https://host.example/sap/bc/z2ui5": "https://host.example/sap/bc/z2ui5",
    "HTTPS://HOST.example/sap/bc/z2ui5": "https://host.example/sap/bc/z2ui5",
    // credentials are no part of what is requested
    "https://user:secret@host.example/sap/bc/z2ui5":
      "https://host.example/sap/bc/z2ui5",
  };
  for (const [endpoint, url] of Object.entries(cases)) {
    const { Container, page } = load();
    const c = control(Container, { app: APP, endpoint });
    await render(c);
    assert.deepEqual(requested(page), [`${url}?z2ui5-bundle`], endpoint);
    await bundleArrives(page);
    assert.equal(page.created[0].endpoint, url, endpoint);
  }
});

test("an endpoint that is no path on this server loads nothing and fails the start", async () => {
  const endpoints = [
    "https://evil.example/sap/bc/z2ui5",
    "http://host.example/sap/bc/z2ui5",
    "https://host.example:8443/sap/bc/z2ui5",
    "https://host.example.evil.example/sap/bc/z2ui5",
    "//evil.example/sap/bc/z2ui5",
    "/\\evil.example/sap/bc/z2ui5",
    "\\\\evil.example/sap/bc/z2ui5",
    // the URL parser drops tabs, line breaks and leading spaces
    "/\t/evil.example/sap/bc/z2ui5",
    "/\n/evil.example/sap/bc/z2ui5",
    "/\r/evil.example/sap/bc/z2ui5",
    " //evil.example/sap/bc/z2ui5",
    // "." and ".." segments go when the URL is parsed: a path //evil.example
    "/.//evil.example/sap/bc/z2ui5",
    "/sap/..//evil.example/sap/bc/z2ui5",
    "/%2e//evil.example/sap/bc/z2ui5",
    "/.\\/evil.example/sap/bc/z2ui5",
    "..//evil.example/sap/bc/z2ui5",
    // no path on a server at all
    "blob:https://host.example/0f3a",
    "javascript:alert(1)",
    "data:text/javascript,1",
    "ftp://host.example/sap/bc/z2ui5",
    "about:blank",
  ];
  for (const endpoint of endpoints) {
    const { Container, page } = load();
    const c = control(Container, { app: APP, endpoint });
    c.onBeforeRendering();
    // asynchronously - never inside the rendering
    assert.deepEqual(events(c), [], endpoint);
    await settle();
    assert.deepEqual(requested(page), [], endpoint);
    assert.deepEqual(events(c), ["componentFailed"], endpoint);
    assert.match(
      failure(c),
      /is not a path on this server/,
      JSON.stringify(endpoint),
    );
  }
});

test("a query or a fragment is refused as well", async () => {
  for (const endpoint of [
    "/sap/bc/z2ui5?sap-client=100",
    "/sap/bc/z2ui5#/app/ZCL_OTHER",
    "https://host.example/sap/bc/z2ui5?z2ui5-bundle",
  ]) {
    const { Container, page } = load();
    const c = control(Container, { app: APP, endpoint });
    await render(c);
    assert.deepEqual(requested(page), [], endpoint);
    assert.match(failure(c), /without a query or a fragment/, endpoint);
  }
});

test("a page without an origin - file: - has no path on this server", async () => {
  const { Container, page } = load({ href: "file:///C:/pages/index.html" });
  const c = control(Container, { app: APP, endpoint: "/sap/bc/z2ui5" });
  await render(c);
  assert.deepEqual(requested(page), []);
  assert.match(failure(c), /is not a path on this server/);
});

test("a refused start is not repeated by a rendering, only by restart( ) or a change", async () => {
  const { Container, page } = load();
  const c = control(Container, { app: APP, endpoint: "//evil.example/x" });
  await render(c);
  await render(c);
  assert.deepEqual(events(c), ["componentFailed"]);
  c.restart();
  await render(c);
  assert.deepEqual(events(c), ["componentFailed", "componentFailed"]);
  c.setEndpoint("/sap/bc/z2ui5");
  await render(c);
  assert.deepEqual(requested(page), [
    "https://host.example/sap/bc/z2ui5?z2ui5-bundle",
  ]);
});

test("nothing starts for an empty app or an invisible control", async () => {
  const { Container, page } = load();
  const c = control(Container);
  await render(c);
  c.setApp(APP);
  c.props.visible = false;
  await render(c);
  assert.deepEqual(requested(page), []);
  assert.deepEqual(events(c), []);
  c.props.visible = true;
  await render(c);
  assert.equal(requested(page).length, 1);
});

// the page is the app's: its URL names the class (?app_start=, or a route in
// the hash), which the backend reads from the roundtrip - so the control
// starts without one and hands none over
test("a control that owns the page starts without an app", async () => {
  const { Container, page } = load();
  page.embed = page.bundle;
  const c = control(Container, { ownsPage: true });
  await render(c);
  assert.deepEqual(events(c), ["componentCreated"]);
  assert.equal(page.created[0].app, "");
  assert.equal(page.created[0].ownsPage, true);
});

test("one start is the class, the endpoint as requested, the params and ownsPage", () => {
  const { Container } = load();
  const key = (settings) =>
    control(Container, { app: APP, ...settings })._startKey();
  const base = key({ endpoint: "/sap/bc/z2ui5", params: { a: "1" } });
  for (const endpoint of [
    "",
    "/sap/bc/z2ui5/",
    "../sap/bc/z2ui5",
    "https://host.example/sap/bc/z2ui5",
  ]) {
    assert.equal(key({ endpoint, params: { a: "1" } }), base, endpoint);
  }
  // the same parameters in another object - what a binding hands over
  // whenever its model says it changed
  assert.equal(key({ endpoint: "", params: { a: "1" } }), base);
  assert.notEqual(key({ endpoint: "/sap/bc/z2ui5_other" }), base);
  assert.notEqual(key({ endpoint: "", params: { a: "2" } }), base);
  assert.notEqual(key({ endpoint: "", params: { a: ["1", "1"] } }), base);
  assert.notEqual(key({ app: "ZCL_OTHER", params: { a: "1" } }), base);
  assert.notEqual(
    key({ endpoint: "", params: { a: "1" }, ownsPage: true }),
    base,
  );
  // names what is loaded, not what is started
  assert.equal(
    key({ endpoint: "", params: { a: "1" }, bundleVersion: "0123abcd" }),
    base,
  );
});

// What the bundle gets is what the host set, as it set it - and nothing
// else. Which component that makes, with which data, is decided there.
test("create( ) gets the class, the resolved endpoint, the params, ownsPage and the control", async () => {
  const { Container, page } = load();
  const params = { country: "DE", tags: ["a", "b"] };
  const c = control(Container, {
    app: APP,
    endpoint: "/sap/bc/z2ui5/",
    params,
  });
  await render(c);
  await bundleArrives(page);
  assert.equal(page.created.length, 1);
  const settings = page.created[0];
  assert.deepEqual(Object.keys(settings).sort(), [
    "app",
    "endpoint",
    "host",
    "ownsPage",
    "params",
  ]);
  assert.equal(settings.app, APP);
  assert.equal(settings.endpoint, "https://host.example/sap/bc/z2ui5");
  assert.equal(settings.params, params);
  assert.equal(settings.ownsPage, false);
  assert.equal(settings.host, c);
  // what came back is rendered, and its component is the event's
  assert.equal(app(c), page.apps[0]);
  assert.deepEqual(events(c), ["componentCreated"]);
  assert.equal(c.events[0][1].component, page.apps[0].component);
});

test("ownsPage is handed over only when set, and a change starts anew", async () => {
  const { Container, page } = load();
  page.embed = page.bundle;
  const c = control(Container, { app: APP, ownsPage: true });
  await render(c);
  assert.equal(page.created[0].ownsPage, true);
  c.setOwnsPage(false);
  assert.equal(app(c), undefined);
  await render(c);
  assert.equal(page.created.length, 2);
  assert.equal(page.created[1].ownsPage, false);
});

test("a create( ) that fails is the start's failure", async () => {
  const { Container, page } = load();
  page.embed = page.bundle;
  page.failCreate = "no manifest";
  const c = control(Container, { app: APP });
  await render(c);
  assert.deepEqual(events(c), ["componentFailed"]);
  assert.equal(failure(c), "no manifest");
  assert.equal(app(c), undefined);
});

test("the bundle is asked for by its version when the host names one", async () => {
  const { Container, page } = load();
  const c = control(Container, { app: APP, bundleVersion: "0123abcd/ef" });
  await render(c);
  assert.deepEqual(requested(page), [
    "https://host.example/sap/bc/z2ui5?z2ui5-bundle=0123abcd%2Fef",
  ]);
});

test("the bundle is loaded once, from the first control's endpoint, and shared", async () => {
  const { Container, page } = load();
  const first = control(Container, { app: APP });
  const second = control(Container, {
    app: APP,
    endpoint: "/sap/bc/z2ui5_other",
  });
  await render(first);
  await render(second);
  assert.deepEqual(requested(page), [
    "https://host.example/sap/bc/z2ui5?z2ui5-bundle",
  ]);
  await bundleArrives(page);
  assert.deepEqual(events(first), ["componentCreated"]);
  assert.deepEqual(events(second), ["componentCreated"]);
  // each sends its roundtrips to its own endpoint
  assert.deepEqual(
    page.created.map((settings) => settings.endpoint),
    [
      "https://host.example/sap/bc/z2ui5",
      "https://host.example/sap/bc/z2ui5_other",
    ],
  );
  // a third control, later, takes the frontend that is there
  const third = control(Container, { app: APP });
  await render(third);
  assert.equal(requested(page).length, 1);
  assert.deepEqual(events(third), ["componentCreated"]);
});

test("a bundle the host loaded itself is not loaded again", async () => {
  const { Container, page } = load();
  page.embed = page.bundle;
  const c = control(Container, { app: APP });
  await render(c);
  assert.deepEqual(requested(page), []);
  assert.deepEqual(events(c), ["componentCreated"]);
});

test("a page or a script that defines no z2ui5/embed with create( ) is no frontend", async () => {
  const { Container, page } = load();
  const c = control(Container, { app: APP });
  await render(c);
  const script = page.scripts[0];
  // the script ran - a page without nosniff - but defined nothing
  await bundleArrives(page, null);
  assert.deepEqual(events(c), ["componentFailed"]);
  assert.equal(
    failure(c),
    "no abap2UI5 frontend at https://host.example/sap/bc/z2ui5?z2ui5-bundle" +
      " - is the service active, the session valid and abap2UI5 recent enough?",
  );
  // ... and the failed script is gone
  assert.equal(page.scripts.includes(script), false);

  // an abap2UI5 up to 1.149.0: its bundle defines the module, without
  // create( ) - not a frontend this control can start, and no fallback
  const old = load();
  const o = control(old.Container, { app: APP });
  await render(o);
  await bundleArrives(old.page, {
    componentData: { nodePath: "/sap/bc/z2ui5" },
  });
  assert.deepEqual(events(o), ["componentFailed"]);
  assert.match(failure(o), /no abap2UI5 frontend at/);
});

test("a failed load fails every control that shared it, and is forgotten", async () => {
  const { Container, page } = load();
  const first = control(Container, { app: APP });
  const second = control(Container, {
    app: APP,
    endpoint: "/sap/bc/z2ui5_other",
  });
  await render(first);
  await render(second);
  // the backend is down
  page.scripts[0].onerror();
  await settle();
  assert.deepEqual(events(first), ["componentFailed"]);
  assert.deepEqual(events(second), ["componentFailed"]);
  assert.match(
    failure(second),
    /no abap2UI5 frontend at https:\/\/host.example\/sap\/bc\/z2ui5\?z2ui5-bundle/,
  );
  // no second request of the control's own, and none by a rendering
  assert.deepEqual(requested(page), []);
  await render(first);
  await render(second);
  assert.deepEqual(requested(page), []);
  // restart( ) asks the backend again - from the endpoint of whoever is first
  second.restart();
  await render(second);
  assert.deepEqual(requested(page), [
    "https://host.example/sap/bc/z2ui5_other?z2ui5-bundle",
  ]);
  await bundleArrives(page);
  assert.deepEqual(events(second), ["componentFailed", "componentCreated"]);
  // and the first control, restarted, takes the frontend that is there now
  first.restart();
  await render(first);
  assert.equal(requested(page).length, 1);
  assert.deepEqual(events(first), ["componentFailed", "componentCreated"]);
});

test("a change of app, endpoint or params replaces the app - and what a start under way still creates is destroyed", async () => {
  const { Container, page } = load();
  const c = control(Container, { app: APP, params: { a: "1" } });
  await render(c);
  await bundleArrives(page);
  const first = app(c);
  assert.equal(first, page.apps[0]);

  // the same params in another object: no restart
  c.setParams({ a: "1" });
  assert.equal(app(c), first);
  assert.equal(c.invalidated, 0);

  // other params: the app goes, the next rendering starts anew
  c.setParams({ a: "2" });
  assert.equal(first.destroyed, true);
  assert.equal(app(c), undefined);
  assert.equal(c.invalidated, 1);
  await render(c);
  assert.equal(requested(page).length, 1);
  assert.deepEqual(events(c), ["componentCreated", "componentCreated"]);
  assert.deepEqual(plain(page.created[1].params), { a: "2" });

  // a change while the app is still being created
  page.holdCreate = true;
  c.setApp("ZCL_OTHER");
  await render(c);
  assert.equal(page.created.at(-1).app, "ZCL_OTHER");
  const created = c.events.length;
  c.setEndpoint("/sap/bc/z2ui5_other");
  page.release();
  await settle();
  // destroyed, handed to nobody
  assert.equal(c.events.length, created);
  assert.equal(page.apps.at(-1).destroyed, true);
  await render(c);
  page.release();
  await settle();
  assert.equal(c.events.length, created + 1);
  assert.equal(
    page.created.at(-1).endpoint,
    "https://host.example/sap/bc/z2ui5_other",
  );
});

test("restart( ) ends the running app and starts anew with the same values", async () => {
  const { Container, page } = load();
  const c = control(Container, { app: APP });
  await render(c);
  await bundleArrives(page);
  const first = app(c);
  c.restart();
  assert.equal(first.destroyed, true);
  assert.equal(app(c), undefined);
  await render(c);
  assert.equal(requested(page).length, 1);
  assert.deepEqual(events(c), ["componentCreated", "componentCreated"]);
  assert.notEqual(app(c), first);
});

test("an app that arrives after the control's end is destroyed", async () => {
  const { Container, page } = load();
  page.embed = page.bundle;
  page.holdCreate = true;
  const c = control(Container, { app: APP });
  await render(c);
  c.exit();
  page.release();
  await settle();
  assert.deepEqual(events(c), []);
  assert.equal(page.apps.length, 1);
  assert.equal(page.apps[0].destroyed, true);
});

test("width and height go to the DOM, without a rendering", () => {
  const { Container } = load();
  const c = control(Container, { app: APP });
  c.dom = { style: {} };
  c.setHeight("500px").setWidth("50%");
  assert.deepEqual(c.sets.slice(-2), [
    ["height", "500px", true],
    ["width", "50%", true],
  ]);
  assert.deepEqual(c.dom.style, { height: "500px", width: "50%" });
  assert.equal(c.invalidated, 0);
  // not rendered yet: the property alone, for the first rendering
  c.dom = null;
  c.setHeight("300px");
  assert.equal(c.getHeight(), "300px");
});

test("a handler of componentCreated that throws is logged, not left as an unhandled rejection", async () => {
  const { Container, page } = load();
  page.embed = page.bundle;
  const c = control(Container, { app: APP });
  c.fireComponentCreated = () => {
    throw new Error("host bug");
  };
  await render(c);
  assert.equal(page.logged.length, 1);
  assert.match(page.logged[0][0], /host---main--embed/);
  assert.match(page.logged[0][1], /host bug/);
});

test("the control leaves no z2ui5 global, and a host's own keeps what it held", () => {
  assert.equal("z2ui5" in load().sandbox, false);
  const host = { embed: { hostData: 1 }, other: 2 };
  assert.deepEqual(load({ hostGlobal: host }).sandbox.z2ui5, {
    embed: { hostData: 1 },
    other: 2,
  });
});
