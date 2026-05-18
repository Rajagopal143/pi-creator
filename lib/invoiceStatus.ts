export const PI_STATUSES = [
  'Pending',
  'Dispatched',
  'Cancelled',
] as const;

export type PIStatus = (typeof PI_STATUSES)[number];
