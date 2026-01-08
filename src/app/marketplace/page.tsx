
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

const marketplaces = [
  {
    id: 'takealot',
    name: 'Takealot',
    logoUrl: 'https://placehold.co/200x100/00549F/FFFFFF?text=Takealot',
    description: "South Africa's leading online store for electronics, appliances, and more."
  },
  {
    id: 'amazon',
    name: 'Amazon',
    logoUrl: 'https://placehold.co/200x100/FF9900/000000?text=amazon',
    description: 'Global marketplace for millions of products from A to Z.'
  },
  {
    id: 'makro',
    name: 'Makro',
    logoUrl: 'https://placehold.co/200x100/D9002D/FFFFFF?text=Makro',
    description: 'Big on life. Get everything you need for your home and business.'
  },
  {
    id: 'temu',
    name: 'Temu',
    logoUrl: 'https://placehold.co/200x100/F26322/FFFFFF?text=Temu',
    description: 'Shop like a billionaire with deals on fashion, home, and tech.'
  },
  {
    id: 'checkers-hyper',
    name: 'Checkers Hyper',
    logoUrl: 'https://placehold.co/200x100/D9231D/FFFFFF?text=Checkers+Hyper',
    description: 'Better and better deals on a wide range of groceries and goods.'
  },
  {
    id: 'pnp-hyper',
    name: 'Pick n Pay Hyper',
    logoUrl: 'https://placehold.co/200x100/00479C/FFFFFF?text=PnP+Hyper',
    description: 'Your one-stop shop for groceries, clothing, and general merchandise.'
  },
  {
    id: 'bash',
    name: 'Bash',
    logoUrl: 'https://placehold.co/200x100/000000/FFFFFF?text=Bash',
    description: 'The home of fashion. Shop the latest trends from your favourite brands.'
  },
  {
    id: 'tfg',
    name: 'TFG',
    logoUrl: 'https://placehold.co/200x100/0033A0/FFFFFF?text=TFG',
    description: 'A diverse portfolio of fashion, jewellery, and homeware brands.'
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
