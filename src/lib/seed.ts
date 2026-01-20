import { db } from './db';
import { PlaceHolderImages } from './placeholder-images';

export async function seedDatabase() {
    await db.transaction('rw', db.stores, db.users, db.products, db.customers, db.vouchers, db.categories, db.parcels, db.purchaseOrders, async () => {
        
        // ----- PATCHES for existing data -----
        // This is a good place for non-destructive patches for existing users.
        const voucherToPatch = await db.vouchers.where('code').equalsIgnoreCase('SAVE10').first();
        if (voucherToPatch && voucherToPatch.minPurchase !== 5) {
            console.log('Patching stale voucher data for SAVE10.');
            await db.vouchers.update(voucherToPatch.id!, { minPurchase: 5 });
        }
        
        // ----- SEEDING for missing mock data -----

        // --- SCENARIO 1: The user who needs to go through setup ---
        const setupUserPhone = '0812345678';
        let setupUser = await db.users.where('phone').equals(setupUserPhone).first();
        if (!setupUser) {
            console.log(`Seeding user ${setupUserPhone} and their incomplete store.`);
            const incompleteStoreId = await db.stores.add({
                name: 'My Store', // This will be updated during setup
                isSetupComplete: false,
            });

            await db.users.add({
                name: 'Admin User',
                phone: setupUserPhone,
                password: 'password123',
                role: 'admin',
                storeId: incompleteStoreId,
            });
        }

        // --- SCENARIO 2: The user who bypasses setup with a pre-filled store ---
        const bypassUserPhone = '0810000000';
        let bypassUser = await db.users.where('phone').equals(bypassUserPhone).first();
        if (!bypassUser) {
            console.log(`Seeding user ${bypassUserPhone} and their complete, pre-filled store.`);
            const completedStoreId = await db.stores.add({
                name: 'Kasi General Store',
                isSetupComplete: true,
                receiptHeader: 'Thanks for shopping at Kasi General!',
                receiptFooter: 'Your friendly neighborhood store.',
                vatNumber: '1234567890'
            });

            await db.users.add({
                name: 'Bypass Admin',
                phone: bypassUserPhone,
                password: 'password123',
                role: 'admin',
                storeId: completedStoreId,
            });
            
            console.log(`Seeding sample data into store ID: ${completedStoreId}`);
            
            // Note: Categories and Products are now global (no storeId)
            // Categories and Products: No longer seeding mock data - they should come from the backend API
            // Customers, Vouchers, and Parcels: Also removed - they should be created by users or come from backend
        }
    }).catch(err => {
        console.error("Failed to seed database:", err);
    });
}
