import { CataloguePage } from '../pages/catalogue-page';

function clickRowAction(rowLabel: RegExp, actionLabel: 'Edit' | 'Delete') {
  const openMenu = () =>
    cy.contains('td', rowLabel, { timeout: 15_000 }).closest('tr').within(() => {
      cy.get('button[aria-label="Actions"]').scrollIntoView().first().click({ force: true });
    });

  const itemRegex = new RegExp(`^\\s*${actionLabel}\\s*$`, 'i');
  const itemExists = () =>
    Cypress.$('[data-radix-menu-content], [role="menu"]')
      .toArray()
      .some((menu) =>
        Array.from(menu.querySelectorAll('[role="menuitem"]')).some((item) =>
          itemRegex.test(item.textContent ?? ''),
        ),
      );

  openMenu();
  cy.waitUntil(() => itemExists(), {
    timeout: 10_000,
    interval: 150,
    errorMsg: `Visible actions menu item "${actionLabel}" did not appear`,
  });

  cy.get('body').then(($body) => {
    const hasItem = $body
      .find('[data-radix-menu-content], [role="menu"]')
      .toArray()
      .some((menu) =>
        Array.from(menu.querySelectorAll('[role="menuitem"]')).some((item) =>
          itemRegex.test(item.textContent ?? ''),
        ),
      );
    if (!hasItem) {
      openMenu();
    }
  });

  cy.get('[data-radix-menu-content], [role="menu"]', { timeout: 15_000 })
    .last()
    .contains('[role="menuitem"]', itemRegex)
    .click({ force: true });
}

function openCategoriesTab() {
  cy.findByRole('tab', { name: /^categories$/i }).filter(':visible').first().click({ force: true });
  cy.contains('th, td', /category name/i, { timeout: 15_000 }).should('be.visible');
}

describe('Catalogue', () => {
  beforeEach(() => {
    cy.setupScenario();
    cy.setOnlineModeOnly();
    CataloguePage.visit();
    cy.setOnline();
    CataloguePage.waitUntilLoaded();
  });

  it('loads catalogue route and tabs', () => {
    cy.location('pathname').should('eq', '/catalogue');
    cy.findByRole('tab', { name: /^products$/i }).should('be.visible');
    cy.findByRole('tab', { name: /^categories$/i }).should('be.visible');
  });

  it('creates a product and shows it in list', () => {
    CataloguePage.openAddProductDialog();
    cy.get('input[name="name"]', { timeout: 15_000 }).last().clear().type('E2E Apples');
    cy.get('[data-testid="catalogue-product-dialog"]').last().find('[role="combobox"]').first().click({ force: true });
    cy.findByRole('option', { name: /^beverages$/i, timeout: 15_000 }).click({ force: true });
    cy.get('input[name="price"]').last().clear().type('40');
    cy.get('input[name="costPrice"]').last().clear().type('25');
    CataloguePage.clickSaveInProductDialog();
    cy.wait('@createProduct');
    cy.contains('td', /e2e apples/i).should('be.visible');
  });

  it('edits product fields and persists changes', () => {
    clickRowAction(/cola 330ml/i, 'Edit');
    CataloguePage.getActiveDialog(CataloguePage.productDialogSelector).within(() => {
      cy.get('input[name="name"]').scrollIntoView().clear().type('Cola 330ml Updated');
      cy.get('input[name="price"]').scrollIntoView().clear().type('13');
    });
    CataloguePage.clickSaveInProductDialog();
    cy.wait('@updateProduct', { timeout: 15_000 })
      .then((interception) => {
        expect(interception.request.body.name).to.eq('Cola 330ml Updated');
        expect(Number(interception.request.body.price)).to.eq(13);
      });
    cy.contains('td', /cola 330ml updated/i, { timeout: 20_000 }).should('be.visible');
  });

  it('deletes product after confirmation', () => {
    clickRowAction(/salted chips/i, 'Delete');
    cy.findByRole('alertdialog').within(() => {
      cy.findByRole('button', { name: /^delete$/i }).click({ force: true });
    });
    cy.wait('@deleteProduct');
    cy.contains('td', /salted chips/i).should('not.exist');
  });

  it('shows product form image input for upload flow', () => {
    cy.findByRole('tab', { name: /^products$/i }).filter(':visible').first().click({ force: true });
    cy.wait(400);
    CataloguePage.openAddProductDialog();
    cy.get('[data-testid="catalogue-product-dialog"]', { timeout: 15_000 })
      .find('button')
      .contains(/upload image/i)
      .scrollIntoView()
      .should('exist');
    cy.findByRole('button', { name: /cancel/i }).click({ force: true });
  });

  it('creates and edits category', () => {
    openCategoriesTab();
    CataloguePage.openAddCategoryDialog();
    cy.get('input[name="name"]', { timeout: 15_000 }).last().clear().type('Dairy');
    CataloguePage.clickSaveInCategoryDialog();
    cy.wait('@createCategory');
    cy.contains('td', /dairy/i, { timeout: 20_000 }).should('be.visible');

    clickRowAction(/home care/i, 'Edit');
    cy.waitUntil(() => Cypress.$(CataloguePage.categoryDialogSelector).length > 0, {
      timeout: 15_000,
      errorMsg: 'Category edit dialog did not open',
    });
    CataloguePage.getActiveDialog(CataloguePage.categoryDialogSelector)
      .find('input[name="name"]')
      .clear()
      .type('Home Care Updated');
    CataloguePage.clickSaveInCategoryDialog();
    cy.wait('@updateCategory')
      .its('request.body.name')
      .should('eq', 'Home Care Updated');
  });

  it('blocks deleting category with products', () => {
    openCategoriesTab();
    cy.contains('td', /beverages/i, { timeout: 20_000 }).should('be.visible');
    clickRowAction(/beverages/i, 'Delete');
    cy.get('[role="alertdialog"] button', { timeout: 15_000 }).last().click({ force: true });
    cy.wait('@deleteCategory').its('response.statusCode').should('eq', 400);
    cy.contains('td', /beverages/i).should('be.visible');
  });

  it('deletes category without products', () => {
    openCategoriesTab();
    CataloguePage.openAddCategoryDialog();
    cy.get('input[name="name"]', { timeout: 15_000 }).last().clear().type('Temporary Category');
    CataloguePage.clickSaveInCategoryDialog();
    cy.wait('@createCategory');

    clickRowAction(/temporary category/i, 'Delete');
    cy.get('[role="alertdialog"]', { timeout: 15_000 }).should('exist');
    cy.get('body').then(($body) => {
      const $dialog = $body.find('[role="alertdialog"]').last();
      const $destructive = $dialog.find('button[class*="destructive"]');
      if ($destructive.length > 0) {
        cy.wrap($destructive.last()).click({ force: true });
        return;
      }
      const $deleteButton = $dialog
        .find('button')
        .filter((_, el) => /^delete$/i.test((el.textContent ?? '').trim()))
        .last();
      cy.wrap($deleteButton).click({ force: true });
    });
    cy.wait('@deleteCategory').its('response.statusCode').should('be.oneOf', [200, 204]);
    cy.contains('td', /temporary category/i, { timeout: 20_000 }).should('not.exist');
  });
});
