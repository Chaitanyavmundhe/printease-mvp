export default function Card({ children, className = "" }) {
  return <div className={`pe-panel rounded-lg border bg-white p-4 sm:p-6 text-base min-w-0 ${className}`}>{children}</div>;
}
