export const OfflinePage = {
  path: "/offline" as const,

  visit() {
    cy.visitApp(this.path);
    return this;
  },

  waitUntilLoaded() {
    cy.findByText(/check your connection/i).should("be.visible");
    return this;
  },
};
