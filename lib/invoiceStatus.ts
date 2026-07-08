export const PI_STATUSES = [
  'Pending',
  'Dispatched',
  'Cancelled',
  'Deleted',
] as const;

export type PIStatus = (typeof PI_STATUSES)[number];
