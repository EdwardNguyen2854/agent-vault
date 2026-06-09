---
type: tool
provider: mcp
server: excel-mcp
tool_id: excel-mcp
status: active
permission: ask
risk: medium
description: Cross-platform Excel file automation via openpyxl — read, write, create, and manage .xlsx workbooks.
---

# Excel MCP Server

Cross-platform Excel file automation server using openpyxl. Reads and writes `.xlsx` files directly — no Excel installation required. Works on macOS, Linux, and Windows.

## Requirements

- Python 3 with openpyxl (`pip install openpyxl`)

## Tools

| Tool                 | Description                                     |
| -------------------- | ----------------------------------------------- |
| `excel_open`         | Open an existing workbook and keep it in memory |
| `excel_create`       | Create a new workbook                           |
| `excel_list_sheets`  | List all sheet names                            |
| `excel_read`         | Read cell values from a sheet                   |
| `excel_write`        | Write values to individual cells                |
| `excel_write_range`  | Write a 2D array starting at a cell             |
| `excel_save`         | Save workbook to disk                           |
| `excel_close`        | Close a workbook                                |
| `excel_create_sheet` | Create a new sheet                              |
| `excel_delete_sheet` | Delete a sheet                                  |

## Setup

The server is located at `servers/excel-mcp/server.py`. Register it with the bridge:

```bash
curl -X POST http://localhost:7777/servers \
  -H "Content-Type: application/json" \
  -d '{"name":"excel-mcp","command":"python3","args":["servers/excel-mcp/server.py"]}'
```

## Safety

This tool reads and writes `.xlsx` files on the local filesystem. Permission is set to **ask** by default.

Related: [[Agents/Profiles/Nora/SOUL]], [[Knowledge/MCP Notes]]
