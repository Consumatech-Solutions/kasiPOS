'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useSettings } from '@/components/settings-provider';

export default function VouchersPage() {
  const { settings } = useSettings();
  const { currentStore } = settings;

  const vouchers = useLiveQuery(() => {
    if (!currentStore) return [];
    return db.vouchers.where('storeId').equals(currentStore.id!).toArray();
  }, [currentStore?.id]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Voucher Management</CardTitle>
        <CardDescription>Create and manage your discount vouchers.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Min. Purchase</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vouchers && vouchers.length > 0 ? (
              vouchers.map(voucher => (
                <TableRow key={voucher.id}>
                  <TableCell className="font-mono">{voucher.code}</TableCell>
                  <TableCell className="capitalize">{voucher.type}</TableCell>
                  <TableCell>{voucher.type === 'percentage' ? `${voucher.value}%` : `R${voucher.value.toFixed(2)}`}</TableCell>
                  <TableCell>R{voucher.minPurchase.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={voucher.isActive ? 'default' : 'secondary'}>
                      {voucher.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">
                  No vouchers found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
