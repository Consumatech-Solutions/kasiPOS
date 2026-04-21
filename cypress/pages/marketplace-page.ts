export const MarketplacePage = {
  path: "/marketplace" as const,

  visit() {
    cy.visitApp(this.path);
    // Second full navigation stabilizes hydration after flows that open dialogs on `/marketplace`.
    cy.visitApp(this.path);
    return this;
  },

  waitUntilLoaded() {
    cy.location("pathname").should("eq", this.path);
    cy.location("pathname").should("not.eq", "/login");
    cy.url().should("not.match", /\/login(\?|$)/);
    cy.contains(/welcome back!/i).should("not.exist");
    cy.get("#order-code", { timeout: 45_000 })
      .should("be.visible")
      .and("not.be.disabled");
    return this;
  },
};
