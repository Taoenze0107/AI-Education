# Start the textbook resource edition

Current edition: 128 topics, 504 simulated datasets, 1512 original questions and 393 knowledge entries. Browse `/experiments`, choose a textbook or subject, open a topic and select a level. The crosswalk covers 169 catalogue entries from five publisher sources; composite items state their supported scope. This is not a universal national required-experiment list. All example data are teaching simulations. See `本轮教材资料扩充_20261012.md` for sources and upgrade details.


You need Python 3.11 or newer. First installation needs internet access to download dependencies. No API key is required. The interface and teaching content are in Chinese.

1. Extract the entire project to a folder you can write to.
2. On macOS, double-click `start.command`. On Linux or macOS, you can instead open a terminal in this folder and run `sh start.sh`. On Windows, double-click `start.cmd`.
3. Wait for the server to start, then open **http://127.0.0.1:8000** in your browser. Keep the terminal open. Press `Ctrl+C` in that terminal to stop.

The launcher installs packages only inside the project's `.venv` folder. It creates `.env` from `.env.example` only when `.env` does not already exist. The supplied configuration sets `ENABLE_LLM=false`, so all local features work without a model account. Later launches reuse the environment; dependency installation is repeated if the dependency files change.

## Try the whole workflow

1. Create a session with a student ID, choose the Ohm's law experiment, and optionally enter a course ID.
2. Load the calculation-error example. Use the guided evidence fields, or inspect/edit the advanced JSON input. Submit it for diagnosis.
3. Read the evidence assessment, next steps, and teaching hint. Expand “查看全部四级提示与完整解释” to access all four hint levels immediately. An incomplete-evidence example demonstrates requests for more information.
4. Record the student's revision and its outcome. Then submit revised evidence if another diagnosis is needed.
5. Open the saved sessions list to resume a session; leave the student filter blank to browse all sessions. Review its history and download its JSON record.
6. Open the knowledge library to browse or search principles, data standards, and typical errors. If you edit the knowledge file, use Reload to read the updated file.
7. Use the help/status area for the service status and links to API documentation.

For another experiment, open “使用其他实验” and enter its experiment ID.

All supported API operations have visible entry points in the interface. See [ACCESSIBILITY.md](ACCESSIBILITY.md) for keyboard use and the remaining assistive-technology checks.

## Optional model mode

Edit `.env` in a text editor:

```dotenv
ENABLE_LLM=true
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5-mini
```

Use a model available to your account that supports the app's structured response format, then restart the server. The key stays on the server. The app displays whether each diagnosis used a model, local rules, or a fallback. Set `ENABLE_LLM=false` to disable model requests. Model requests include the submitted evidence; avoid entering information you do not intend to send.

## Data and common fixes

- **Saved work:** local sessions live in `data/adaptive_tutor.db`. Stop the server before backing up the `data` folder. A downloaded session JSON is a readable export; there is no JSON import operation.
- **Port already in use:** on macOS/Linux run `TUTOR_PORT=8001 sh start.sh`. In Windows Command Prompt, run `set TUTOR_PORT=8001` and then `start.cmd`. Open `http://127.0.0.1:8001`.
- **Python missing or too old:** install Python 3.11 or newer, reopen the terminal, and rerun the launcher. If an old `.venv` already exists, rename that folder before retrying.
- **No module named venv:** install your operating system's Python venv component, then rerun. The launcher does not install system software.
- **Page will not open:** wait for the terminal's server startup message; use `http://`, confirm the port, and check that the terminal is still running. Do not open `app/static/index.html` directly as a file.
- **Need a manual install:** use the commands in [README.md](README.md), which also covers Docker, API examples, knowledge-base editing, and tests.

The supplied launch commands are for use on your own computer. This MVP has no user accounts or per-student access control.
