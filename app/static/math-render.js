"use strict";
// Display only. Calculator input values and stored teaching data are never rewritten.
(function (window, document) {
  const aliases = {
    "R = U / I": String.raw`R=\frac{U}{I}`,
    "R=U/I": String.raw`R=\frac{U}{I}`,
    "tau = R * C": String.raw`\tau=RC`,
    "g = 4 * pi^2 * L / T^2": String.raw`g=\frac{4\pi^2 L}{T^2}`,
    "u_A=s/√N": String.raw`u_A=\frac{s}{\sqrt{N}}`,
    "u_分辨率=分辨率/√12": String.raw`u_{\text{分辨率}}=\frac{\text{分辨率}}{\sqrt{12}}`,
    "R = I / U": String.raw`R=\frac{I}{U}`,
    "R=I/U": String.raw`R=\frac{I}{U}`,
    "20 mA = 0.020 A": String.raw`20\,\mathrm{mA}=0.020\,\mathrm{A}`,
  };
  const entries = new Map();
  for (const data of Object.values(window.LabFormulaCatalog || {})) {
    if (data.lines.some(line => line.tex)) entries.set(data.source, data.lines);
  }
  for (const [source, tex] of Object.entries(aliases)) entries.set(source, [{tex}]);
  const escape = source => source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp([...entries.keys()].sort((a, b) => b.length - a.length).map(escape).join("|"), "g");
  const skip = "input,textarea,select,option,script,style,pre,code,svg,.math-fragment,.formula-preview";

  function formulaFragment(source, lines, compact = false) {
    const wrapper = document.createElement("span");
    wrapper.className = "math-fragment" + (compact ? " math-inline" : "");
    wrapper.dataset.mathSource = source;
    for (const line of lines) {
      const part = document.createElement("span");
      part.className = line.tex ? "math-line" : "math-note";
      if (line.tex && window.katex) {
        try {
          window.katex.render(line.tex, part, {displayMode: false, throwOnError: true, trust: false, strict: "ignore", output: "htmlAndMathml"});
        } catch (_) {
          // Readable source is retained if a future lesson has unsupported notation.
          part.textContent = source;
          part.classList.add("math-fallback");
        }
      } else part.textContent = line.text || source;
      wrapper.append(part);
    }
    return wrapper;
  }

  function enhance(root) {
    if (!root || !window.katex) return;
    if (root.nodeType === 1) {
      const figures = root.matches("figure.learning-plot") ? [root] : root.querySelectorAll("figure.learning-plot");
      for (const figure of figures) {
        figure.tabIndex = 0;
        figure.setAttribute("aria-label", (figure.querySelector("figcaption")?.textContent || "数据图表") + "，可左右滑动或用方向键查看");
      }
    }
    const texts = [];
    if (root.nodeType === 3) texts.push(root);
    else {
      if (root.nodeType !== 1 || root.closest(skip)) return;
      const walker = document.createTreeWalker(root, 4);
      while (walker.nextNode()) texts.push(walker.currentNode);
    }
    for (const text of texts) {
      if (!text.parentElement || text.parentElement.closest(skip) || !text.textContent.trim()) continue;
      const source = text.textContent;
      pattern.lastIndex = 0;
      if (!pattern.test(source)) continue;
      pattern.lastIndex = 0;
      let match, offset = 0;
      const replacement = document.createDocumentFragment();
      while ((match = pattern.exec(source))) {
        replacement.append(document.createTextNode(source.slice(offset, match.index)));
        const full = match.index === 0 && match[0].length === source.length;
        replacement.append(formulaFragment(match[0], entries.get(match[0]), !full));
        offset = pattern.lastIndex;
      }
      replacement.append(document.createTextNode(source.slice(offset)));
      text.replaceWith(replacement);
    }
  }

  // A small, non-evaluating expression parser for the editable calculator preview.
  function texFromCalculation(raw) {
    if (!raw || raw.length > 500) return null;
    const normalized = raw.trim().replaceAll("×", "*").replaceAll("÷", "/").replaceAll("−", "-").replaceAll("π", "pi").replaceAll("**", "^");
    const pieces = normalized.split("=");
    if (pieces.length > 2) return null;
    const lhs = pieces.length === 2 ? pieces[0].trim() : "";
    if (lhs && !/^[A-Za-z_][A-Za-z_0-9]*$/.test(lhs)) return null;
    const expression = pieces.at(-1);
    const tokens = expression.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z_][A-Za-z_0-9]*|[()+\-*/^%,]/g) || [];
    if (tokens.join("") !== expression.replace(/\s/g, "")) return null;
    const greek = {pi: "\\pi", tau: "\\tau", alpha: "\\alpha", beta: "\\beta", gamma: "\\gamma", delta: "\\delta", eta: "\\eta", theta: "\\theta", lambda: "\\lambda", mu: "\\mu", rho: "\\rho", sigma: "\\sigma", omega: "\\omega", epsilon: "\\epsilon", kappa: "\\kappa"};
    const name = value => {
      if (greek[value]) return greek[value];
      const indexed = value.match(/^([A-Za-z]+)(?:_([A-Za-z_0-9]+)|(\d+))$/);
      if (indexed && (indexed[1].length === 1 || greek[indexed[1]])) {
        const suffix = indexed[2] || indexed[3];
        const index = /^[A-Za-z0-9]$|^\d+$/.test(suffix) ? suffix : "\\mathrm{" + suffix.replaceAll("_", "\\_") + "}";
        return (greek[indexed[1]] || indexed[1]) + "_{" + index + "}";
      }
      return value.length === 1 ? value : "\\mathrm{" + value.replaceAll("_", "\\_") + "}";
    };
    const functions = new Set(["sqrt", "abs", "exp", "log", "ln", "log10", "sin", "cos", "tan"]);
    const node = (tex, priority = 9) => ({tex, priority});
    const wrap = (value, priority) => value.priority < priority ? "\\left(" + value.tex + "\\right)" : value.tex;
    let position = 0, depth = 0;
    function atom() {
      if (++depth > 80) throw new Error("Too deeply nested");
      const token = tokens[position++];
      let result;
      if (token === "(") {
        result = add();
        if (tokens[position++] !== ")") throw new Error("Missing close parenthesis");
        result = node("\\left(" + result.tex + "\\right)");
      } else if (token && /^(?:\d|\.)/.test(token)) {
        const scientific = token.match(/^(.+)[eE]([+-]?\d+)$/);
        result = node(scientific ? scientific[1] + "\\times 10^{" + Number(scientific[2]) + "}" : token);
      } else if (token && /^[A-Za-z_]/.test(token)) {
        if (tokens[position] !== "(") result = node(name(token));
        else {
          if (!functions.has(token)) throw new Error("Unsupported function");
          position++;
          const args = [add()];
          if (tokens[position] === ",") { position++; args.push(add()); }
          if (tokens[position++] !== ")" || args.length > 1 && token !== "log") throw new Error("Invalid call");
          const arg = args[0].tex;
          result = node(token === "sqrt" ? "\\sqrt{" + arg + "}" : token === "abs" ? "\\left|" + arg + "\\right|" :
            (token === "exp" ? "\\exp" : token === "log10" ? "\\log_{10}" : token === "log" && args[1] ? "\\log_{" + args[1].tex + "}" : "\\" + token) + "\\left(" + arg + "\\right)");
        }
      } else throw new Error("Expected expression");
      depth--;
      return result;
    }
    function power() {
      let result = atom();
      if (tokens[position] === "^") { position++; result = node(wrap(result, 3) + "^{" + unary().tex + "}", 3); }
      return result;
    }
    function unary() {
      if (tokens[position] === "+" || tokens[position] === "-") return node(tokens[position++] + wrap(unary(), 2), 2);
      return power();
    }
    function multiply() {
      let result = unary();
      while (["*", "/", "%"].includes(tokens[position])) {
        const operator = tokens[position++], next = unary();
        result = operator === "/" ? node("\\frac{" + result.tex + "}{" + next.tex + "}") :
          node(wrap(result, 2) + (operator === "*" ? "\\cdot " : "\\bmod ") + wrap(next, 2), 2);
      }
      return result;
    }
    function add() {
      let result = multiply();
      while (tokens[position] === "+" || tokens[position] === "-") {
        const operator = tokens[position++], next = multiply();
        result = node(result.tex + operator + wrap(next, operator === "-" ? 2 : 1), 1);
      }
      return result;
    }
    try {
      const result = add();
      return position === tokens.length ? (lhs ? name(lhs) + "=" : "") + result.tex : null;
    } catch (_) { return null; }
  }

  function setupPreview() {
    const input = document.getElementById("formula");
    if (!input) return () => {};
    const holder = document.createElement("div");
    holder.className = "formula-preview";
    holder.setAttribute("aria-label", "公式排版预览");
    input.after(holder);
    let previous;
    const update = () => {
      if (input.value === previous) return;
      previous = input.value;
      holder.replaceChildren();
      const tex = texFromCalculation(input.value);
      holder.hidden = !tex;
      if (tex) {
        const label = document.createElement("small");
        label.textContent = "公式预览";
        holder.append(label, formulaFragment(input.value, [{tex}]));
      }
    };
    input.addEventListener("input", update);
    input.addEventListener("change", update);
    update();
    return update;
  }

  window.LabMath = Object.freeze({enhance, texFromCalculation});
  document.addEventListener("DOMContentLoaded", () => {
    const main = document.getElementById("main");
    if (!main) return;
    enhance(main);
    const updatePreview = setupPreview();
    const pending = new Set();
    let scheduled = false;
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === "characterData") pending.add(record.target);
        else for (const node of record.addedNodes) pending.add(node);
      }
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        const nodes = [...pending]; pending.clear();
        for (const node of nodes) if (node.isConnected) enhance(node);
        updatePreview();
      });
    });
    observer.observe(main, {subtree: true, childList: true, characterData: true});
  });
})(window, document);
