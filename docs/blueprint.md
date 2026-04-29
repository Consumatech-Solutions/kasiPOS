# **App Name**: KasiPOS

## Core Features:

- Offline POS Transactions: Process sales transactions even without an internet connection, storing data locally using IndexedDB and Dexie.js, and ensure transactional integrity until data syncs
- Inventory Management: Track stock levels, manage product details (including barcode, price, and category), and receive low stock alerts to maintain optimal inventory levels. Uses IndexedDB
- Customer Loyalty Program: Manage customer profiles, track loyalty points, and apply rewards to transactions to encourage repeat business and increase customer satisfaction.
- Transaction History: Access a detailed history of all sales transactions, including items sold, payment methods, and any applied discounts or vouchers, and also facilitate and track refunds.
- Reporting and Analytics: Generate reports on key business metrics such as sales trends, top-selling products, and payment breakdowns to make informed decisions.
- PWA Installation: Enable users to install the application on their devices for quick access, a native-like experience, and push notification support for important alerts.
- Voucher Management: Create and manage discount vouchers with various parameters (e.g., percentage, fixed amount, minimum purchase) to drive sales and customer engagement.

## Style Guidelines:

- Primary color: Blue (#2563EB) for actions, buttons, and links, reflecting trustworthiness and stability.
- Background color: Very light blue (#F9FAFB), almost white, for a clean and modern look that is easy on the eyes.
- Accent color: Light purple (#8B5CF6), to complement the primary blue and give some additional visual interest, mainly used to signal user profile sections.
- Body and headline font: 'Inter' (sans-serif) for a clean, modern, and highly readable interface, suitable for both headlines and body text.
- Lucide React icons for a consistent and lightweight icon set.
- Responsive layout optimized for mobile-first design, ensuring a seamless experience across various devices (phones, tablets, desktops).
- Subtle transition animations for button presses and data loading, providing visual feedback without overwhelming the user.
