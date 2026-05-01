export interface DealerListRow {
  id: string;
  dealerNumericId: number;
  dealerId: string;
  orgName: string;
  userType: string;
  orgEmail: string;
  contact: string;
  source: string;
}

export interface ParentOption {
  id: string;
  orgName: string;
}

export type CreateDealerState = {
  ok: boolean;
  message: string;
  fieldErrors: Record<string, string>;
};

export const initialCreateState: CreateDealerState = {
  ok: false,
  message: '',
  fieldErrors: {},
};
