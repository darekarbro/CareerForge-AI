import React, { useId } from 'react';
export function Field({ label, hint, error, children, className = '' }) {
  const id = useId();
  return <div className={className}><label htmlFor={id} className="block text-sm font-semibold mb-1">{label}</label>{React.cloneElement(children, { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error || hint ? id + '-help' : undefined })}{(error || hint) && <p id={id + '-help'} className={'text-sm mt-1 ' + (error ? 'text-red-800' : 'text-gray-600')}>{error || hint}</p>}</div>;
}
export function Feedback({ error, message, loading }) {
  if (error) return <p role="alert" className="border-2 border-red-800 bg-red-50 text-red-900 p-3 text-sm">{error}</p>;
  if (loading || message) return <p role="status" className="p-3 text-sm">{loading || message}</p>;
  return null;
}
