'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Moon, Sun, Languages, Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/components/settings-provider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';


type Feature = 'campaigns' | 'marketplace' | 'boph';

export default function SettingsPage() {
  const { settings, setSetting } = useSettings();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);

  const handleToggle = (feature: Feature, checked: boolean) => {
    if (checked) {
      // If user is turning it ON, show confirmation modal
      setSelectedFeature(feature);
      setModalOpen(true);
    } else {
      // If user is turning it OFF, just update the setting
      setSetting(feature, false);
    }
  };
  
  const handleConfirm = () => {
    if (selectedFeature) {
      setSetting(selectedFeature, true);
    }
    setModalOpen(false);
    setSelectedFeature(null);
  };
  
  const handleCancel = () => {
    setModalOpen(false);
    setSelectedFeature(null);
  }

  const getFeatureDetails = (feature: Feature | null) => {
    switch(feature) {
      case 'campaigns':
        return {
          title: 'Opt-In to Campaigns',
          description: "Campaigns allow you to create and manage discount vouchers for your customers. By opting in, you'll be able to create percentage-based or fixed-amount discounts to drive sales."
        }
      case 'marketplace':
        return {
          title: 'Opt-In to Marketplace',
          description: "The Marketplace feature allows you to place orders from popular third-party online stores on behalf of your customers, earning a service fee for each order."
        }
      case 'boph':
        return {
          title: 'Opt-In to BOPH',
          description: "BOPH (Buy Online, Pickup Here) lets your store act as a pickup point for online orders. You'll manage incoming parcels and hand them off to customers, earning a fee for the service."
        }
      default:
        return { title: '', description: '' };
    }
  }

  const featureDetails = getFeatureDetails(selectedFeature);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Manage your application preferences and features.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label htmlFor="theme-toggle" className="font-semibold flex items-center gap-2">
                {settings.theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                Theme
              </Label>
              <p className="text-sm text-muted-foreground">Switch between light and dark mode.</p>
            </div>
            <Switch
              id="theme-toggle"
              checked={settings.theme === 'dark'}
              onCheckedChange={(checked) => setSetting('theme', checked ? 'dark' : 'light')}
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label htmlFor="language-select" className="font-semibold flex items-center gap-2">
                <Languages className="w-5 h-5" />
                Language
              </Label>
              <p className="text-sm text-muted-foreground">Choose your preferred language (coming soon).</p>
            </div>
             <Select defaultValue="en" disabled>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="zu">isiZulu</SelectItem>
                    <SelectItem value="xh">isiXhosa</SelectItem>
                </SelectContent>
            </Select>
          </div>

            <div className="space-y-2 pt-4">
                <h3 className="text-lg font-semibold">Feature Management</h3>
                <p className="text-sm text-muted-foreground">Enable or disable optional features.</p>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                <Label htmlFor="campaigns-toggle" className="font-semibold">Voucher Campaigns</Label>
                <p className="text-sm text-muted-foreground">Enable to create and manage discount vouchers.</p>
                </div>
                <Switch
                id="campaigns-toggle"
                checked={settings.campaigns}
                onCheckedChange={(checked) => handleToggle('campaigns', checked)}
                />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                <Label htmlFor="marketplace-toggle" className="font-semibold">Marketplace</Label>
                <p className="text-sm text-muted-foreground">Enable ordering from third-party stores.</p>
                </div>
                <Switch
                id="marketplace-toggle"
                checked={settings.marketplace}
                onCheckedChange={(checked) => handleToggle('marketplace', checked)}
                />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                <Label htmlFor="boph-toggle" className="font-semibold">Buy Online, Pickup Here (BOPH)</Label>
                <p className="text-sm text-muted-foreground">Enable parcel pickup point services.</p>
                </div>
                <Switch
                id="boph-toggle"
                checked={settings.boph}
                onCheckedChange={(checked) => handleToggle('boph', checked)}
                />
            </div>

        </CardContent>
      </Card>

      <AlertDialog open={modalOpen} onOpenChange={setModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              {featureDetails.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {featureDetails.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Opt-In</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}
