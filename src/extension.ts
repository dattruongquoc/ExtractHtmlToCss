//fix custom class ignore from setting
const IGNORE_CLASS_PATTERNS: string[] = vscode.workspace.getConfiguration("extracthtmltocss").get("ignoreClassPatterns", ["br_*", ".br_*"]);

/** Convert a glob-style pattern (*) into a RegExp */
function globToRegExp(glob: string): RegExp {
  const g = glob.startsWith(".") ? glob.slice(1) : glob;
  const esc = g.replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&");
  const regex = "^" + esc.replace(/\*/g, ".*") + "$";
  return new RegExp(regex);
}

/** Check if a class matches any pattern in the ignore list */
function isIgnoredClass(cls: string): boolean {
  return IGNORE_CLASS_PATTERNS.some((pat) => globToRegExp(pat).test(cls));
}
import * as vscode from "vscode";
import { CheerioAPI, load as loadHtml } from "cheerio";
import type { Element } from "domhandler";
import * as path from "path";
import * as fs from "fs/promises";

/**
  * Rules for selecting the display selector:
 * - rule01: If both id and class exist → use class only.
 * - rule02: If multiple classes exist → use only the first class.
 * - rule03: If no class or id exists → skip the element.
 * - rule04: filter out classes that are listed in the ignore list
 */
function selectorForElement(
  $: CheerioAPI,
  el: Element
): { sel: string | null; note?: string } {
  const tag = el.tagName?.toLowerCase?.() || "";
  if (tag === "script" || tag === "style" || tag === "br") return { sel: null };
  const $el = $(el);
  const classAttr = ($el.attr("class") || "").trim();
  const idAttr = ($el.attr("id") || "").trim();
  const classes = classAttr.split(/\s+/).filter(Boolean);
  const usableClasses = classes.filter((c) => !isIgnoredClass(c));

  //rule01 + rule02 + rule04
  if (usableClasses.length > 0) {
    const firstClass = usableClasses[0];
    return { sel: `.${firstClass}` };
  }

  //set iD attr if not has class
  if (idAttr) {
    return { sel: `#${idAttr}` };
  }

  return { sel: null };
}

/**
 * Traverse the entire DOM tree, collecting only nodes that have a class or id; deduplicate selectors.
 * Return an array of CSS blocks in the form: selector { }.
 */
function buildFlatCss(
  $: CheerioAPI,
  rootEl: Element,
  selectorParent: string,
  emitIntermediate = true
): string[] {
  const results: string[] = [];
  const seen = new Set<string>();
  const prefix = (selectorParent ?? "").trim();

  // Stack: include an isRoot flag to prevent emitting the root selector
  const stack: Array<{ el: Element; path: string[]; isRoot: boolean }> = [
    { el: rootEl, path: [], isRoot: true },
  ];

  while (stack.length) {
    const { el, path, isRoot } = stack.pop()!;

    const { sel } = selectorForElement($, el);

    // skip appending the root selector to the path
    const newPath = !isRoot && sel ? [...path, sel] : path;

    const children = $(el).children().toArray();

    // Only emit when it is NOT the root and a selector exists
    const shouldEmit = !isRoot && !!sel && (emitIntermediate || children.length === 0);
    if (shouldEmit) {
      const full = prefix ? `${prefix} ${newPath.join(" ")}` : newPath.join(" ");
      if (full && !seen.has(full)) {
        seen.add(full);
        results.push(`${full} {}`);
      }
    }

    // Traverse children in the correct DOM order (push in reverse)
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i] as Element;
      stack.push({ el: child, path: newPath, isRoot: false });
    }
  }

  // Insert the root selector line once if a prefix is defined
  if (prefix) {
    const rootLine = `${prefix} {}`;
    if (!results.includes(rootLine)) results.unshift(rootLine);
  }

  return results;
}


async function pickHtmlFileFromWorkspace(): Promise<vscode.Uri | undefined> {
  const files = await vscode.workspace.findFiles(
    "**/*.{html,htm}",
    "**/node_modules/**",
    100
  );
  if (files.length === 0) {
    vscode.window.showErrorMessage("No HTML source file was found in the workspace.");
    return undefined;
  }
  // Prioritize specific files
  const priorityNames = ["index.html", "under.html", "interview.html"];
  const sortedFiles = [
    ...priorityNames
      .map((name) =>
        files.find((uri) => path.basename(uri.fsPath).toLowerCase() === name)
      )
      .filter(Boolean),
    ...files.filter(
      (uri) => !priorityNames.includes(path.basename(uri.fsPath).toLowerCase())
    ),
  ];
  const items = sortedFiles
    .filter((uri): uri is vscode.Uri => !!uri)
    .map((uri) => ({
      label: path.basename(uri.fsPath),
      description: vscode.workspace.asRelativePath(uri.fsPath),
      uri,
    }));
  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: "Select the source HTML file from which to extract CSS selectors",
  });
  return picked?.uri;
}

async function readFileUtf8(uri: vscode.Uri): Promise<string> {
  const buf = await fs.readFile(uri.fsPath);
  return buf.toString("utf8");
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "extractHtmlTocss",
    async () => {
      // 2) Select the source html file
      const htmlUri = await pickHtmlFileFromWorkspace();
      if (!htmlUri) {
        return;
      }

      // 3) Enter the root selector
      const rootSelector = await vscode.window.showInputBox({
        prompt: "Enter the CSS selector for the root element (e.g., .idxn01 .card)",
        placeHolder: ".sec01 .card",
        validateInput: (v) =>
          v && v.trim().length > 0 ? null : "Selector cannot be empty",
      });
      if (!rootSelector) {
        return;
      }

      // 4) Read & parse HTML
      let html = "";
      try {
        html = await readFileUtf8(htmlUri);
      } catch (e: any) {
        vscode.window.showErrorMessage(
          `Cannot read HTML file: ${e?.message || e}`
        );
        return;
      }
      const $ = loadHtml(html, { xmlMode: false });

      // 5) Find the root element
      const rootMatch = $(rootSelector).first();
      const rootElement = rootMatch.get(0);
      if (!rootElement || rootElement.type !== "tag") {
        vscode.window.showWarningMessage(
          `Cannot find a valid element with selector: ${rootSelector}`
        );
        return;
      }

      // 6) Generate CSS
      const innerLines = buildFlatCss($, rootElement as Element,rootSelector);
      const cssBlock = innerLines.join("\n");

      // 7) Insert into the current CSS/SCSS file at the cursor position
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        const doc = await vscode.workspace.openTextDocument({
          language: "css",
          content: cssBlock,
        });
        await vscode.window.showTextDocument(doc);
      } else {
        await editor.edit((editBuilder) => {
          editBuilder.insert(editor.selection.active, `\n${cssBlock}\n`);
        });
      }

      vscode.window.showInformationMessage(
        "Generated CSS from HTML based on selector."
      );
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
