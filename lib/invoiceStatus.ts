export const PI_STATUSES = [
  'Approved',
  'Advance Payment Done',
  'Order Verified',
  'Full Payment Done',
  'Full Payment Verified',
  'Production',
  'Dispatched',
] as const;

export type PIStatus = (typeof PI_STATUSES)[number];
