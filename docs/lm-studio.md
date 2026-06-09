# LM Studio

Agent Vault includes an OpenAI-compatible chat interface backed by a local LM Studio server.

## Development setup

In development, the Vite dev server proxies `/lms/*` to `http://localhost:1234/*` (LM Studio's default local server). The app's default `baseUrl` is `/lms/v1` and the browser sees same-origin requests.

1. Make sure LM Studio is running with **Start Server** enabled in the Developer tab.
2. Load at least one model.
3. Open Agent Vault at `http://localhost:5173`.
4. The chat panel will use `/lms/v1` by default — no extra configuration needed.

## Production setup

In a production build served from a static host, `/lms/*` is meaningless because the Vite dev server proxy is not active.

1. Set the AI **Base URL** in Settings to `http://localhost:1234/v1` (or your remote LM Studio URL).
2. In LM Studio's Developer → Local Server settings, enable **CORS** for your app's origin.
3. Chat, models, and streaming endpoints are OpenAI-compatible — no other changes are needed.

## Endpoints used

| Endpoint                    | Purpose                                                       |
| --------------------------- | ------------------------------------------------------------- |
| `POST /v1/chat/completions` | Send messages and receive a streamed or non-streamed response |
| `GET /v1/models`            | List available models                                         |
| `POST /v1/completions`      | Direct completion (not used by the chat UI)                   |
