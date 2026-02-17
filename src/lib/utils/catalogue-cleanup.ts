import { db } from '../db';

// Mock categories to remove
const MOCK_CATEGORIES = [
  'Drinks',
  'Snacks',
  'Bakery',
  'Dairy',
  'Confectionery',
  'Groceries',
  'Beverages',
  'Toiletries',
  'Airtime',
  'Cigs',
  'Veg',
  'Cool Drinks',
];

// Mock products to remove
const MOCK_PRODUCTS = [
  'Coca-Cola 330ml',
  'Lays Chips Classic',
  'Albany White Bread',
  'Clover Milk 1L',
  'Cadbury Dairy Milk',
  'Sunfoil Cooking Oil 2L',
  'Selati White Sugar 2.5kg',
  'Five Roses Teabags 102s',
  'Nescafe Classic Coffee 200g',
  'Sunlight Bar Soap',
];

/**
 * Remove mock categories from local database
 */
export async function removeMockCategories(): Promise<number> {
  try {
    const allCategories = await db.categories.toArray();
    const mockCategoryIds: number[] = [];

    // Find IDs of mock categories
    for (const category of allCategories) {
      if (category.id && MOCK_CATEGORIES.includes(category.name)) {
        mockCategoryIds.push(category.id);
      }
    }

    // Delete mock categories
    if (mockCategoryIds.length > 0) {
      await db.categories.bulkDelete(mockCategoryIds);
      console.log(`Removed ${mockCategoryIds.length} mock categories`);
    }

    return mockCategoryIds.length;
  } catch (error) {
    console.error('Error removing mock categories:', error);
    throw error;
  }
}

/**
 * Remove mock products from local database
 */
export async function removeMockProducts(): Promise<number> {
  try {
    const allProducts = await db.products.toArray();
    const mockProductIds: number[] = [];

    // Find IDs of mock products
    for (const product of allProducts) {
      if (product.id && MOCK_PRODUCTS.includes(product.name)) {
        mockProductIds.push(product.id);
      }
    }

    // Delete mock products
    if (mockProductIds.length > 0) {
      await db.products.bulkDelete(mockProductIds);
      console.log(`Removed ${mockProductIds.length} mock products`);
    }

    return mockProductIds.length;
  } catch (error) {
    console.error('Error removing mock products:', error);
    throw error;
  }
}

/**
 * Remove all mock data (categories and products)
 */
export async function removeAllMockData(): Promise<{ categories: number; products: number }> {
  try {
    const categoriesRemoved = await removeMockCategories();
    const productsRemoved = await removeMockProducts();
    
    if (categoriesRemoved > 0 || productsRemoved > 0) {
      console.log(`Removed ${categoriesRemoved} mock categories and ${productsRemoved} mock products`);
    }
    
    return { categories: categoriesRemoved, products: productsRemoved };
  } catch (error) {
    console.error('Error removing all mock data:', error);
    throw error;
  }
}
