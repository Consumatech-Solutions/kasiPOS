import { db } from './db';
import { PlaceHolderImages } from './placeholder-images';

export async function seedDatabase() {
    await db.transaction('rw', db.products, db.customers, db.vouchers, db.categories, db.parcels, async () => {

        // Check if database is already seeded by checking a single table
        const productCount = await db.products.count();
        if (productCount > 0) {
            console.log('Database already seeded.');
            return;
        }

        // Seed Categories
        const initialCategories = [
            { name: 'Drinks' },
            { name: 'Snacks' },
            { name: 'Bakery' },
            { name: 'Dairy' },
            { name: 'Confectionery' },
            { name: 'Groceries' },
            { name: 'Beverages' },
            { name: 'Toiletries' },
            { name: 'Airtime' },
            { name: 'Cigs' },
            { name: 'Veg' },
            { name: 'Cool Drinks' },
        ];
        await db.categories.bulkAdd(initialCategories);

        // Seed Products
        const products = [
            { name: 'Coca-Cola 330ml', price: 12.50, stock: 150, category: 'Drinks', barcode: '1234567890123', imageUrl: PlaceHolderImages[0].imageUrl, imageHint: PlaceHolderImages[0].imageHint, lowStockThreshold: 20 },
            { name: 'Lays Chips Classic', price: 18.00, stock: 80, category: 'Snacks', barcode: '2345678901234', imageUrl: PlaceHolderImages[1].imageUrl, imageHint: PlaceHolderImages[1].imageHint, lowStockThreshold: 15 },
            { name: 'Albany White Bread', price: 15.00, stock: 50, category: 'Bakery', barcode: '3456789012345', imageUrl: PlaceHolderImages[2].imageUrl, imageHint: PlaceHolderImages[2].imageHint, lowStockThreshold: 10 },
            { name: 'Clover Milk 1L', price: 22.00, stock: 40, category: 'Dairy', barcode: '4567890123456', imageUrl: PlaceHolderImages[3].imageUrl, imageHint: PlaceHolderImages[3].imageHint, lowStockThreshold: 10 },
            { name: 'Cadbury Dairy Milk', price: 25.00, stock: 100, category: 'Confectionery', barcode: '5678901234567', imageUrl: PlaceHolderImages[4].imageUrl, imageHint: PlaceHolderImages[4].imageHint, lowStockThreshold: 20 },
            { name: 'Sunfoil Cooking Oil 2L', price: 75.00, stock: 30, category: 'Groceries', barcode: '6789012345678', imageUrl: PlaceHolderImages[5].imageUrl, imageHint: PlaceHolderImages[5].imageHint, lowStockThreshold: 5 },
            { name: 'Selati White Sugar 2.5kg', price: 45.00, stock: 60, category: 'Groceries', barcode: '7890123456789', imageUrl: PlaceHolderImages[6].imageUrl, imageHint: PlaceHolderImages[6].imageHint, lowStockThreshold: 10 },
            { name: 'Five Roses Teabags 102s', price: 55.00, stock: 45, category: 'Beverages', barcode: '8901234567890', imageUrl: PlaceHolderImages[7].imageUrl, imageHint: PlaceHolderImages[7].imageHint, lowStockThreshold: 10 },
            { name: 'Nescafé Classic Coffee 200g', price: 95.00, stock: 25, category: 'Beverages', barcode: '9012345678901', imageUrl: PlaceHolderImages[8].imageUrl, imageHint: PlaceHolderImages[8].imageHint, lowStockThreshold: 5 },
            { name: 'Sunlight Bar Soap', price: 10.00, stock: 200, category: 'Toiletries', barcode: '0123456789012', imageUrl: PlaceHolderImages[9].imageUrl, imageHint: PlaceHolderImages[9].imageHint, lowStockThreshold: 25 },
        ];
        await db.products.bulkAdd(products);

        // Seed Customers
        const customers = [
            { name: 'John Doe', phone: '0821234567', loyaltyPoints: 150 },
            { name: 'Jane Smith', phone: '0731234567', loyaltyPoints: 45 },
            { name: 'Sipho Williams', phone: '0841234567', loyaltyPoints: 320 },
        ];
        await db.customers.bulkAdd(customers);

        // Seed Vouchers
        const vouchers = [
            { code: 'SAVE10', type: 'percentage', value: 10, minPurchase: 5, isActive: true },
            { code: 'WINTER25', type: 'fixed', value: 25, minPurchase: 5, isActive: true },
            { code: 'EXPIRED5', type: 'fixed', value: 5, minPurchase: 5, isActive: false },
        ];
        await db.vouchers.bulkAdd(vouchers);

        // Seed Parcels
        const parcels = [
            { deliveryNumber: 'PAZ-1001', customerName: 'Thabo Mbeki', status: 'Incoming' },
            { deliveryNumber: 'PAZ-1002', customerName: 'Cyril Ramaphosa', status: 'Incoming' },
            { deliveryNumber: 'TKT-8831', customerName: 'Fikile Mbalula', status: 'Incoming' },
            { deliveryNumber: 'AMZ-0331', customerName: 'Trevor Noah', status: 'Incoming' },
            { deliveryNumber: 'AMZ-5580', customerName: 'Nelson Mandela', status: 'Received', collectionCode: 'ZM451', receiptCode: 'RC-8912', dateReceived: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
            { deliveryNumber: 'MAK-4112', customerName: 'Elon Musk', status: 'Received', collectionCode: 'TS911', receiptCode: 'RC-0192', dateReceived: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
            { deliveryNumber: 'TKT-9210', customerName: 'Jacob Zuma', status: 'Collected', collectionCode: 'XF782', receiptCode: 'RC-9988', dateReceived: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), dateCollected: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), collectingPersonName: 'J. Zuma', collectingPersonId: '8001015800080' },
            { deliveryNumber: 'BAS-1995', customerName: 'Siya Kolisi', status: 'Collected', collectionCode: 'SP991', receiptCode: 'RC-0012', dateReceived: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), dateCollected: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), collectingPersonName: 'S. Kolisi', collectingPersonId: '9001015800080' },
        ];
        await db.parcels.bulkAdd(parcels);

    }).catch(err => {
        console.error("Failed to seed database:", err);
    });
}
