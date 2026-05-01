@cypress  Make sure the cypress test are updated accordingly and passing based on the above requirements. 
Ensure that the tests are real, can capture edge case. 

Ensure that different aspects are tested :
- Add a category, then add a product basedd on that category with stock of 0, go to the main page, you should find the prduct but if you try to add it to the cart it should fail because of the stock,then go to inventory, this product should be found, add stock to this product with reason "new stock...", try to add the product to cart, it should work now, complete the sale and the quantity should reduce, dexie should be updated, go to the inventory the new quantity should reflect there.
- DO the same thing above but with a new customer 
- Do the same above, but before add a voucher, and apply the voucher on sale. 

Test every aspect, Add around 10 products, sale them around 10 times each, manipulate stock and make sure everytime it succeeds. 

FInally test syncing all these products and make sure if the syncing works 

This test will happen live on staging.

Record videos of these with cypress and save them. 

FInally test settings, change the toogles and verify their impact on the other components. 
Change tax config and verify the impact on the first page

