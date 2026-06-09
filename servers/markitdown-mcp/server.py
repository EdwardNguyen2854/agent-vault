#!/usr/bin/env python3
"""MarkItDown MCP Server — convert files and office documents to Markdown.

Thin stdio MCP wrapper around `microsoft/markitdown`. Communicates over the
same Content-Length framed JSON-RPC protocol as `servers/excel-mcp/server.py`,
so the Node bridge needs no changes.

Tools:
  - markitdown.convert         Convert a local path or approved URL to Markdown
  - markitdown.list_capabilities  Report the optional-extras groups that are installed
  - markitdown.install_extras   pip-install an optional-extras group (gated)
"""

import json
import os
import re
import subprocess
import sys
import traceback
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

try:
    from markitdown import MarkItDown
except ImportError:
    print(
        "Missing markitdown. Install with: pip install -r requirements.txt",
        file=sys.stderr,
    )
    sys.exit(1)


# ---------------------------------------------------------------------------
# JSON-RPC framing
# ---------------------------------------------------------------------------

def read_message() -> dict | None:
    buf = b""
    while True:
        chunk = sys.stdin.buffer.read1(4096)
        if not chunk:
            return None
        buf += chunk
        idx = buf.find(b"\r\n\r\n")
        if idx == -1:
            continue
        header = buf[:idx].decode("ascii")
        match = re.search(r"Content-Length:\s*(\d+)", header)
        if not match:
            buf = buf[idx + 4:]
            continue
        length = int(match.group(1))
        body_start = idx + 4
        if len(buf) < body_start + length:
            continue
        body = buf[body_start:body_start + length]
        buf = buf[body_start + length:]
        return json.loads(body.decode("utf-8"))


def write_message(msg: dict) -> None:
    body = json.dumps(msg, ensure_ascii=False)
    header = f"Content-Length: {len(body.encode('utf-8'))}\r\n\r\n"
    sys.stdout.buffer.write(header.encode("ascii") + body.encode("utf-8"))
    sys.stdout.buffer.flush()


def send_result(msg_id: Any, result: Any) -> None:
    write_message({"jsonrpc": "2.0", "id": msg_id, "result": result})


def send_error(msg_id: Any, code: int, message: str) -> None:
    write_message(
        {"jsonrpc": "2.0", "id": msg_id, "error": {"code": code, "message": message}}
    )


# ---------------------------------------------------------------------------
# Tool definitions
# ---------------------------------------------------------------------------

SUPPORTED_SCHEMES = ("file", "http", "https")
ALLOWED_EXTRAS_GROUPS = (
    "pdf",
    "docx",
    "pptx",
    "xlsx",
    "xls",
    "outlook",
    "az-doc-intel",
    "az-content-understanding",
    "audio-transcription",
    "youtube-transcription",
    "ocr",
)

TOOLS: list[dict] = [
    {
        "name": "markitdown.convert",
        "description": (
            "Convert a file path or approved HTTP(S) URL to Markdown using "
            "Microsoft MarkItDown. Returns the Markdown text and suggested metadata."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "uri": {
                    "type": "string",
                    "description": (
                        "file:// path, /absolute/path, or http(s):// URL. "
                        "Local file paths are preferred for in-vault files."
                    ),
                },
                "file_type": {
                    "type": "string",
                    "description": "Optional hint for the source extension (e.g. pdf, docx).",
                },
                "output_path": {
                    "type": "string",
                    "description": "Optional vault-relative path for a Markdown sidecar.",
                },
            },
            "required": ["uri"],
        },
    },
    {
        "name": "markitdown.list_capabilities",
        "description": "List the optional-extras groups currently installed in this Python environment.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "markitdown.install_extras",
        "description": (
            "pip-install a MarkItDown extras group to enable additional file types. "
            "Requires confirm=true and a granted high-risk permission."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "group": {
                    "type": "string",
                    "enum": list(ALLOWED_EXTRAS_GROUPS),
                    "description": "The extras group to install (e.g. 'pdf', 'ocr').",
                },
                "confirm": {
                    "type": "boolean",
                    "description": "Must be true to actually run pip.",
                },
            },
            "required": ["group", "confirm"],
        },
    },
]


TOOL_HANDLERS: dict[str, Any] = {}


def tool(name: str):
    def decorator(fn):
        TOOL_HANDLERS[name] = fn
        return fn

    return decorator


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalize_uri(uri: str) -> str:
    if uri.startswith("file://"):
        return uri
    if uri.startswith("http://") or uri.startswith("https://"):
        parsed = urlparse(uri)
        host = (parsed.hostname or "").lower()
        if host in {"localhost", "127.0.0.1", "::1", "0.0.0.0"}:
            raise ValueError(f"Refusing to fetch loopback host: {host}")
        if host.startswith(("127.", "10.", "192.168.", "169.254.")) or host.endswith(
            ".internal"
        ):
            raise ValueError(f"Refusing to fetch private address: {host}")
        return uri
    # Treat as a local filesystem path
    return str(Path(uri).expanduser())


def _is_local_path(uri: str) -> bool:
    if uri.startswith("file://"):
        return True
    return not (uri.startswith("http://") or uri.startswith("https://"))


def _suggest_title(uri: str, markdown: str) -> str | None:
    for line in markdown.splitlines()[:20]:
        m = re.match(r"\s*#\s+(.+)$", line)
        if m:
            return m.group(1).strip()[:200]
    name = urlparse(uri).path if uri.startswith(("http://", "https://")) else uri
    if name:
        base = os.path.basename(name.rstrip("/")) or "untitled"
        return os.path.splitext(base)[0]
    return None


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------

@tool("markitdown.convert")
def handle_convert(args: dict) -> dict:
    uri = args.get("uri")
    if not isinstance(uri, str) or not uri.strip():
        return {"error": "uri is required"}
    try:
        normalized = _normalize_uri(uri)
    except ValueError as exc:
        return {"error": str(exc)}

    if not _is_local_path(normalized):
        parsed = urlparse(normalized)
        if parsed.scheme not in SUPPORTED_SCHEMES:
            return {"error": f"Unsupported URI scheme: {parsed.scheme}"}

    md = MarkItDown()
    try:
        if _is_local_path(normalized):
            path = normalized[len("file://"):] if normalized.startswith("file://") else normalized
            path = str(Path(path).expanduser().resolve())
            if not os.path.exists(path):
                return {"error": f"File not found: {path}"}
            result = md.convert_local(path)
        else:
            result = md.convert(normalized)
    except Exception as exc:  # noqa: BLE001
        return {"error": f"{type(exc).__name__}: {exc}"}

    markdown = getattr(result, "text_content", "") or ""
    return {
        "markdown": markdown,
        "byte_size": len(markdown.encode("utf-8")),
        "suggested_title": _suggest_title(normalized, markdown),
        "source": normalized,
        "file_type": args.get("file_type"),
    }


@tool("markitdown.list_capabilities")
def handle_list_capabilities(args: dict) -> dict:
    installed: dict[str, bool] = {}
    for group in ALLOWED_EXTRAS_GROUPS:
        try:
            __import__(f"markitdown[{group}]".replace("[", "_").replace("]", ""))
            installed[group] = True
        except Exception:
            # Fall back to a best-effort import probe via pip show
            r = subprocess.run(
                [sys.executable, "-m", "pip", "show", f"markitdown[{group}]"],
                capture_output=True,
                text=True,
            )
            installed[group] = r.returncode == 0
    return {
        "groups": installed,
        "default_installed": [
            g for g in ("pdf", "docx", "pptx", "xlsx", "outlook") if installed.get(g)
        ],
    }


@tool("markitdown.install_extras")
def handle_install_extras(args: dict) -> dict:
    group = args.get("group")
    confirm = bool(args.get("confirm"))
    if not isinstance(group, str) or group not in ALLOWED_EXTRAS_GROUPS:
        return {"error": f"Unknown extras group: {group!r}"}
    if not confirm:
        return {"error": "Refusing to run pip without confirm=true"}
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "pip", "install", f"markitdown[{group}]"],
            capture_output=True,
            text=True,
            timeout=300,
        )
    except subprocess.TimeoutExpired:
        return {"error": "pip install timed out after 300s"}
    return {
        "returncode": proc.returncode,
        "stdout_tail": proc.stdout[-2000:],
        "stderr_tail": proc.stderr[-2000:],
    }


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main() -> None:
    while True:
        msg = read_message()
        if msg is None:
            break

        method = msg.get("method")
        msg_id = msg.get("id")
        params = msg.get("params", {})

        if method == "initialize":
            send_result(
                msg_id,
                {
                    "protocolVersion": "0.1",
                    "capabilities": {"tools": {}},
                    "serverInfo": {"name": "markitdown-mcp", "version": "0.1.0"},
                },
            )

        elif method == "initialized":
            continue

        elif method == "tools/list":
            send_result(msg_id, {"tools": TOOLS})

        elif method == "tools/call":
            name = params.get("name")
            arguments = params.get("arguments", {})

            handler = TOOL_HANDLERS.get(name)
            if not handler:
                send_error(msg_id, -32601, f"Tool not found: {name}")
                continue

            try:
                result = handler(arguments)
                if isinstance(result, dict) and "error" in result and "markdown" not in result:
                    send_result(
                        msg_id,
                        {
                            "content": [{"type": "text", "text": result["error"]}],
                            "isError": True,
                        },
                    )
                else:
                    send_result(
                        msg_id,
                        {
                            "content": [
                                {"type": "text", "text": json.dumps(result, ensure_ascii=False, indent=2)}
                            ],
                        },
                    )
            except Exception as exc:  # noqa: BLE001
                send_result(
                    msg_id,
                    {
                        "content": [
                            {
                                "type": "text",
                                "text": f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}",
                            }
                        ],
                        "isError": True,
                    },
                )

        elif method == "shutdown":
            send_result(msg_id, {})
            break

        else:
            send_error(msg_id, -32601, f"Method not found: {method}")


if __name__ == "__main__":
    main()
