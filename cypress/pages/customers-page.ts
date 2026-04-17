export const CustomersPage = {
  path: '/customers' as const,

  visit() {
    cy.visitApp(this.path);
    return this;
  },

  waitUntilLoaded() {
    cy.location('pathname').should('eq', this.path);
    cy.contains(/welcome back!/i).should('not.exist');
    cy.findByRole('button', { name: /add customer/i, timeout: 30_000 }).should('be.visible');
    return this;
  },

  openAddCustomerDialog() {
    cy.findByRole('button', { name: /add customer/i }).click({ force: true });
    return this;
  },
};
