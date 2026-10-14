import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const ts = require("typescript");
function fixture({
  data = "data:application/pdf;base64,JVBERi0xLjcK",
  stale = false,
  file = { name: "Newsletter.pdf", size: 9 },
} = {}) {
  let input: any;
  const urls: string[] = [];
  let removed = false;
  const module = { exports: {} as any };
  const source = ts.transpileModule(
    readFileSync(new URL("../src/news/files.web.ts", import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  class Reader {
    result = data;
    onload = () => {};
    readAsDataURL() {
      this.onload();
    }
  }
  const document = {
    body: { appendChild() {} },
    createElement() {
      input = {
        files: file ? [file] : [],
        style: {},
        events: {} as any,
        addEventListener(name: string, fn: any) {
          this.events[name] = fn;
        },
        click() {},
        remove() {
          removed = true;
        },
      };
      return input;
    },
  };
  new Function(
    "require",
    "module",
    "exports",
    "document",
    "FileReader",
    "URL",
    source,
  )(
    () => ({
      MAX_PDF_BYTES: 32 * 1024 * 1024,
      loadPdfData: async () => data,
      activeEdition: async () => {
        if (stale) throw Error("Edition changed");
      },
    }),
    module,
    module.exports,
    document,
    Reader,
    {
      createObjectURL() {
        urls.push("blob:pdf");
        return "blob:pdf";
      },
      revokeObjectURL(uri: string) {
        urls.splice(urls.indexOf(uri), 1);
      },
    },
  );
  return {
    api: module.exports,
    urls,
    input: () => input,
    removed: () => removed,
  };
}
test("browser picker normalizes valid PDF, handles cancellation and rejects invalid or oversized files", async () => {
  const good = fixture();
  const picked = good.api.pickPdf();
  good.input().events.change();
  assert.equal((await picked).name, "Newsletter.pdf");
  assert.equal(good.removed(), true);
  const cancel = fixture();
  const cancelled = cancel.api.pickPdf();
  cancel.input().events.cancel();
  assert.equal(await cancelled, null);
  const bad = fixture({ data: "data:text/plain;base64,aGVsbG8=" });
  const rejected = bad.api.pickPdf();
  bad.input().events.change();
  await assert.rejects(rejected, /valid PDF/);
  const big = fixture({ file: { name: "big.pdf", size: 33 * 1024 * 1024 } });
  const oversized = big.api.pickPdf();
  big.input().events.change();
  await assert.rejects(oversized, /32 MB/);
});
test("browser reader validates bytes, checks edition and releases object URLs", async () => {
  const good = fixture();
  const pdf = await good.api.preparePdf({});
  assert.equal(pdf.uri, "blob:pdf");
  pdf.dispose();
  assert.deepEqual(good.urls, []);
  const stale = fixture({ stale: true });
  await assert.rejects(stale.api.preparePdf({}), /Edition changed/);
  assert.deepEqual(stale.urls, []);
  const bad = fixture({ data: "data:text/plain;base64,aGVsbG8=" });
  await assert.rejects(bad.api.preparePdf({}), /not a supported PDF/);
});
