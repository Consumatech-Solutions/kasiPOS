'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function BophPage() {

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
                <div className="text-center py-16 text-muted-foreground">
                    <p>Incoming parcel functionality will be built here.</p>
                </div>
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
    </div>
  );
}
