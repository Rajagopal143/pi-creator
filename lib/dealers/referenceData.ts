/** Static reference lists for dealer forms (no CSV in repo). */

export interface StateOption {
  state_code: string;
  name: string;
}

/** Common Indian states / UTs — extend as needed. */
export const OPERATING_STATES: StateOption[] = [
  { state_code: 'AN', name: 'Andaman and Nicobar Islands' },
  { state_code: 'AP', name: 'Andhra Pradesh' },
  { state_code: 'AR', name: 'Arunachal Pradesh' },
  { state_code: 'AS', name: 'Assam' },
  { state_code: 'BR', name: 'Bihar' },
  { state_code: 'CH', name: 'Chandigarh' },
  { state_code: 'CT', name: 'Chhattisgarh' },
  { state_code: 'DL', name: 'Delhi' },
  { state_code: 'GA', name: 'Goa' },
  { state_code: 'GJ', name: 'Gujarat' },
  { state_code: 'HR', name: 'Haryana' },
  { state_code: 'HP', name: 'Himachal Pradesh' },
  { state_code: 'JK', name: 'Jammu and Kashmir' },
  { state_code: 'JH', name: 'Jharkhand' },
  { state_code: 'KA', name: 'Karnataka' },
  { state_code: 'KL', name: 'Kerala' },
  { state_code: 'MP', name: 'Madhya Pradesh' },
  { state_code: 'MH', name: 'Maharashtra' },
  { state_code: 'MN', name: 'Manipur' },
  { state_code: 'ML', name: 'Meghalaya' },
  { state_code: 'MZ', name: 'Mizoram' },
  { state_code: 'NL', name: 'Nagaland' },
  { state_code: 'OR', name: 'Odisha' },
  { state_code: 'PY', name: 'Puducherry' },
  { state_code: 'PB', name: 'Punjab' },
  { state_code: 'RJ', name: 'Rajasthan' },
  { state_code: 'SK', name: 'Sikkim' },
  { state_code: 'TN', name: 'Tamil Nadu' },
  { state_code: 'TG', name: 'Telangana' },
  { state_code: 'TR', name: 'Tripura' },
  { state_code: 'UP', name: 'Uttar Pradesh' },
  { state_code: 'UT', name: 'Uttarakhand' },
  { state_code: 'WB', name: 'West Bengal' },
];

export interface RegionOption {
  id: string;
  name: string;
}

export interface ZoneOption {
  id: string;
  name: string;
  regionId: string;
}

export const REGIONS: RegionOption[] = [
  { id: 'r1', name: 'North' },
  { id: 'r2', name: 'South' },
  { id: 'r3', name: 'East' },
  { id: 'r4', name: 'West' },
  { id: 'r5', name: 'Central' },
];

export const ZONES: ZoneOption[] = [
  { id: 'z1', name: 'Zone A', regionId: 'r1' },
  { id: 'z2', name: 'Zone B', regionId: 'r1' },
  { id: 'z3', name: 'Zone C', regionId: 'r2' },
  { id: 'z4', name: 'Zone D', regionId: 'r2' },
  { id: 'z5', name: 'Zone E', regionId: 'r3' },
  { id: 'z6', name: 'Zone F', regionId: 'r4' },
  { id: 'z7', name: 'Zone G', regionId: 'r5' },
];

export function zonesForRegion(regionId: string): ZoneOption[] {
  if (!regionId) return ZONES;
  return ZONES.filter(z => z.regionId === regionId);
}

export type DealerUserType =
  | 'distributor'
  | 'divisionaldistributor'
  | 'districtdealer'
  | 'areadealer';

export const USER_TYPE_LABELS: Record<DealerUserType, string> = {
  distributor: 'Distributor',
  divisionaldistributor: 'Divisional Distributor',
  districtdealer: 'District Dealer',
  areadealer: 'Area Dealer',
};
