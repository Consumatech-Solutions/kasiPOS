export const CataloguePage = {
  path: '/catalogue' as const,
  productDialogSelector: '[data-testid="catalogue-product-dialog"]',
  categoryDialogSelector: '[data-testid="catalogue-category-dialog"]',

  getActiveDialog(selector: string) {
    const openSelector = `${selector}[data-state="open"]`;
    return cy.get('body', { log: false }).then(($body) => {
      const $open = $body.find(openSelector);
      if ($open.length > 0) return cy.wrap($open.last());
      return cy.get(selector, { timeout: 15_000 }).last();
    });
  },

  visit() {
    cy.visitApp(this.path);
    return this;
  },

  waitUntilLoaded() {
    cy.waitForAppReady('/catalogue');
    cy.findByText(/catalogue management/i).should('be.visible');
    return this;
  },

  clickSaveInProductDialog() {
    this.getActiveDialog(this.productDialogSelector).within(() => {
      cy.contains('button', /^save$/i, { timeout: 10_000 }).should('not.be.disabled').click({ force: true });
    });
    return this;
  },

  clickSaveInCategoryDialog() {
    this.getActiveDialog(this.categoryDialogSelector).within(() => {
      cy.contains('button', /^save$/i, { timeout: 10_000 }).should('not.be.disabled').click({ force: true });
    });
    return this;
  },

  openAddProductDialog() {
    cy.get('[data-testid="catalogue-add-product-button"]').should('be.visible').click({ force: true });
    cy.waitUntil(() => Cypress.$(this.productDialogSelector).length > 0, {
      timeout: 15_000,
      errorMsg: 'Add Product dialog did not open',
    });
    this.getActiveDialog(this.productDialogSelector).find('input[name="name"]').should('exist');
    return this;
  },

  openAddCategoryDialog() {
    cy.get('[data-testid="catalogue-add-category-button"]').should('be.visible').click({ force: true });
    cy.waitUntil(() => Cypress.$(this.categoryDialogSelector).length > 0, {
      timeout: 15_000,
      errorMsg: 'Add Category dialog did not open',
    });
    this.getActiveDialog(this.categoryDialogSelector).find('input[name="name"]').should('exist');
    return this;
  },
};
