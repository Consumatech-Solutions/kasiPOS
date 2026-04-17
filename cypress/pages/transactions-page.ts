export const TransactionsPage = {
  path: "/transactions" as const,

  visit() {
    cy.visitApp(this.path);
    return this;
  },

  waitUntilLoaded() {
    cy.findByText(/transaction history/i).should("be.visible");
    return this;
  },
};
