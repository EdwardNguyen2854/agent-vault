# MarkItDown MCP Server

Stdout MCP wrapper around [microsoft/markitdown](https://github.com/microsoft/markitdown) for agent-vault. Converts PDF, Word, Excel, PowerPoint, Outlook, HTML, CSV, JSON, XML, EPub, images, audio, ZIP, and YouTube URLs to Markdown.

## Install

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Default extras cover documents and Office files without bringing in Tesseract, ffmpeg, or Azure SDKs.

## Run

The bridge starts this server on demand. Register it from the Tools view (`Register MarkItDown` button) or via the bridge:

```json
{
  "name": "markitdown",
  "command": "python3",
  "args": ["servers/markitdown-mcp/server.py"]
}
```

## Tools

| Name                           | Description                                              | Risk                           |
| ------------------------------ | -------------------------------------------------------- | ------------------------------ |
| `markitdown.convert`           | Convert a local path or approved HTTP(S) URL to Markdown | medium (`ask`)                 |
| `markitdown.list_capabilities` | Report which optional-extras groups are installed        | low (`read-only`)              |
| `markitdown.install_extras`    | `pip install` a MarkItDown extras group                  | high (`ask` + `confirm: true`) |

## Security

- Local file paths use `convert_local` (narrowest API per MarkItDown's own guidance).
- HTTP(S) fetches block loopback, link-local, and private CIDR ranges to avoid SSRF.
- `install_extras` refuses to run without `confirm: true` and is permission-gated in the UI.

## Add more formats

From the Tools view, open MarkItDown's detail drawer and use **Install extras…** to add groups like `ocr`, `audio-transcription`, or `az-doc-intel`.
