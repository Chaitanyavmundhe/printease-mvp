# Print Configuration Test Matrix

This document outlines the testing scenarios required to validate the PrintEase print engine correction features.

## OS Compatibility

| Operating System | PDF Pre-processing (pdf-lib) | Native OS Command | Engine Used |
|------------------|------------------------------|-------------------|-------------|
| Windows 10/11    | Always uses pdf-lib for prep | `SumatraPDF.exe`  | SumatraPDF  |
| Linux (Debian)   | Uses pdf-lib only if needed  | `lp`              | CUPS        |

## Test Scenarios

### Scenario 1: Long Edge Duplex (Book Binding)
- **Input:** 2-page PDF
- **Config:** Double-sided, Long Edge
- **Expected Result:** Both pages printed, readable in the same direction when flipping like a book.
- **Correction Action:** If inverted, set `backSideRotation: rotate-180`.

### Scenario 2: Short Edge Duplex (Calendar Binding)
- **Input:** 2-page PDF
- **Config:** Double-sided, Short Edge
- **Expected Result:** When flipping the paper from bottom-to-top, the text is readable.
- **Correction Action:** If inverted, set `backSideRotation: rotate-180`.

### Scenario 3: Page Order Reversal
- **Input:** 3-page PDF
- **Config:** Single-sided
- **Expected Result:** Pages output face-up should be stacked as 1, 2, 3 from top to bottom.
- **Correction Action:** If stacking is reversed (3, 2, 1), set `reversePageOrder: true`.

### Scenario 4: Scaling & Margins
- **Input:** PDF with tight 2mm margins
- **Config:** Fit to Page vs Actual Size
- **Expected Result:** 'Fit to Page' shrinks the document to ensure no cut-off. 'Actual Size' prints exactly as-is, potentially clipping 2mm.
- **Correction Action:** Update `scaleMode` to `fit-to-page` or `actual-size` based on printer margin handling.

### Scenario 5: Landscape Auto Duplexing
- **Input:** Landscape PDF
- **Config:** Double-sided (Auto binding)
- **Expected Result:** System automatically falls back to `short-edge` binding for landscape to ensure book-like flipping along the short edge.

## Testing Procedure
1. Pair a local printer using the Hub Dashboard.
2. Open the Printers & Agents page.
3. Click **Run Test Wizard** on the desired local printer.
4. Follow the interactive steps, triggering 1-3 test prints.
5. Answer the physical output questions in the Wizard.
6. The Desktop Shell will automatically apply the created correction profile to all future print jobs.
