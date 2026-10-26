export default function FileSettingsPanel({ activeConfig, setConfigVal, isCompact = false, layoutType = "default" }) {
  const isDialog = layoutType === "dialog";

  const containerClass = isDialog
    ? "flex h-full flex-col gap-4 overflow-y-auto bg-white p-3 sm:gap-5 sm:p-5"
    : isCompact
      ? "pe-settings-grid border-t border-slate-100 pt-3"
      : "pe-settings-grid";
      
  const labelClass = isDialog
    ? "grid gap-1.5 text-sm font-semibold text-slate-700 w-full"
    : isCompact
      ? "grid gap-1 text-xs font-semibold text-slate-600"
      : "grid gap-1 sm:gap-2 text-sm font-semibold text-slate-600 col-span-1 min-w-0";
      
  const inputClass = isDialog
    ? "w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
    : isCompact
      ? "rounded-xl border px-2 py-1.5 font-normal text-slate-900 outline-none focus:ring-2 focus:ring-slate-300"
      : "w-full min-w-0 rounded-2xl border px-2 sm:px-3 py-2 text-sm sm:text-base font-normal text-slate-900 outline-none focus:ring-2 focus:ring-slate-300";

  const selectClass = isDialog
    ? "w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
    : isCompact
      ? "rounded-xl border px-2 py-1.5 font-normal text-slate-900"
      : "w-full min-w-0 rounded-2xl border px-2 sm:px-3 py-2 text-sm sm:text-base font-normal text-slate-900";

  return (
    <div className={`pe-settings ${containerClass}`}>

      <label className={labelClass}>
        {isCompact ? "Range" : "Page range"}
        <input value={activeConfig?.selectedPages || ""} onChange={(e) => setConfigVal("selectedPages", e.target.value)} placeholder={isCompact ? "1,3-4" : "All, or 1,3-4"} className={inputClass} />
      </label>
      <label className={labelClass}>
        {isCompact ? "Color" : "Color mode"}
        <select value={activeConfig?.colorType || "bw"} onChange={(e) => setConfigVal("colorType", e.target.value)} className={selectClass}>
          <option value="bw">{isDialog ? "Black & White" : "B/W"}</option>
          <option value="color">Color</option>
        </select>
      </label>
      <label className={labelClass}>
        Sides
        <select value={activeConfig?.sideType || "single"} onChange={(e) => setConfigVal("sideType", e.target.value)} className={selectClass}>
          <option value="single">Single</option>
          <option value="double">Double</option>
        </select>
      </label>
      <label className={labelClass}>
        {isCompact ? "Size" : "Paper size"}
        <select value={activeConfig?.paperSize || "A4"} onChange={(e) => setConfigVal("paperSize", e.target.value)} className={selectClass}>
          <option value="A4">A4</option>
          <option value="A3">A3</option>
          <option value="Letter">Letter</option>
          <option value="Legal">Legal</option>
        </select>
      </label>
      <label className={`pe-orientation-field ${labelClass}`}>
        {isCompact ? "Layout" : "Orientation"}
        <select value={activeConfig?.orientation || "auto"} onChange={(e) => setConfigVal("orientation", e.target.value)} className={selectClass}>
          <option value="auto">Auto</option>
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>
      </label>
      <label className={labelClass}>
        Scale
        <select value={activeConfig?.scaleMode || "original"} onChange={(e) => setConfigVal("scaleMode", e.target.value)} className={selectClass}>
          <option value="original">{isDialog ? "Original size" : "Original"}</option>
          <option value="fit_to_page">{isDialog ? "Fit to page" : "Fit page"}</option>
          <option value="fit_to_page_width">{isDialog ? "Fit to page width" : "Fit width"}</option>
        </select>
      </label>
      <label className={`pe-margins-field ${labelClass}`}>
        Margins
        <select value={activeConfig?.marginMode || "default"} onChange={(e) => setConfigVal("marginMode", e.target.value)} className={isDialog ? "w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition" : isCompact ? "rounded-xl border px-2 py-1.5 font-normal text-slate-900" : "rounded-2xl border px-4 py-3 font-normal text-slate-900"}>
          <option value="default">Default</option>
          <option value="minimum">Minimum</option>
          <option value="none">None</option>
        </select>
      </label>

      {/* Match the three-column print options without changing their values or
          setters. Watermark details keep their own wider, full-row section. */}
      <div className="pe-settings-numeric">
        <label className={labelClass}>
          Copies
          <input type="number" min="1" value={activeConfig?.copies ?? 1} onChange={(e) => setConfigVal("copies", e.target.value === "" ? "" : Number(e.target.value))} className={inputClass} />
        </label>
        <label className={labelClass}>
          Pages per sheet
          <select value={activeConfig?.pagesPerSheet || 1} onChange={(e) => setConfigVal("pagesPerSheet", Number(e.target.value))} className={selectClass}>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={4}>4</option>
            <option value={6}>6</option>
            <option value={9}>9</option>
            <option value={16}>16</option>
          </select>
        </label>
        <label className={labelClass}>
          Quality (DPI)
          <select value={activeConfig?.printDpi || 300} onChange={(e) => setConfigVal("printDpi", Number(e.target.value))} className={selectClass}>
            <option value={203}>203</option>
            <option value={300}>300</option>
            <option value={600}>600</option>
          </select>
        </label>
      </div>
      
      {isDialog && <hr className="border-slate-200 my-2" />}

      <label className={`pe-watermark-toggle ${isDialog ? "flex items-center gap-3 w-full" : isCompact ? "flex items-center gap-2 border px-3 py-2 bg-white" : "flex items-center gap-3 border px-4 py-3"}`}>
        <input type="checkbox" checked={activeConfig?.watermark || false} onChange={(e) => setConfigVal("watermark", e.target.checked)} className={isDialog ? "w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" : ""} />
        <span className={isDialog ? "text-sm font-semibold text-slate-700" : isCompact ? "text-xs font-semibold" : ""}>{isCompact ? "Add watermark" : "Add watermark to printable PDF"}</span>
      </label>
      {activeConfig?.watermark && (
        <div className={`pe-watermark-options ${isDialog ? "grid gap-3 w-full bg-slate-50 p-4 border" : isCompact ? "grid gap-3 border bg-white p-3 min-[380px]:grid-cols-2 md:grid-cols-4" : "grid gap-3 border bg-slate-50 p-4 sm:grid-cols-2"}`}>
          <select aria-label="Watermark content" value={activeConfig?.watermarkType || "order_code"} onChange={(e) => setConfigVal("watermarkType", e.target.value)} className={isDialog ? selectClass : isCompact ? "rounded-xl border px-2 py-1.5 text-xs col-span-1" : "rounded-2xl border px-4 py-3"}>
            <option value="order_code">Order code</option>
            <option value="pickup_code">Pickup code</option>
            <option value="date_time">Date/time</option>
            <option value="custom_text">Custom text</option>
          </select>
          <select aria-label="Watermark position" value={activeConfig?.watermarkPosition || "bottom_right"} onChange={(e) => setConfigVal("watermarkPosition", e.target.value)} className={isDialog ? selectClass : isCompact ? "rounded-xl border px-2 py-1.5 text-xs col-span-1" : "rounded-2xl border px-4 py-3"}>
            <option value="bottom_right">Bottom right</option>
            <option value="bottom_center">Bottom center</option>
            <option value="bottom_left">Bottom left</option>
            <option value="center">Center</option>
            <option value="top_left">Top left</option>
            <option value="top_center">Top center</option>
            <option value="top_right">Top right</option>
          </select>
          {activeConfig?.watermarkType === "custom_text" && (
            <input aria-label="Watermark text" value={activeConfig?.watermarkText || ""} onChange={(e) => setConfigVal("watermarkText", e.target.value)} placeholder="Text" className={`pe-watermark-span ${inputClass}`} />
          )}
          <label className={isDialog ? labelClass : isCompact ? "grid gap-1 text-xs font-semibold text-slate-600 col-span-1" : "grid gap-2 text-sm font-semibold text-slate-600"}>
            Opacity
            <input type="range" min="0.05" max="0.6" step="0.01" value={activeConfig?.watermarkOpacity || 0.18} onChange={(e) => setConfigVal("watermarkOpacity", Number(e.target.value))} className={isDialog ? "w-full" : ""} />
          </label>
          <label className={isDialog ? labelClass : isCompact ? "grid gap-1 text-xs font-semibold text-slate-600 col-span-1" : "grid gap-2 text-sm font-semibold text-slate-600"}>
            Rotation
            <input type="range" min="-90" max="90" step="5" value={activeConfig?.watermarkRotation || 0} onChange={(e) => setConfigVal("watermarkRotation", Number(e.target.value))} className={isDialog ? "w-full" : ""} />
          </label>
          <input aria-label="Watermark font size" type="number" min="8" max="72" value={activeConfig?.watermarkFontSize ?? 18} onChange={(e) => setConfigVal("watermarkFontSize", e.target.value === "" ? "" : Number(e.target.value))} placeholder={isCompact ? "Size" : "Font size"} className={`pe-watermark-span ${inputClass}`} />
        </div>
      )}
    </div>
  );
}
