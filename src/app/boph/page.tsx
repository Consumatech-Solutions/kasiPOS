'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { Parcel } from '@/types';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ClipboardCopy } from 'lucide-react';
import { format } from 'date-fns';

export default function BophPage() {
  const { toast } = useToast();
  const allParcels = useLiveQuery(() => db.parcels.toArray(), []);

  const [receiptCode, setReceiptCode] = useState('');
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);

  const incomingParcels = useMemo(() => allParcels?.filter(p => p.status === 'Incoming') || [], [allParcels]);
  const receivedParcels = useMemo(() => allParcels?.filter(p => p.status === 'Received') || [], [allParcels]);
  const collectedParcels = useMemo(() => allParcels?.filter(p- => p.status === 'Collected') || [], [allParcels]);

  // Function to generate a random alphanumeric code
  const generateCode = (length: number, prefix: string = '') => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return prefix + result;
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Code copied to clipboard." });
  };

  const handleOpenReceiveModal = (parcel: Parcel) => {
    setSelectedParcel(parcel);
    const newReceiptCode = generateCode(6, 'RC-');
    setReceiptCode(newReceiptCode);
    setIsReceiveModalOpen(true);
  };
  
  const handleConfirmReception = async () => {
    if (!selectedParcel) return;
    
    const newCollectionCode = generateCode(5, 'KP-');

    try {
      await db.parcels.update(selectedParcel.id!, {
        status: 'Received',
        receiptCode: receiptCode,
        collectionCode: newCollectionCode,
        dateReceived: new Date(),
      });
      toast({
        title: "Parcel Received",
        description: `${selectedParcel.deliveryNumber} has been marked as received.`,
      });
      setIsReceiveModalOpen(false);
      setSelectedParcel(null);
    } catch (error) {
      console.error("Failed to update parcel:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not update the parcel status.",
      });
    }
  };


  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>BOPH - Buy Online, Pickup Here</CardTitle>
          <CardDescription>Manage incoming and received parcels for customer pickup.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="incoming">
            <TabsList>
              <TabsTrigger value="incoming">Incoming Parcels</TabsTrigger>
              <TabsTrigger value="received">Ready for Collection</TabsTrigger>
              <TabsTrigger value="collected">Collection History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="incoming">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Delivery #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incomingParcels.map(parcel => (
                      <TableRow key={parcel.id}>
                        <TableCell className="font-mono">{parcel.deliveryNumber}</TableCell>
                        <TableCell>{parcel.customerName}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => handleOpenReceiveModal(parcel)}>Receive</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                 {incomingParcels.length === 0 && (
                    <div className="text-center py-16 text-muted-foreground">
                        <p>No parcels are currently expected.</p>
                    </div>
                 )}
            </TabsContent>

            <TabsContent value="received">
                 <div className="text-center py-16 text-muted-foreground">
                    <p>Parcel collection functionality will be built here.</p>
                </div>
            </TabsContent>
            <TabsContent value="collected">
                 <div className="text-center py-16 text-muted-foreground">
                    <p>Collection history will be displayed here.</p>
                </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Receive Parcel Modal */}
      <Dialog open={isReceiveModalOpen} onOpenChange={setIsReceiveModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Receive Parcel: {selectedParcel?.deliveryNumber}</DialogTitle>
                <DialogDescription>
                    Provide the following code to the courier to confirm the handover. Once confirmed, the parcel will be marked as received.
                </DialogDescription>
            </DialogHeader>
            <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground">Courier Receipt Code</p>
                <div className="flex items-center justify-center gap-2 mt-2">
                    <p className="text-4xl font-bold tracking-widest font-mono p-4 bg-muted rounded-lg">{receiptCode}</p>
                     <Button variant="outline" size="icon" onClick={() => copyToClipboard(receiptCode)}>
                        <ClipboardCopy className="w-5 h-5" />
                    </Button>
                </div>
            </div>
            <DialogFooter>
                <Button variant="secondary" onClick={() => setIsReceiveModalOpen(false)}>Cancel</Button>
                <Button onClick={handleConfirmReception}>Confirm & Receive</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
