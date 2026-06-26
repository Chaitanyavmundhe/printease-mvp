# Office preparation and bill confirmation

PrintEase must not price DOCX, PPTX, XLSX, or other Office-style files as a fake one-page document.

Current rule:

- PDF, image, and text files can be prepared in the browser when supported.
- Office files are uploaded as originals and marked for hub desktop preparation.
- The backend stores the order with `payment_status = not_requested`, `status = awaiting_hub_bill_confirmation`, and `bill_status = awaiting_hub_confirmation`.
- The desktop agent may predownload and convert the file locally with LibreOffice/soffice, then report the prepared page count.
- After all files in the order are prepared, the backend recalculates pages, sheets, print options, and total bill from hub pricing.
- If the order was waiting for desktop preparation, the recalculated bill becomes the confirmed bill and payment can start.

Security and correctness cautions:

- Do not run Office conversion on the Render/backend server. It is intentionally desktop-side or browser-side only.
- Do not default unknown Office page counts to `1`.
- Do not auto-mark cash as collected. Bill confirmation only confirms the payable amount.
- Do not print before payment is verified or cash/manual UPI is collected by the hub.
- Do not allow payment while any order file still has `preparation_status = pending`.

