---
name: excel-automation
description: Automate Excel tasks using Power Query, DAX, PivotTables, Charts, and VBA. Use when working with Excel automation, Power Query transformations, DAX formulas, PivotTables, Charts, or VBA macros. Make sure to use this skill whenever the user mentions Excel, Power Query, DAX, PivotTables, Charts, VBA, or spreadsheet automation.
tags: [automation, excel, power-query, dax, vba, spreadsheets]
status: active
author: Nora
tools: []
memory: []
---

# Excel Automation

Automate Excel tasks using Power Query, DAX, PivotTables, Charts, and VBA.

## When to Use

This skill activates when:

- User asks about Excel automation
- Working with Power Query, DAX, or VBA
- Creating PivotTables or Charts
- Automating spreadsheet tasks

## Power Query

### Basic Pattern

```powerquery
let
    Source = Excel.CurrentWorkbook(){[Name="SourceData"]}[Content],
    FilteredRows = Table.SelectRows(Source, each [Status] = "Active"),
    Grouped = Table.Group(FilteredRows, {"Category"}, {
        {"Total", each List.Sum([Amount]), type number}
    })
in
    Grouped
```

### Merge Tables

```powerquery
let
    Source1 = Excel.CurrentWorkbook(){[Name="Orders"]}[Content],
    Source2 = Excel.CurrentWorkbook(){[Name="Customers"]}[Content],
    Merged = Table.NestedJoin(Source1, {"CustomerID"}, Source2, {"ID"}, "Joined"),
    Expanded = Table.ExpandTableColumn(Merged, "Joined", {"Name", "Email"})
in
    Expanded
```

## DAX Formulas

### Calculated Column

```dax
Profit Margin = DIVIDE([Revenue] - [Cost], [Revenue])
```

### Measure with Time Intelligence

```dax
YTD Total = TOTALYTD(SUM('Sales'[Amount]), 'Sales'[Date])
```

## VBA Best Practices

### Error Handling

```vba
Sub SafeOperation()
    On Error GoTo ErrorHandler
    ' Your code here
    Exit Sub
ErrorHandler:
    MsgBox "Error " & Err.Number & ": " & Err.Description
End Sub
```

### Performance

```vba
Sub FastLoop()
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual
    Application.EnableEvents = False
    ' Your loop code here
    Application.ScreenUpdating = True
    Application.Calculation = xlCalculationAutomatic
    Application.EnableEvents = True
End Sub
```

## Principles

1. **Prefer Power Query over VBA** for data transformation
2. **Use named ranges** for flexible references
3. **Document each step** in comments
4. **Test with sample data** before production
5. **Implement error handling** everywhere
6. **Keep it reversible** - backup before changes
