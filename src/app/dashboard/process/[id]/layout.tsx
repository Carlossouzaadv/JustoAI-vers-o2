'use client';

import { useDashboard } from '../../layout';

export default function ProcessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="space-y-6">
      {children}
    </div>
  );
}