// Independent display checks; no browser driver or input evaluation is used here.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const katex = require(path.join(root, 'app/static/vendor/katex/katex.min.js'));
const scope = {window: {}, document: {addEventListener() {}}};
vm.createContext(scope);
for (const file of ['formula-catalog.js', 'math-render.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'app/static', file), 'utf8'), scope);
}
const topics = JSON.parse(fs.readFileSync(path.join(root, 'app/data/experiment_catalog.json')));
const catalog = scope.window.LabFormulaCatalog;
assert.equal(Object.keys(catalog).length, 128);
let formulas = 0;
for (const topic of topics) {
  const presentation = catalog[topic.experiment_id];
  assert.equal(presentation.source, topic.relation, topic.experiment_id);
  for (const line of presentation.lines) if (line.tex) {
    const html = katex.renderToString(line.tex, {throwOnError: true, trust: false, strict: 'ignore'});
    assert(html.includes('katex-mathml') && !html.includes('katex-error'));
    formulas++;
  }
}
const render = scope.window.LabMath.texFromCalculation;
assert.equal(render('R = U / I'), 'R=\\frac{U}{I}');
assert.equal(render('sqrt(12)'), '\\sqrt{12}');
assert.equal(render('u_A = s/sqrt(N)'), 'u_{A}=\\frac{s}{\\sqrt{N}}');
assert.equal(render('U = r0 * I'), 'U=r_{0}\\cdot I');
assert.equal(render('R = 1/(a+b)'), 'R=\\frac{1}{\\left(a+b\\right)}');
assert.equal(render('x = 2^-3'), 'x=2^{-3}');
assert.equal(render('x = a/(b/c)'), 'x=\\frac{a}{\\left(\\frac{b}{c}\\right)}');
assert.equal(render('h = 6.626e-34'), 'h=6.626\\times 10^{-34}');
assert.equal(render('R = terminal_velocity * mass_kg'), 'R=\\mathrm{terminal\\_velocity}\\cdot \\mathrm{mass\\_kg}');
for (const expression of ['g = 4*pi^2*L/T^2', 'q = abs(-3)/sqrt(12)', 'x=exp(-t/tau)', 'a = log(8,2)']) {
  assert.doesNotThrow(() => katex.renderToString(render(expression), {throwOnError: true}));
}
for (const invalid of ['', '<img src=x>', String.raw`\href{javascript:alert(1)}{X}`, 'sin(1,2)', 'x=eval(1)', 'x=2;y=3', 'x=a[b]', 'R=U/']) {
  assert.equal(render(invalid), null, invalid);
}
assert.match(catalog.length_measurement.lines[1].tex, /\\frac\{s\}\{\\sqrt\{N\}\}/);
assert.match(catalog.millikan.lines[1].tex, /\\frac\{3\}\{2\}/);
console.log(`128 topic sources preserved; ${formulas} formulas parsed; calculator preview precedence and unsafe-input checks passed.`);
