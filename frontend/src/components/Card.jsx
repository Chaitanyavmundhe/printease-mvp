export default function Card({ children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm min-w-0 transition-all ${className}`}>
      {children}
    </div>
  );
}

