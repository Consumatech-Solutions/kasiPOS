import { InventoryPage } from '../pages/inventory-page';

describe('Inventory', () => {
  beforeEach(() => {
    cy.setupScenario();
    InventoryPage.visit();
    cy.setOnline();
    InventoryPage.waitUntilLoaded();
  });

  it('loads inventory list with stock levels', () => {
    cy.location('pathname').should('eq', '/inventory');
    cy.contains('td', /cola 330ml/i).should('be.visible');
    cy.contains('td', /still water 500ml/i).should('be.visible');
  });

  it('filters inventory by search and category', () => {
    InventoryPage.search('Water');
    cy.contains('td', /still water 500ml/i).should('be.visible');
    cy.contains('td', /cola 330ml/i).should('not.exist');

    cy.get('button[role="combobox"]', { timeout: 15_000 }).first().click({ force: true });
    cy.findByRole('option', { name: /^beverages$/i, timeout: 15_000 }).click({ force: true });
    cy.contains('td', /still water 500ml/i).should('be.visible');
  });

  it('applies low stock filter view', () => {
    cy.findByLabelText(/low stock only/i).click({ force: true });
    cy.contains('td', /hand soap/i).should('be.visible');
  });

  it('creates stock adjustment with reason and updates stock', () => {
    cy.contains('tr', /still water 500ml/i).within(() => {
      cy.findByRole('button', { name: /adjust stock/i }).click();
    });
    cy.findByRole('dialog', { timeout: 15_000 }).as('adjustDialog');
    cy.get('@adjustDialog').findByText(/adjust stock for still water 500ml/i).should('be.visible');
    cy.get('@adjustDialog').find('button[role="combobox"]', { timeout: 15_000 }).first().click({ force: true });
    // Radix options render in a portal outside dialog subtree.
    cy.findByRole('option', { name: /new stock received/i, timeout: 15_000 }).click({ force: true });
    cy.get('[role="dialog"]', { timeout: 15_000 })
      .last()
      .within(() => {
        cy.get('input[type="number"]', { timeout: 15_000 }).should('be.visible').clear().type('15');
        cy.findByLabelText(/note/i, { timeout: 15_000 }).type('E2E restock');
        cy.findByRole('button', { name: /save adjustment/i, timeout: 15_000 }).click();
      });
    cy.wait('@createStockAdjustment').then((interception) => {
      const requestBody = interception.request.body as { reason?: string };
      expect(requestBody.reason).to.eq('New stock received');
    });
    cy.contains('td', /still water 500ml/i, { timeout: 15_000 })
      .parents('tr')
      .first()
      .should('contain.text', '23');
  });

  it('shows stock adjustment history', () => {
    cy.contains('tr', /still water 500ml/i).within(() => {
      cy.findByRole('button', { name: /history/i }).click();
    });
    cy.findByRole('dialog', { timeout: 15_000 }).as('historyDialog');
    cy.get('@historyDialog').contains(/stock adjustment history for still water 500ml/i).should('be.visible');
    cy.get('@historyDialog').contains(/new stock received/i).should('be.visible');
  });

  it('edits low stock trigger inline', () => {
    cy.contains('td', /cola 330ml/i, { timeout: 15_000 })
      .parents('tr')
      .first()
      .within(() => {
        cy.get('button:has(svg.lucide-square-pen)', { timeout: 15_000 }).first().click({ force: true });
      });
    cy.contains('td', /cola 330ml/i, { timeout: 15_000 })
      .parents('tr')
      .first()
      .find('input[type="number"]', { timeout: 15_000 })
      .should('be.visible')
      .clear()
      .type('7{enter}');
    cy.contains('tr', /cola 330ml/i).should('contain.text', '7');
  });
});
