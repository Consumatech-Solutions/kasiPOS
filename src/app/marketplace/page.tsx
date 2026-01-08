
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

const marketplaces = [
  {
    id: 'boxer',
    name: 'Boxer',
    logoUrl: 'https://placehold.co/200x100/F3722C/FFFFFF?text=Boxer',
    description: 'Your favourite local supermarket with everyday low prices.'
  },
  {
    id: 'picknpay',
    name: 'Pick n Pay',
    logoUrl: 'https://placehold.co/200x100/00479C/FFFFFF?text=Pick+n+Pay',
    description: 'Fresh groceries, quality products, and great value.'
  },
  {
    id: 'checkers',
    name: 'Checkers',
    logoUrl: 'https://placehold.co/200x100/D9231D/FFFFFF?text=Checkers',
    description: 'Better and better deals on a wide range of products.'
  },
  {
    id: 'usave',
    name: 'Shoprite U-Save',
    logoUrl: 'https://placehold.co/200x100/FFC82E/000000?text=U-Save',
    description: 'Saving you money on your daily essentials.'
  },
];


export default function MarketplacePage() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Marketplace</CardTitle>
          <CardDescription>Place orders from third-party stores for your customers.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="max-w-md space-y-2">
                <label htmlFor="order-code" className="text-sm font-medium">Have an Order Code?</label>
                <div className="flex gap-2">
                    <Input id="order-code" placeholder="Enter order code..." />
                    <Button>
                        <Search className="mr-2 h-4 w-4"/>
                        Find Order
                    </Button>
                </div>
            </div>
        </CardContent>
      </Card>
      
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-4">Available Stores</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {marketplaces.map((store) => (
            <Link href={`/marketplace/${store.id}`} key={store.id}>
                <Card className="hover:shadow-lg transition-shadow duration-300 h-full flex flex-col">
                <CardHeader className="flex-row items-center gap-4">
                    <Image src={store.logoUrl} alt={`${store.name} logo`} width={80} height={40} className="rounded-md object-contain" />
                    <div>
                        <CardTitle>{store.name}</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground">{store.description}</p>
                </CardContent>
                </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
