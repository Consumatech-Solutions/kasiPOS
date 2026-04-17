import { MarketplacePage } from '../pages/marketplace-page';

describe('Marketplace', () => {
  beforeEach(() => {
    cy.setupScenario();
    MarketplacePage.visit();
    cy.setOnline();
    MarketplacePage.waitUntilLoaded();
  });

  afterEach(() => {
    cy.setOnlineModeOnly();
  });

  it('loads marketplace stores', () => {
    cy.location('pathname').should('eq', '/marketplace');
    cy.contains(/fresh mart/i).should('be.visible');
    cy.contains(/quick buy/i).should('be.visible');
  });

  it('searches order by code', () => {
    cy.findByPlaceholderText(/enter order code/i).type('MK-10001', { force: true });
    cy.findByRole('button', { name: /find order/i }).click({ force: true });
    cy.wait('@searchMarketplaceOrder');
    cy.findByText(/order details/i).should('be.visible');
    cy.findByText(/mk-10001/i).should('be.visible');
    cy.findByRole('button', { name: /^close$/i }).click({ force: true });
  });

  it('navigates to marketplace order history', () => {
    cy.findByRole('link', { name: /view orders/i }).click();
    cy.location('pathname').should('eq', '/marketplace/orders');
    cy.contains(/marketplace orders/i).should('be.visible');
    cy.contains(/mk-10001/i).should('be.visible');
  });

  it('filters marketplace order history by code', () => {
    cy.visitApp('/marketplace/orders');
    cy.location('pathname').should('eq', '/marketplace/orders');
    cy.findByPlaceholderText(/search by order code/i).type('MK-10002');
    cy.contains(/mk-10002/i).should('be.visible');
  });

  it('places marketplace order on behalf of customer', () => {
    cy.visitApp('/marketplace/fresh-mart');
    cy.location('pathname').should('eq', '/marketplace/fresh-mart');
    cy.findByRole('button', { name: /add customer/i }, { timeout: 30_000 }).should('be.visible').and('not.be.disabled');
    cy.contains(/fresh mart/i).should('be.visible');
    cy.contains(/cola 330ml/i)
      .should('be.visible')
      .closest('tr')
      .within(() => {
        cy.findByRole('button', { name: /^add$/i }).click({ force: true });
      });
    cy.findByRole('button', { name: /add customer/i }).click({ force: true });
    cy.contains('tr', /alice mokoena/i, { timeout: 30_000 }).click({ force: true });
    cy.findByRole('button', { name: /^cash$/i }).click({ force: true });
    cy.findByRole('button', { name: /^exact$/i }).click({ force: true });
    cy.findByRole('button', { name: /complete sale/i }).click({ force: true });
    cy.wait('@createMarketplaceOrder', { timeout: 30_000 });
    cy.contains(/order created|created successfully|marketplace order/i).should('be.visible');
  });

  it('shows online requirement banner when offline', () => {
    cy.setOffline();
    cy.reload();
    cy.contains(/cloud unavailable|requires an internet connection/i).should('be.visible');
  });
});
