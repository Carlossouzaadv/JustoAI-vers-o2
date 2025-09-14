'use client';

import { useDashboard } from '../../layout';

export default function ProcessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  return (
    <div className="space-y-6">
      {children}
    </div>
  );
}