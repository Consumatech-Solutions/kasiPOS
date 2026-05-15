export const CustomersPage = {
  path: "/customers" as const,

  visit() {
    cy.visitApp(this.path);
    cy.waitForAppReady(this.path);
    return this;
  },

  waitUntilLoaded() {
    cy.location("pathname").should("eq", this.path);
    cy.contains(/welcome back!/i).should("not.exist");
    cy.get("body").should("not.contain", "animate-pulse rounded-md bg-muted");
    cy.waitUntil(
      () => Cypress.$("body").text().toLowerCase().includes("add customer"),
      {
        timeout: 60_000,
        interval: 300,
        description:
          "customers page shell rendered (Add Customer visible in DOM)",
      }
    );
    cy.findByRole("button", { name: /add customer/i, timeout: 30_000 }).should(
      "be.visible"
    );
    return this;
  },

  openAddCustomerDialog() {
    cy.findByRole("button", { name: /add customer/i }).click({ force: true });
    return this;
  },
};
