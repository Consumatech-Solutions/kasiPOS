export const BophPage = {
  path: '/boph' as const,

  visit() {
    cy.visitApp(this.path);
    cy.visitApp(this.path);
    return this;
  },

  waitUntilLoaded() {
    cy.location('pathname').should('eq', this.path);
    cy.location('pathname').should('not.eq', '/login');
    cy.url().should('not.match', /\/login(\?|$)/);
    cy.contains(/welcome back!/i).should('not.exist');
    cy.findByText(/boph - buy online, pickup here/i, { timeout: 45_000 }).should('be.visible');
    cy.findByRole('button', { name: /add parcel/i }).should('be.visible').and('not.be.disabled');
    cy.findByRole('tab', { name: /incoming/i }, { timeout: 25_000 }).should('be.visible');
    return this;
  },
};
