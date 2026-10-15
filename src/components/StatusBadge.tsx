import type { OrderStatus } from '../types';
import { STATUS_LABELS, STATUS_COLORS } from '../types';

export default function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className="badge" style={{ ['--c' as any]: STATUS_COLORS[status] }}>
      {STATUS_LABELS[status]}
    </span>
  );
}
