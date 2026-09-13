import React from 'react';
import { Badge } from './Badge';
import { TransactionStatus, TransactionType } from '../../types';

export interface StatusBadgeProps {
  status?: TransactionStatus | string;
  type?: TransactionType | string;
  dueAmount?: number;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type, dueAmount }) => {
  if (typeof dueAmount === 'number' && !isNaN(dueAmount)) {
    if (dueAmount > 0) {
      return <Badge variant="danger">Due ₹{dueAmount.toFixed(0)}</Badge>;
    }
    if (dueAmount < 0) {
      return <Badge variant="success">Advance ₹{Math.abs(dueAmount).toFixed(0)}</Badge>;
    }
    return <Badge variant="neutral">Settled</Badge>;
  }

  if (status) {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success">Completed</Badge>;
      case 'PENDING':
        return <Badge variant="warning">Pending</Badge>;
      case 'CORRECTED':
        return <Badge variant="info">Corrected</Badge>;
      case 'REVERSED':
        return <Badge variant="danger">Reversed</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  }

  if (type) {
    const formatted = type.replace(/_/g, ' ');
    return <Badge variant="info">{formatted}</Badge>;
  }

  return null;
};
