const BASE_URL = process.env.TUTOR_TEST_URL || "http://127.0.0.1:8000";
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_CHANNEL
      ? { channel: process.env.BROWSER_CHANNEL }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const idle = () =>
    page.waitForFunction(
      () =>
        document.querySelector("#diagnosisForm").getAttribute("aria-busy") ===
        "false",
    );
  const click = async (selector) => {
    await page.locator(selector).click();
    await idle();
  };
  const report = [];
  const output = path.join(__dirname, "test-reports");
  fs.mkdirSync(output, { recursive: true });
  const audit = async (name) => {
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    const result = await page.evaluate(async () => {
      const r = await axe.run(document, {
        runOnly: {
          type: "tag",
          values: [
            "wcag2a",
            "wcag2aa",
            "wcag21a",
            "wcag21aa",
            "wcag22aa",
            "best-practice",
          ],
        },
      });
      return r.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      }));
    });
    report.push({ name, violations: result });
    console.log("AUDIT", name, JSON.stringify(result));
  };
  await page.goto(BASE_URL);
  await idle();
  assert.match(await page.locator("#healthBadge").innerText(), /服务正常/);
  assert.equal(await page.locator("#knowledgeResults article").count(), 4);
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.className),
    "skip-link",
  );
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => document.activeElement.id), "main");
  await audit("initial");
  await page.locator("#studentId").fill("browser-check-" + Date.now());
  await page.locator("#courseId").fill("QA");
  await click("#runButton");
  assert.match(await page.locator("#resultHeading").innerText(), /第 1 轮诊断/);
  assert.match(await page.locator("#result").innerText(), /第 1 级提示/);
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "resultHeading",
  );
  await page
    .locator("#result summary")
    .filter({ hasText: "查看全部四级提示" })
    .click();
  assert.match(await page.locator("#result").innerText(), /4 · 完整解释/);
  await audit("diagnosis-and-hints");
  await click("#outcomeButton");
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "errorSummary",
  );
  await page.locator("#errorList a").click();
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "revision",
  );
  await page.locator("#revision").fill("已统一电流单位");
  await page.locator("#finalResult").fill("250 Ω");
  await page.locator("#selfCheckNotes").fill("复算无误");
  await click("#outcomeButton");
  assert.equal(await page.locator("#outcomeForm").isVisible(), false);
  assert.equal(await page.locator("#outcomeSaved").isVisible(), true);
  await page.locator("#sampleKind").selectOption("corrected");
  await click("#loadSampleButton");
  await click("#runButton");
  assert.match(
    await page.locator("#resultHeading").innerText(),
    /第 2 轮诊断 · 诊断完成/,
  );
  assert.equal(await page.locator(".history-attempt").count(), 2);
  const downloaded = page.waitForEvent("download");
  await click("#exportHistoryButton");
  const download = await downloaded;
  const saved = await download.path();
  const data = JSON.parse(fs.readFileSync(saved, "utf8"));
  assert.equal(data.summary.attempt_count, 2);
  assert.equal(data.summary.modification_count, 1);
  assert.equal(data.attempts[0].outcome.self_check_notes, "复算无误");
  const session = data.session.session_id;
  await page.reload();
  await idle();
  assert.match(
    await page.locator("#sessionState").innerText(),
    new RegExp(session),
  );
  assert.equal(await page.locator("#studentResult").inputValue(), "250");
  await click("#findSessionsButton");
  assert.ok(await page.locator("#sessionList .session-item").count());
  await page.locator("#sessionStudentId").fill("");
  await click("#findSessionsButton");
  await page.locator("#sessionList button").first().click();
  await idle();
  assert.match(
    await page.locator("#sessionState").innerText(),
    new RegExp(session),
  );
  await page.locator("#knowledgeQuery").fill("电流");
  await page.locator("#knowledgeExperiment").selectOption("ohms_law");
  await page.locator('#knowledgeForm button[type="submit"]').click();
  await idle();
  assert.ok(
    (await page.locator("#knowledgeResults").innerText()).includes("欧姆定律"),
  );
  await click("#browseKnowledgeButton");
  assert.equal(await page.locator("#knowledgeResults article").count(), 4);
  await click("#reloadKnowledgeButton");
  assert.match(await page.locator("#liveStatus").innerText(), /重新加载/);
  await page.locator("#sampleKind").selectOption("insufficient");
  await click("#loadSampleButton");
  await click("#runButton");
  assert.match(
    await page.locator("#resultHeading").innerText(),
    /需要补充证据/,
  );
  await audit("insufficient-history");
  await page.locator('input[value="json"]').check();
  await page.locator("#payload").fill("{broken");
  await click("#runButton");
  assert.equal(
    await page.locator("#payload").getAttribute("aria-invalid"),
    "true",
  );
  await audit("json-error");
  await page.locator("#sampleKind").selectOption("error");
  await click("#loadSampleButton");
  await page.locator('input[value="guided"]').check();
  // All three experiments have working wrong/corrected samples.
  for (const experiment of ["rc_time_constant", "simple_pendulum"]) {
    await page.locator("#experimentId").selectOption(experiment);
    await click("#loadSampleButton");
    await click("#runButton");
    assert.match(
      await page.locator("#resultHeading").innerText(),
      /进行教学引导/,
    );
    await page.locator("#sampleKind").selectOption("corrected");
    await click("#loadSampleButton");
    await click("#runButton");
    assert.match(await page.locator("#resultHeading").innerText(), /诊断完成/);
    await page.locator("#sampleKind").selectOption("error");
  }
  await page.locator("#experimentId").selectOption("ohms_law");
  await click("#loadSampleButton");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(output, "desktop.png"),
    fullPage: false,
  });
  for (const width of [768, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      width: innerWidth,
    }));
    assert.ok(overflow.scroll <= overflow.width, JSON.stringify(overflow));
  }
  await audit("mobile-320");
  await page.screenshot({
    path: path.join(output, "mobile.png"),
    fullPage: false,
  });
  assert.deepEqual(errors, []);
  assert.equal(
    report.reduce((sum, item) => sum + item.violations.length, 0),
    0,
    "Accessibility violations must be fixed",
  );
  fs.writeFileSync(
    path.join(output, "report.json"),
    JSON.stringify(
      {
        audits: report,
        consoleErrors: errors,
        workflow: "passed",
        testedWidths: [1440, 768, 375, 320],
      },
      null,
      2,
    ),
  );
  await browser.close();
  console.log("Browser workflow passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
