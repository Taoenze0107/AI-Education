const BASE_URL = process.env.TUTOR_TEST_URL || "http://127.0.0.1:8000";
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_CHANNEL
      ? { channel: process.env.BROWSER_CHANNEL }
      : {}),
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const idle = () =>
    page.waitForFunction(
      () =>
        document.querySelector("#diagnosisForm").getAttribute("aria-busy") ===
        "false",
    );
  const click = async (s) => {
    await page.locator(s).click();
    await idle();
  };
  await page.goto(BASE_URL);
  await idle();
  // Every principal action can be reached by Tab, without mouse gestures.
  const reached = new Set();
  for (let i = 0; i < 180; i++) {
    await page.keyboard.press("Tab");
    reached.add(await page.evaluate(() => document.activeElement.id));
  }
  for (const id of [
    "runButton",
    "loadSampleButton",
    "newSessionButton",
    "clearEvidenceButton",
    "findSessionsButton",
    "browseKnowledgeButton",
    "reloadKnowledgeButton",
    "refreshHealthButton",
  ])
    assert.ok(reached.has(id), `Keyboard unreachable: ${id}`);
  await page.locator("#studentId").fill("edge-" + Date.now());
  await click("#newSessionButton");
  assert.match(await page.locator("#sessionState").innerText(), /0 次诊断/);
  await click("#clearEvidenceButton");
  await click("#runButton");
  assert.match(
    await page.locator("#resultHeading").innerText(),
    /需要补充证据/,
  );
  await click("#loadSampleButton");
  await page.locator("#anomalyConfidence").fill("5");
  await click("#runButton");
  assert.match(await page.locator("#errorList").innerText(), /观察置信度/);
  assert.equal(
    await page.locator("#anomalyConfidence").getAttribute("aria-invalid"),
    "true",
  );
  await page.locator("#anomalyConfidence").fill("0.93");
  await click("#addVariableButton");
  await click("#runButton");
  assert.match(await page.locator("#errorList").innerText(), /变量/);
  await page
    .locator("#variableRows fieldset")
    .last()
    .getByRole("button")
    .click();
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "addVariableButton",
  );
  await page.locator('input[value="json"]').check();
  const payload = JSON.parse(await page.locator("#payload").inputValue());
  payload.raw_measurements = {
    text: "005",
    nothing: null,
    truth: true,
    values: [1, 2.5],
    nested: { a: [1, "2"] },
  };
  payload.metadata = { source: "edge test" };
  await page.locator("#payload").fill(JSON.stringify(payload));
  await page.locator('input[value="guided"]').check();
  await page.locator('input[value="json"]').check();
  assert.deepEqual(
    JSON.parse(await page.locator("#payload").inputValue()).raw_measurements,
    payload.raw_measurements,
  );
  await page
    .locator("#payload")
    .fill('{"mathematics":{"student_result":1e999}}');
  await page.locator('input[value="guided"]').click();
  assert.equal(await page.locator('input[value="json"]').isChecked(), true);
  assert.match(await page.locator("#errorList").innerText(), /有限数值/);
  await page
    .locator("#payload")
    .fill('{"anomaly":{"status":"invalid","confidence":0.5}}');
  await click("#runButton");
  assert.match(await page.locator("#errorList").innerText(), /anomaly.status/);
  await click("#loadSampleButton");
  await page.locator('input[value="guided"]').check();
  const student = "pages-" + Date.now();
  for (let i = 0; i < 23; i++) {
    const r = await page.request.post(`${BASE_URL}/api/v1/sessions`, {
      data: { student_id: student, experiment_id: "ohms_law" },
    });
    assert.equal(r.status(), 201);
  }
  await page.locator("#sessionStudentId").fill(student);
  await click("#findSessionsButton");
  assert.equal(await page.locator("#sessionList .session-item").count(), 20);
  await click("#nextSessionsButton");
  assert.equal(await page.locator("#sessionList .session-item").count(), 3);
  await click("#previousSessionsButton");
  assert.equal(await page.locator("#sessionList .session-item").count(), 20);
  await page.locator("#sessionStudentId").fill("missing-student");
  assert.equal(await page.locator("#nextSessionsButton").isDisabled(), true);
  await click("#findSessionsButton");
  assert.equal(await page.locator("#sessionList .session-item").count(), 0);
  // A failed GET provides a recoverable, announced error; the next refresh works.
  await page.route("**/api/v1/health", (route) => route.abort());
  await click("#refreshHealthButton");
  assert.match(await page.locator("#errorList").innerText(), /无法连接/);
  await page.unroute("**/api/v1/health");
  await click("#refreshHealthButton");
  assert.match(await page.locator("#healthBadge").innerText(), /服务正常/);
  // Refresh/resume preserves custom experiment IDs supplied by the API.
  const custom = await (
    await page.request.post(`${BASE_URL}/api/v1/sessions`, {
      data: { student_id: student, experiment_id: "custom-experiment" },
    })
  ).json();
  await page.locator("#sessionStudentId").fill(student);
  await click("#findSessionsButton");
  await page.locator("#sessionList button").first().click();
  await idle();
  assert.equal(
    await page.locator("#experimentId").inputValue(),
    "custom-experiment",
  );
  assert.match(
    await page.locator("#sessionState").innerText(),
    new RegExp(custom.session_id),
  );
  await page.locator("summary").filter({ hasText: "使用其他实验" }).click();
  await page.locator("#customExperimentId").fill("optics-ui");
  await click("#addExperimentButton");
  assert.equal(await page.locator("#experimentId").inputValue(), "optics-ui");
  await click("#newSessionButton");
  assert.match(await page.locator("#sessionState").innerText(), /0 次诊断/);
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 900 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "Keyboard, validation, JSON roundtrip, pagination, custom sessions and connection recovery passed",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
