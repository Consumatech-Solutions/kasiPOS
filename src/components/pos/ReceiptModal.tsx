'use client';

import React, { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { TransactionItem } from '@/types';
import { Printer, Download, Mail, MessageCircle, Settings, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DeviceSelector } from '@/components/device-selector';
import { getStoredDevice, printReceipt, getDevices } from '@/lib/device-service';
import { Printer as ThermalPrinter, Text, Br, Line, Row, Cut, render } from 'react-thermal-printer';
import { feedback } from '@/lib/feedback';

export interface ReceiptData {
  storeName: string;
  saleId: string;
  timestamp: Date;
  items: TransactionItem[];
  subtotal: number;
  discountAmount: number;
  showVat: boolean;
  vatAmount: number;
  total: number;
  paymentMethod: 'Cash' | 'Card' | 'Mobile Money';
  voucherCode?: string | null;
}

interface ReceiptModalProps {
  open: boolean;
  onClose: () => void;
  data: ReceiptData | null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatReceiptDate(d: Date): string {
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function ReceiptModal({ open, onClose, data }: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [showDeviceSelector, setShowDeviceSelector] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const buildPrintHtml = (d: ReceiptData): string => {
    const rows = d.items
      .map(
        (item) =>
          `<tr>
            <td>${escapeHtml(item.productName)}</td>
            <td style="text-align:center">${item.quantity}</td>
            <td style="text-align:right">R ${(item.unitPrice ?? 0).toFixed(2)}</td>
            <td style="text-align:right">R ${(item.totalPrice ?? 0).toFixed(2)}</td>
          </tr>`
      )
      .join('');
    const discountRow =
      d.discountAmount > 0
        ? `<div class="row"><span>Discount</span><span>-R ${d.discountAmount.toFixed(2)}</span></div>`
        : '';
    const vatRow = d.showVat
      ? `<div class="row"><span>VAT (15%)</span><span>R ${d.vatAmount.toFixed(2)}</span></div>`
      : '';
    const voucherRow = d.voucherCode
      ? `<div class="row meta"><span>Voucher</span><span>${escapeHtml(d.voucherCode)}</span></div>`
      : '';
    return `
      <h1>${escapeHtml(d.storeName)}</h1>
      <div class="meta">
        <p>Sale ID: ${escapeHtml(d.saleId)}</p>
        <p>${formatReceiptDate(d.timestamp)}</p>
      </div>
      <hr/>
      <table>
        <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals">
        <div class="row"><span>Subtotal</span><span>R ${d.subtotal.toFixed(2)}</span></div>
        ${discountRow}
        ${voucherRow}
        ${vatRow}
        <div class="row total"><span>Total</span><span>R ${d.total.toFixed(2)}</span></div>
        <div class="row meta"><span>Payment</span><span>${d.paymentMethod}</span></div>
      </div>
      <p class="footer">Thank you for your purchase</p>
    `;
  };

  const buildThermalReceipt = async (receiptData: ReceiptData): Promise<Uint8Array> => {
    const formattedDate = formatReceiptDate(receiptData.timestamp);
    
    return await render(
      <ThermalPrinter type="epson" width={42}>
        <Text align="center" bold={true} size={{ width: 2, height: 2 }}>
          {receiptData.storeName}
        </Text>
        <Br />
        <Line />
        <Text align="left">Sale ID: {receiptData.saleId}</Text>
        <Text align="left">Date: {formattedDate}</Text>
        <Line />
        <Text align="left">Item              Qty  Price    Total</Text>
        <Line />
        {receiptData.items.map((item, index) => {
          const itemName = item.productName.length > 18 
            ? item.productName.substring(0, 15) + '...' 
            : item.productName.padEnd(18);
          const qty = item.quantity.toString().padStart(3);
          const price = `R ${(item.unitPrice ?? 0).toFixed(2)}`.padStart(8);
          const total = `R ${(item.totalPrice ?? 0).toFixed(2)}`.padStart(8);
          return (
            <React.Fragment key={index}>
              <Text align="left">{itemName} {qty} {price} {total}</Text>
            </React.Fragment>
          );
        })}
        <Line />
        <Row left="Subtotal" right={`R ${receiptData.subtotal.toFixed(2)}`} />
        {receiptData.discountAmount > 0 && (
          <Row left="Discount" right={`-R ${receiptData.discountAmount.toFixed(2)}`} />
        )}
        {receiptData.voucherCode && (
          <Text align="left">Voucher: {receiptData.voucherCode}</Text>
        )}
        {receiptData.showVat && (
          <Text align="left">VAT (15%) included: {`R ${receiptData.vatAmount.toFixed(2)}`}</Text>
        )}
        <Line />
        <Text bold={true}>
          Total: {`R ${receiptData.total.toFixed(2)}`}
        </Text>
        <Text align="left">Payment: {receiptData.paymentMethod}</Text>
        <Line />
        <Text align="center">Thank you for your purchase</Text>
        <Br />
        <Cut />
      </ThermalPrinter>
    );
  };

  const handleThermalPrint = async () => {
    if (!data) return;

    setIsPrinting(true);
    try {
      // Check for stored printer device
      let deviceId = getStoredDevice('printer');

      // If no device stored, show device selector
      if (!deviceId) {
        // Check if devices are available
        try {
          const devices = await getDevices('printer');
          if (devices.length === 0) {
            toast({
              variant: 'destructive',
              title: 'No printer found',
              description: 'Please connect a printer device and try again.',
            });
            setIsPrinting(false);
            return;
          }
          // Show device selector
          setShowDeviceSelector(true);
          setIsPrinting(false);
          return;
        } catch (error: any) {
          toast({
            variant: 'destructive',
            title: 'Printer server error',
            description: error.message || 'Cannot connect to printer server.',
          });
          setIsPrinting(false);
          return;
        }
      }

      // Build thermal receipt
      const receiptData = await buildThermalReceipt(data);

      // Print to device
      await printReceipt(deviceId, receiptData);

      toast({
        title: 'Print successful',
        description: 'Receipt sent to printer.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Print failed',
        description: error.message || 'Failed to print receipt.',
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDeviceSelect = async (deviceId: string) => {
    // Device is already stored by DeviceSelector component
    // Now print with the selected device
    if (data) {
      setIsPrinting(true);
      try {
        const receiptData = await buildThermalReceipt(data);
        await printReceipt(deviceId, receiptData);
        toast({
          title: 'Print successful',
          description: 'Receipt sent to printer.',
        });
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Print failed',
          description: error.message || 'Failed to print receipt.',
        });
      } finally {
        setIsPrinting(false);
      }
    }
  };

  const handlePrint = () => {
    if (!data) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      feedback.error('Print blocked', 'Your browser blocked the print window.', 'Allow pop-ups for this site and try again.');
      return;
    }
    const doc = printWindow.document;
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${escapeHtml(data.saleId)}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 24px; max-width: 400px; margin: 0 auto; }
            h1 { font-size: 1.25rem; margin: 0 0 8px 0; }
            .meta { color: #666; font-size: 0.875rem; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; margin: 16px 0; }
            th { text-align: left; border-bottom: 1px solid #eee; padding: 6px 0; font-size: 0.75rem; color: #666; }
            td { padding: 6px 0; border-bottom: 1px solid #f5f5f5; }
            hr { border: none; border-top: 1px solid #eee; margin: 12px 0; }
            .totals { margin-top: 16px; }
            .row { display: flex; justify-content: space-between; padding: 4px 0; }
            .total { font-weight: bold; font-size: 1.125rem; margin-top: 8px; padding-top: 8px; border-top: 1px solid #333; }
            .footer { margin-top: 24px; font-size: 0.75rem; color: #666; text-align: center; }
          </style>
        </head>
        <body>${buildPrintHtml(data)}</body>
      </html>
    `);
    doc.close();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
    };
  };

  const handleDownloadPdf = () => {
    feedback.success('Save as PDF', 'Use the print dialog and choose "Save as PDF" as the destination.');
    handlePrint();
  };

  const handleEmailReceipt = () => {
    feedback.success('Coming soon', 'Email receipt delivery will be available in a future update.');
  };

  const handleSmsReceipt = () => {
    feedback.success('Coming soon', 'SMS receipt delivery will be available in a future update.');
  };

  const VAT_RATE = 15;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Receipt</DialogTitle>
          <DialogDescription className="sr-only">Sale receipt with items and totals</DialogDescription>
        </DialogHeader>

        {!data ? (
          <div className="py-8 text-center text-muted-foreground">Loading receipt…</div>
        ) : (
        <div
          id="receipt-content"
          ref={receiptRef}
          className="bg-muted/30 rounded-lg p-4 text-sm overflow-x-auto overflow-y-auto min-w-0"
        >
          <h1 className="font-bold text-lg break-words">{data.storeName}</h1>
          <div className="text-muted-foreground text-xs space-y-1 mt-1 break-all">
            <p>Sale ID: {data.saleId}</p>
            <p>{formatReceiptDate(data.timestamp)}</p>
          </div>
          <Separator className="my-3" />
          <div className="min-w-[280px]">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left py-1 font-medium w-[40%]">Item</th>
                  <th className="text-center py-1 font-medium w-[12%]">Qty</th>
                  <th className="text-right py-1 font-medium w-[24%]">Price</th>
                  <th className="text-right py-1 font-medium w-[24%]">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.productId} className="border-b border-border/50">
                    <td className="py-2 truncate pr-2" title={item.productName}>{item.productName}</td>
                    <td className="py-2 text-center">{item.quantity}</td>
                    <td className="py-2 text-right whitespace-nowrap">R {(item.unitPrice ?? 0).toFixed(2)}</td>
                    <td className="py-2 text-right font-medium whitespace-nowrap">R {(item.totalPrice ?? 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground shrink-0">Subtotal</span>
              <span className="whitespace-nowrap">R {data.subtotal.toFixed(2)}</span>
            </div>
            {data.discountAmount > 0 && (
              <div className="flex justify-between gap-4 text-green-600">
                <span className="shrink-0">Discount</span>
                <span className="whitespace-nowrap">-R {data.discountAmount.toFixed(2)}</span>
              </div>
            )}
            {data.voucherCode && (
              <div className="flex justify-between gap-4 text-muted-foreground text-xs">
                <span className="shrink-0">Voucher</span>
                <span className="truncate">{data.voucherCode}</span>
              </div>
            )}
            {data.showVat && (
              <div className="flex justify-between gap-4 text-muted-foreground">
                <span className="shrink-0">VAT (15%)</span>
                <span className="whitespace-nowrap">R {data.vatAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between gap-4 font-bold text-base pt-2 border-t mt-2">
              <span className="shrink-0">Total</span>
              <span className="whitespace-nowrap">R {data.total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-4 text-muted-foreground text-xs pt-1">
              <span className="shrink-0">Payment</span>
              <span className="whitespace-nowrap">{data.paymentMethod}</span>
            </div>
          </div>
          <p className="text-center text-muted-foreground text-xs mt-4">
            Thank you for your purchase
          </p>
        </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {data ? (
            <>
              <Button
                type="button"
                variant="default"
                className="w-full sm:w-auto"
                onClick={handleThermalPrint}
                disabled={isPrinting}
              >
                {isPrinting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Printing...
                  </>
                ) : (
                  <>
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                  </>
                )}
              </Button>
              {/* <Button
                type="button"
                variant="outline"
                size="icon"
                title="Select printer device"
                onClick={() => setShowDeviceSelector(true)}
                disabled={isPrinting}
              >
                <Settings className="h-4 w-4" />
              </Button> */}
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={handleDownloadPdf}
              >
                <Download className="mr-2 h-4 w-4" />
                Save as PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Email receipt"
                onClick={handleEmailReceipt}
                className="w-full sm:w-auto"
              >
                Send by email <Mail className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="SMS receipt"
                onClick={handleSmsReceipt}
                className="w-full sm:w-auto"
              >
                Send by SMS <MessageCircle className="h-4 w-4" />
              </Button>
            </>
          ) : null}
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
      <DeviceSelector
        type="printer"
        open={showDeviceSelector}
        onClose={() => setShowDeviceSelector(false)}
        onSelect={handleDeviceSelect}
      />
    </Dialog>
  );
}
