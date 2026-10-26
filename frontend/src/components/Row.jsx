export default function Row({ label, value }) {
  return (
    <div className="pe-summary-row">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold capitalize min-w-0 break-words">{value}</span>
    </div>
  );
}
