/** Future design boundary only. No issuer, persistence or provider exists. */
export interface PaymentAuthorizationToken {
  readonly mandateId: string;
  readonly purpose: "payment-authorization";
}
