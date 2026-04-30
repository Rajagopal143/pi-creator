import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, OnChanges, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ProfileService } from 'src/app/services/profile/profile.service';
import { ManufacturingUnitService } from 'src/app/services/manufacturing-unit/manufacturing-unit.service';
import { getPurchaseOrderItemUnitRate } from 'src/app/utils/purchase-order-item-rate';
import { RoundedInrPipe } from 'src/app/pipes/rounded-inr.pipe';

@Component({
    selector: 'app-order-invoice',
    standalone: true,
    imports: [RoundedInrPipe, MatSnackBarModule, CommonModule, RouterModule],
    templateUrl: './order-invoice.component.html',
    styleUrls: ['./order-invoice.component.scss'],
})
export class OrderInvoiceComponent implements OnInit, OnChanges {
    /** Printable document root — matches on-screen invoice layout. */
    @ViewChild('orderInvoicePrintRoot', { read: ElementRef })
    orderInvoicePrintRoot?: ElementRef<HTMLElement>;

    @Input() orderDetails: any;
    @Input() quotationData: any;
    oemAddress!: string;
    oemManufacturingLabel = '';
    manufacturingUnit: {
        unitName?: string;
        address?: string;
        city?: string;
        state?: string;
        pincode?: string | number;
        accountNumber?: string;
    } | null = null;
    OEMProfileDetails: any;
    customerId!: string;
    invoiceItems: any[] = [];
    subTotal = 0;
    total = 0;
    gst = 0;
    insurance = 0;
    constructor(
        private route: ActivatedRoute,
        private profileServ: ProfileService,
        private snackbar: MatSnackBar,
        private manufacturingUnitService: ManufacturingUnitService,
    ) {
        this.customerId = this.route.snapshot.parent?.params['id'];
    }

    ngOnInit(): void {
        this.getOemProfile();
        this.formatProductDetails();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if ((changes['orderDetails'] || changes['quotationData']) && this.orderDetails?.purchase_order_items?.length) {
            this.formatProductDetails();
        }
    }

    /** Dealer object from API (supports `dealer` or `Dealer`). */
    get dealerEntity(): Record<string, unknown> | undefined {
        const o = this.orderDetails;
        if (!o) return undefined;
        return (o.dealer ?? o.Dealer) as Record<string, unknown> | undefined;
    }

    /** Logo URL for invoice header (same logic as print preview). */
    get logoUrl(): string {
        const raw = (this.OEMProfileDetails?.oem?.logo as string) || '';
        if (!raw) return '';
        return raw.startsWith('http') ? raw : `https://d35fg7wko3aaqg.cloudfront.net/${raw}`;
    }

    /** Place of supply: shipping state, else dealer billing state. */
    get placeOfSupply(): string {
        const o = this.orderDetails;
        if (!o) return '';
        const ship = o.shippingAddress as { state?: string } | undefined;
        const bill = this.dealerEntity?.['billingAddress'] as { state?: string } | undefined;
        return String(ship?.state || bill?.state || '');
    }

    get dealerNameLine(): string {
        const d = this.dealerEntity;
        if (!d) return '';
        return String(d['orgDisplayName'] || d['orgName'] || '');
    }

    get dealerBillingLine(): string {
        const d = this.dealerEntity;
        if (!d) return '';
        return this.formatAddressToDisplay(d['billingAddress']);
    }

    get dealerContact(): string {
        return String(this.dealerEntity?.['contact'] ?? '');
    }

    get dealerEmail(): string {
        return String(this.dealerEntity?.['orgEmail'] ?? '');
    }

    get dealerGst(): string {
        return String(this.dealerEntity?.['gstNo'] ?? '');
    }

    get dealerTypeForPricing(): string | undefined {
        const d = this.dealerEntity;
        if (!d) return undefined;
        const t = d['dealerType'];
        return typeof t === 'string' ? t : t !== undefined && t !== null ? String(t) : undefined;
    }

    isWarrantyPo(): boolean {
        return this.orderDetails?.POType === 'warranty_products';
    }

    async formatProductDetails() {
        if (!this.orderDetails || !this.orderDetails.purchase_order_items) {
            return;
        }

        const quotationItems = Array.isArray(this.quotationData?.itemDetails) ? this.quotationData.itemDetails : [];
        if (quotationItems.length > 0) {
            this.invoiceItems = quotationItems.map((item: any) => ({
                name: item.itemName || 'Product',
                HSN: '',
                rate: Number(item.rate ?? 0),
                quantity: Number(item.quantity ?? 0),
                amount: Number(item.taxableBase ?? Number(item.rate ?? 0) * Number(item.quantity ?? 0)),
                sgstPercent: Number(item.sgstPercentage ?? 0),
                cgstPercent: Number(item.cgstPercentage ?? 0),
                sgstAmount: Number(item.sgstAmount ?? 0),
                cgstAmount: Number(item.cgstAmount ?? 0),
                totalGstAmount: Number(item.sgstAmount ?? 0) + Number(item.cgstAmount ?? 0),
                totalAmount: Number(item.lineTotal ?? item.amount ?? 0),
                metadata: [
                    { key: 'Variant', value: String(item.variantName || '—') },
                    { key: 'Colour', value: String(item.colour || '—') },
                ],
            }));

            this.subTotal = Number(this.quotationData?.subtotal ?? this.quotationData?.subTotal ?? 0);
            this.gst = Number(this.quotationData?.totalGST ?? 0);
            this.insurance = Number(this.quotationData?.insuranceAmount ?? this.orderDetails?.insuranceAmount ?? 0);
            this.total = Number(this.quotationData?.total ?? this.subTotal + this.gst + this.insurance);
            return;
        }

        const productDetails = this.orderDetails.purchase_order_items.map((item: any) => {
            const product = item.product;
            const variant = item.product_variant;
            const rate = getPurchaseOrderItemUnitRate(item, this.dealerTypeForPricing);
            const quantity = item.approvedQuantity || item.quantity || 0;
            const amount = Number(rate * quantity);

            const gstPercentages = {
                sgst: parseFloat(product.sgst) || 0,
                cgst: parseFloat(product.cgst) || 0,
            };

            const gstAmounts = {
                sgst: (gstPercentages.sgst / 100) * amount,
                cgst: (gstPercentages.cgst / 100) * amount,
            };

            const totalGstAmount = Number(gstAmounts.sgst + gstAmounts.cgst);
            const totalAmount = Number(amount + totalGstAmount);

            const metadata = [];
            if (product.productType === 'vehicle') {
                metadata.push(
                    { key: 'Colour', value: item.approvedColor || item.colour || 'Mixed' },
                    { key: 'Variant', value: variant?.name || 'N/A' },
                );
            }

            return {
                name: product.productName,
                HSN: product.HSN,
                rate,
                quantity,
                amount,
                sgstPercent: gstPercentages.sgst,
                cgstPercent: gstPercentages.cgst,
                sgstAmount: Number(gstAmounts.sgst),
                cgstAmount: Number(gstAmounts.cgst),
                totalGstAmount,
                totalAmount,
                metadata,
            };
        });

        this.invoiceItems = productDetails;

        this.subTotal = Number(
            Number(this.orderDetails?.subTotal ?? this.invoiceItems.reduce((sum, item) => sum + item.amount, 0)),
        );
        this.gst = Number(
            Number(
                this.orderDetails?.totalGST ?? this.invoiceItems.reduce((sum, item) => sum + item.totalGstAmount, 0),
            ),
        );
        this.insurance = Number(Number(this.orderDetails?.insuranceAmount ?? 0));
        this.total = Number(Number(this.orderDetails?.grandTotal ?? this.subTotal + this.gst + this.insurance));
    }

    /** Sum of recorded PO payments (aligned with dealer portal). */
    get totalPaidOnOrder(): number {
        const pays = this.orderDetails?.payments;
        if (!Array.isArray(pays)) return 0;
        return Number(
            pays.reduce(
                (sum, p) =>
                    sum + (Number(p?.amount) || 0) + Number((p as { poCreditApplied?: number }).poCreditApplied ?? 0),
                0,
            ),
        );
    }

    get balanceDueOnOrder(): number {
        return Number(Math.max(0, this.total - this.totalPaidOnOrder));
    }

    getInvoiceTotalQuantity(): number {
        return this.invoiceItems.reduce((sum, i) => sum + Number(i.quantity ?? 0), 0);
    }

    getInvoiceTotalSgstAmount(): number {
        return Number(this.invoiceItems.reduce((sum, i) => sum + Number(i.sgstAmount ?? 0), 0));
    }

    getInvoiceTotalCgstAmount(): number {
        return Number(this.invoiceItems.reduce((sum, i) => sum + Number(i.cgstAmount ?? 0), 0));
    }

    getInvoiceTotalLineAmountSum(): number {
        return Number(this.invoiceItems.reduce((sum, i) => sum + Number(i.totalAmount ?? 0), 0));
    }

    /**
     * Prints the same invoice as on screen (`.page` document), including component styles.
     */
    print(): void {
        const oem = this.OEMProfileDetails?.oem;
        const o = this.orderDetails;
        if (!oem || !o) {
            this.snackbar.open('Invoice data is not ready to print.', 'Close', { duration: 3000 });
            return;
        }

        const root = this.orderInvoicePrintRoot?.nativeElement;
        if (!root) {
            this.snackbar.open('Invoice layout is not ready to print.', 'Close', { duration: 3000 });
            return;
        }

        const printWindow = window.open('', '_blank', 'width=1100,height=800');
        if (!printWindow) {
            this.snackbar.open('Allow pop-ups to print the invoice.', 'Close', { duration: 4000 });
            return;
        }

        const doc = printWindow.document;
        doc.open();
        doc.write('<!DOCTYPE html><html><head><meta charset="utf-8">');
        doc.write(`<title>Invoice — ${String(o.orderId ?? '').replace(/</g, '')}</title>`);
        doc.write(`<base href="${document.baseURI}">`);

        document.querySelectorAll('link[rel="stylesheet"]').forEach((node) => {
            doc.write(node.outerHTML);
        });
        document.querySelectorAll('style').forEach((node) => {
            doc.write(node.outerHTML);
        });

        doc.write(
            `<style>
              @media print { body { margin: 0; padding: 12px; background: #fff; } }
              body { margin: 0; padding: 16px; background: #f3f4f6; }
            </style>`,
        );
        doc.write('</head><body>');
        doc.write(root.outerHTML);
        doc.write('</body></html>');
        doc.close();

        const schedulePrint = (): void => {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        };

        if (printWindow.document.readyState === 'complete') {
            window.setTimeout(schedulePrint, 300);
        } else {
            printWindow.addEventListener('load', () => window.setTimeout(schedulePrint, 300));
        }
    }

    formatAddressToDisplay(address: any) {
        if (!address) return '';
        return `${address.address}, ${address.city}, ${address.state}, ${address.country}, ${address.pincode}`;
    }

    getOemAddress(): string {
        const mu = this.manufacturingUnit;
        if (mu?.address) {
            return `${mu.address}, ${mu.city}, ${mu.state} - ${mu.pincode}`;
        }
        const oem = this.OEMProfileDetails?.oem;
        if (!oem) return '';
        return `${oem.address}, ${oem.city}, ${oem.state}, ${oem.country}, Pincode: ${oem.pincode}`;
    }

    async getOemProfile() {
        try {
            const res = await this.profileServ.getOEMProfile();
            this.OEMProfileDetails = res;
            const muResponse = await this.manufacturingUnitService.getManufacturingUnit({ limit: 1 });
            if (muResponse?.result?.length) {
                this.manufacturingUnit = muResponse.result[0];
                this.oemManufacturingLabel = 'Manufacturing address';
            } else {
                this.manufacturingUnit = null;
                this.oemManufacturingLabel = 'Registered address';
            }
            this.oemAddress = this.getOemAddress();
        } catch (error: any) {
            this.snackbar.open(error?.error?.message ?? 'Failed to fetch the OEM profile data', 'close', {
                duration: 3000,
            });
        }
    }

    navigateBack() {
        history.back();
    }

    /** Reads metadata entry by key for invoice line items (variant, colour, etc.). */
    invoiceItemMetaValue(item: { metadata?: ReadonlyArray<{ key?: string; value?: string }> }, key: string): string {
        const found = item.metadata?.find((m) => m?.key === key);
        return found?.value ?? '—';
    }
}
