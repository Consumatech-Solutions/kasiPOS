export const InventoryPage = {
  path: '/inventory' as const,

  visit() {
    cy.visitApp(this.path);
    return this;
  },

  waitUntilLoaded() {
    cy.location('pathname').should('eq', this.path);
    cy.findByPlaceholderText(/search by product name/i, { timeout: 30_000 }).should('be.visible');
    cy.findByLabelText(/low stock only/i).should('exist');
    return this;
  },

  search(term: string) {
    cy.findByPlaceholderText(/search by product name/i).clear().type(term);
    return this;
  },
};
