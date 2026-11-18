# Connect your AI assistant

Your AI assistant can use data from your Cresavo studio to answer questions
and draft changes. Ask what times are open for a treatment, or ask it to draft
a booking move for you to review. Try it today with a fictional salon and a
local test setup.

You give the final yes before a proposed change takes effect in the demo
Inbox or the bundled approval walkthrough. Cresavo only shares tool results
with the assistant you connect. If that assistant uses an online AI service,
the results it reads can go to that service.

## What works today

### Owner MCP on your computer

MCP is a way for an assistant to call tools in Cresavo. The owner server
communicates with its client over standard input and output (`stdio`). It
opens no HTTP port. In normal mode it reads the booking engine's PostgreSQL
database for the seeded demo business. The studio's browser data is separate.

| Server flags for `npm run mcp` | Access |
| --- | --- |
| No flags | Read active treatments and available times. |
| `--admin` | Also read limited calendar and booking history, staff and schedules, inactive treatments, and suggestions for filling gaps. Also saves unpublished campaign drafts directly without a confirmation prompt. Publication is a separate manual step in the admin workspace. |
| `--admin --allow-bookings` | Adds creation of fictional bookings with an `@example.test` email, a stable request ID and `confirmed: true`. |
| `--admin --allow-workspace` | Adds booking creation, moves and cancellations, treatment and staff edits, and decisions on suggestions for filling gaps. These tools require a stable request ID and `confirmed: true`. The campaign draft tool from `--admin` still saves immediately. |
| `--admin --capacity-only` | Keeps the basic reads and limits admin tools to reading suggestions for filling gaps. Adding `--allow-workspace` enables dismissing a suggestion or saving a draft from it. |

`--admin` trusts whoever launched the local process. It uses no admin login.
Both write opt-in flags require `--admin` and a `SESSION_SECRET` of at least
32 characters. The server takes `confirmed: true` from the caller, so a
third-party client can supply it without asking you. The examples below use
no admin or write flags. The repo also has a dedicated read-only workday card
demo for a guarded local test database.
See [the owner server](../src/mcp/server.ts), [booking options](../src/mcp/booking.ts)
and [workspace tools](../src/mcp/workspace.ts).

### Concept demo MCP

On a local concept server, `/api/concept/mcp` accepts Streamable HTTP with
a shared demo bearer token (`CONCEPT_MCP_TOKEN`, at least 16 characters after
trimming). Development has a built-in fallback token. Production requires a
configured token. The token grants demo access across the endpoint.

The endpoint reads a fictional, in-memory copy of Salong Eko, separate from
your browser and from PostgreSQL. Tools can read bookings, availability and
other demo data, or draft changes such as a move or price edit. Drafts are
stored as pending proposals. Open `/studio/inbox` on the same local instance
to review and apply or decline one. The local demo uses a same-origin check for
decisions and has no owner sign-in. Proposals reset on server restart or on a
new salon day. Start `npm run dev` locally and run `npm run concept:mcp-demo`
in a second terminal to try a move proposal with fictional data.

On the public read-only demo (`PUBLIC_READONLY=1`), the endpoint returns HTTP
403 for reads and writes. The public studio is available for hands-on use in
your browser. See [the route](../src/app/api/concept/mcp/route.ts),
[the handler](../src/concept/server/mcp.ts) and
[the demo data store](../src/concept/server/demo-business.ts).

### Agent API v1

The booking engine's sandbox REST API lists services and availability and
supports creating, checking and cancelling bookings. A scoped agent credential
ties calls to a business and a stable agent client. Creating a booking requires
a stored test mandate (a grant for the specific booking), an `Idempotency-Key`
for safe retries and fictional contact details. Cancellation uses the agent's
write scope and booking ownership. The optional local proposal lab uses
synthetic customer approval. Rescheduling is outside v1.

Read the [OpenAPI contract](agent-api-v1.openapi.yaml) or get it from
`/api/v1/openapi` on the booking engine. Standalone engine installs also expose
the agent tools at `/api/v1/mcp`. In split mode that MCP route is disabled and
provider operations require the gateway's service credential as well as agent
authentication. See [the split contract](GATEWAY_SPLIT.md).

### Customer agent gateway

The separate `booking-lab-gateway` repo is private. The split contract records
a local test with a separate REST/MCP gateway and booking engine, fictional
bookings and a matching entry in the owner's calendar. The engine keeps the
database and enforces the booking rules. A public connection for customers'
agents is coming soon, with no release date. See [the gateway split contract](GATEWAY_SPLIT.md).

## Set up a local connection

1. Install Node.js 22.12+ or 24+, then follow the
   [booking engine setup](../README.md#self-hosting) through migration and
   seeding. Use a separate local PostgreSQL database ending in `_demo` or
   `_test` and fictional data. The read-only MCP check needs installed
   dependencies, a generated Prisma client and `DATABASE_URL` in the
   checkout's private `.env` file. This check runs without an admin account
   or a web server. Leave `PUBLIC_READONLY` unset or set it to `0` to read
   PostgreSQL. Setting it to `1` uses fixtures and disables admin tools.
2. From the checkout, run `npm run mcp:client`. It launches the local server,
   lists `list_services` and `get_availability`, and calls both. Check the
   treatment list and any available times. `npm run mcp` is the server entry
   point. Both scripts load `.env`. The configs below launch the same server
   directly so stdout carries only MCP messages.
3. To see a write with an approval prompt, run
   `npm run mcp:client -- --admin --workspace` on the disposable database
   with `SESSION_SECRET` set in `.env`. The client shows each proposed step
   and asks you to type `ja` (Swedish for yes). Press Enter without `ja` to
   stop. Steps you already approved stay saved. The smaller
   `npm run mcp:client -- --admin --book` walkthrough prompts before one test
   booking. The bare `--admin` client saves a campaign draft without prompting.
   See [the client](../src/mcp/client.ts) and
   [the workspace walkthrough](../src/mcp/workspace-client.ts).

Replace `/absolute/path/to/node` with the full path to Node and
`/absolute/path/to/cresavo` with your checkout. On Windows use paths such as
`C:/tools/node.exe` and `C:/work/cresavo`, with `file:///C:/work/…` for the
`--import` URL. URL-encode spaces as `%20` in the `file:` URL. Keep credential
values in your private local environment file.

Once connected, change the price of a fictional treatment in the local
`/admin` workspace, then ask the assistant to call `list_services` again.
The new price should come from your test database.

### Claude Desktop

1. Open **Settings → Developer → Edit Config**. This opens
   `claude_desktop_config.json`. Add the `cresavo` entry under `mcpServers`,
   keeping any existing entries. [MCP's Claude Desktop setup guide](https://modelcontextprotocol.io/docs/develop/connect-local-servers)

   ```json
   {
     "mcpServers": {
       "cresavo": {
         "command": "/absolute/path/to/node",
         "args": [
           "--env-file=/absolute/path/to/cresavo/.env",
           "--import=file:///absolute/path/to/cresavo/node_modules/tsx/dist/loader.mjs",
           "/absolute/path/to/cresavo/src/mcp/server.ts"
         ]
       }
     }
   }
   ```

2. Quit and reopen Claude Desktop. In the composer, open the connectors menu
   and check that `cresavo` appears. Ask “Use Cresavo to list the treatments
   in my test salon.” [Claude Desktop restart and tool discovery](https://modelcontextprotocol.io/docs/develop/connect-local-servers)

### Claude Code

1. Add the same JSON from the Claude Desktop section to `.mcp.json` in the
   root of the project you open with Claude Code. The `command` and `args`
   entry defaults to stdio. To keep the entry in your private Claude Code
   settings for this project, use this command from its root instead.
   [Anthropic's MCP setup and scopes](https://code.claude.com/docs/en/mcp)

   ```bash
   claude mcp add --transport stdio --scope local cresavo -- \
     "/absolute/path/to/node" \
     "--env-file=/absolute/path/to/cresavo/.env" \
     "--import=file:///absolute/path/to/cresavo/node_modules/tsx/dist/loader.mjs" \
     "/absolute/path/to/cresavo/src/mcp/server.ts"
   ```

2. Run `claude` in that project. If you used `.mcp.json`, review and approve
   the project server when prompted. Use `/mcp` to check the connection, then
   ask Claude to call `list_services`. [Claude Code server status](https://code.claude.com/docs/en/mcp#managing-your-servers)

### Codex CLI

1. Add the following to `~/.codex/config.toml` or to `.codex/config.toml` in
   a trusted local project. [OpenAI's Codex CLI MCP guide](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

   ```toml
   [mcp_servers.cresavo]
   command = "/absolute/path/to/node"
   args = [
     "--env-file=/absolute/path/to/cresavo/.env",
     "--import=file:///absolute/path/to/cresavo/node_modules/tsx/dist/loader.mjs",
     "/absolute/path/to/cresavo/src/mcp/server.ts",
   ]
   ```

2. Start a local `codex` session, check `/mcp`, then ask Codex to call
   `list_services`. [Codex MCP commands](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

### ChatGPT

**Desktop app.** In a local Codex chat in the ChatGPT desktop app, you can
reuse the Codex CLI config above. You can also open **Settings → MCP servers →
Add server**, choose **STDIO**, name it `cresavo`, and enter the same Node
command and three arguments. Save and restart, then check `/mcp` and ask for
your test treatments. OpenAI lists local desktop chats and MCP under its Work
and Codex plans. Account and workspace settings can limit access.
[Desktop MCP setup](https://learn.chatgpt.com/docs/extend/mcp?surface=app) ·
[Plan comparison](https://learn.chatgpt.com/docs/pricing)

**Web.** ChatGPT web uses custom MCP connections through Plugins. Full MCP
with write-capable tools is available to Business, Enterprise and Edu. Business
setup requires an admin or owner. Enterprise and Edu can also grant selected
members permission to create connections. OpenAI lists read/fetch-only custom
MCP connections for Pro. Open **Plugins** to add a server. If your workspace
still uses legacy apps, look for **Apps → Create** in workspace or user
settings. The web app needs a reachable HTTPS MCP endpoint or an OpenAI Secure
MCP Tunnel. Cresavo has no one-click app or verified public MCP connection.
[OpenAI's current plan and workspace requirements](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt)

For an eligible workspace, this is the documented tunnel setup to try with
the read-only owner server and fictional data. The Cresavo-to-ChatGPT web
connection still needs an end-to-end test.

1. In OpenAI Platform, create a Secure MCP Tunnel, associate it with your
   ChatGPT workspace and install `tunnel-client`. The creator needs **Tunnels
   Read + Manage**. The operator and runtime key need **Tunnels Read + Use**.
   Supply the runtime key privately through `CONTROL_PLANE_API_KEY` in the
   tunnel client's environment. [OpenAI's Secure MCP Tunnel guide](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)
2. Set up the local stdio command and keep the tunnel client running while
   testing. Replace `YOUR_TUNNEL_ID` with the issued tunnel ID.

   ```bash
   tunnel-client init --sample sample_mcp_stdio_local --profile cresavo \
     --tunnel-id YOUR_TUNNEL_ID \
     --mcp-command '"/absolute/path/to/node" "--env-file=/absolute/path/to/cresavo/.env" "--import=file:///absolute/path/to/cresavo/node_modules/tsx/dist/loader.mjs" "/absolute/path/to/cresavo/src/mcp/server.ts"'
   tunnel-client doctor --profile cresavo --explain
   tunnel-client run --profile cresavo
   ```

3. In ChatGPT web, open **Plugins → + → Add custom MCP server**. Name it
   `Cresavo test salon`, choose **Tunnel** under **Connection** and select
   your tunnel. For this stdio server choose **No authentication** at the MCP
   layer. The tunnel has separate workspace and runtime access controls.
   Review the warning, select **Create as a plugin**, and check that discovery
   shows only `list_services` and `get_availability`. Install the private
   plugin for testing and ask it to list the test treatments.
   [OpenAI's custom plugin instructions](https://developers.openai.com/api/docs/guides/custom-mcp-server)

## Safety and disconnecting

- **Approval.** Review each proposed change in the local demo Inbox or answer
  each prompt in the bundled write walkthrough. Leave your assistant's MCP
  connection in the default read-only mode. Giving it admin flags trusts it
  with the write tools listed above.
- **Data access.** The default local tools see treatments and free times.
  Admin reads add limited booking details, staff schedules and capacity
  suggestions. Booking reads omit customer names and emails. No owner MCP
  tool searches the customer register or reads treatment notes. The separate
  concept MCP can show fictional customer names and activity summaries.
  The local stdio server has no network listener. Your assistant can still
  send tool results to its AI provider as part of the conversation.
- **Revoke access.** Remove `cresavo` from Claude Desktop's JSON and restart
  it. In Claude Code, remove the `.mcp.json` entry or run
  `claude mcp remove cresavo --scope local` for the CLI setup. In Codex and
  ChatGPT desktop, remove the `cresavo` MCP entry and restart the session.
  In ChatGPT web, remove the private plugin and stop and revoke its tunnel
  when you no longer need it. For concept HTTP, rotate `CONCEPT_MCP_TOKEN`
  or stop the local server. For Agent API v1, an operator can run
  `npm run agent-keys -- revoke <id-or-public-prefix>` against the relevant
  engine database. Disconnecting stops future access. Results already shared
  can remain in the assistant's conversation history.

## Roadmap

| Integration | Status | What it would enable |
| --- | --- | --- |
| One-click app in ChatGPT | Coming soon · no release date | Connect your studio from ChatGPT without manual MCP setup. |
| One-click app in Claude | Coming soon · no release date | Connect your studio from Claude without editing a config file. |
| Booking through customers' AI agents | Coming soon · no release date | Use the separate gateway for customer booking. MCP has a private lab implementation. The demo already has a read-only A2A prototype and a USP discovery profile. Customer booking through these protocols is still planned. |
| Grok | Coming soon · no release date | A Cresavo connection with a verified setup for Grok. |
| Gemini | Coming soon · no release date | A Cresavo connection with a verified setup for Gemini. |

See the [Cresavo roadmap](ROADMAP.md) and
[open protocols goal](goals/QUEUE.md#10--open-protocols-for-the-concept).
The [demo discovery code](../src/concept/server/discovery.ts) describes
what the A2A card and USP profile expose today.
