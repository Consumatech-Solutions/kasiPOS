export const VouchersPage = {
  path: '/vouchers' as const,

  visit() {
    cy.visitApp(this.path);
    return this;
  },

  waitUntilLoaded() {
    cy.findByText(/voucher management/i).should('be.visible');
    return this;
  },

  openCreateDialog() {
    cy.findByRole('button', { name: /create voucher/i }).click({ force: true });
    return this;
  },
};
