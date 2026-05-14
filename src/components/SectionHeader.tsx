import React from 'react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  children: React.ReactNode;
  className?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ children, className }) => (
  <div className={cn(
    "bg-primary/10 rounded-lg px-4 py-2.5 mb-4 border border-primary/15",
    className
  )}>
    <h2 className="font-display text-lg font-semibold text-primary">
      {children}
    </h2>
  </div>
);

export default SectionHeader;
