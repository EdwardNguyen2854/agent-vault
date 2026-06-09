# Excel MCP Server

Stdio MCP wrapper around [`openpyxl`](https://openpyxl.readthedocs.io/) for agent-vault. Provides Excel workbook read/write operations: cell values, formulas, named ranges, sheet management, and data validation.

## Install

```bash
pip install -r requirements.txt
```

## Run

The bridge starts this server on demand. Register it from the Tools view (**Register** button) or via the bridge:

```json
{
  "name": "excel-mcp",
  "command": "python3",
  "args": ["servers/excel-mcp/server.py"]
}
```

## Tools

| Name                     | Description                                                           | Risk                           |
| ------------------------ | --------------------------------------------------------------------- | ------------------------------ |
| `excel.read_cells`       | Read cell values, formulas, and metadata from a range or entire sheet | low (`read-only`)              |
| `excel.write_cells`      | Write values or formulas to cells in a workbook                       | medium (`ask`)                 |
| `excel.list_sheets`      | List all sheet names in a workbook                                    | low (`read-only`)              |
| `excel.create_sheet`     | Add a new sheet to an existing workbook                               | medium (`ask`)                 |
| `excel.delete_sheet`     | Remove a sheet from a workbook                                        | high (`ask` + `confirm: true`) |
| `excel.get_named_ranges` | List all named ranges and their references                            | low (`read-only`)              |

## Security

- All operations are local file access only.
- `write` and `delete` operations are gated behind `ask` / `ask + confirm` permissions in the UI.
- No network access; no external data exfiltration.
- Path traversal is blocked; only valid `.xlsx` and `.xlsm` files are accepted.
