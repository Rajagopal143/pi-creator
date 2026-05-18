/** Form state for the product edit action. Kept out of the `'use server'`
 *  file so it can export this non-function value. */
export type ProductFormState = {
  ok: boolean;
  message: string;
};

export const initialProductFormState: ProductFormState = { ok: false, message: '' };
