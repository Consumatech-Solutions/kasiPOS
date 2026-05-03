import { BophPage } from "../pages/boph-page";

describe("BOPH", () => {
  beforeEach(() => {
    cy.setupScenario();
    BophPage.visit();
    cy.seedIndexedDb();
    cy.setOnline();
    BophPage.waitUntilLoaded();
  });

  afterEach(() => {
    cy.setOnlineModeOnly();
  });

  it("shows incoming parcels", () => {
    cy.location("pathname").should("eq", "/boph");
    cy.findByRole("tab", { name: /incoming/i }).click({ force: true });
    cy.contains(/del-1001/i).should("be.visible");
  });

  it("marks incoming parcel as received", () => {
    cy.findByRole("tab", { name: /incoming/i }).click({ force: true });
    cy.contains("tr", /del-1001/i).within(() => {
      cy.findByRole("button", { name: /^receive$/i }).click({ force: true });
    });
    cy.findByRole("dialog").within(() => {
      cy.findByRole("button", { name: /confirm & receive/i }).click({
        force: true,
      });
    });
    cy.contains(/parcel received/i, { timeout: 15_000 }).should("be.visible");
    cy.findByRole("dialog", { name: /receive parcel/i }).should("not.exist");
  });

  it("validates collection code search in ready tab", () => {
    cy.findByRole("tab", { name: /ready/i }).click({ force: true });
    cy.findByPlaceholderText(/search by collection code/i).type("WRONG-CODE");
    cy.contains(/no parcel found with that collection code/i).should(
      "be.visible"
    );
  });

  it("marks ready parcel as collected", () => {
    cy.setOnline();
    cy.findByRole("tab", { name: /^ready$/i }).click({ force: true });
    cy.contains("tr", /del-1002/i).within(() => {
      cy.findByRole("button", { name: /issue parcel/i }).click({ force: true });
    });
    cy.findByRole("dialog").within(() => {
      cy.findByLabelText(/collector's full name/i).clear();
      cy.findByLabelText(/collector's full name/i).type("Collection Tester");
      cy.findByLabelText(/collector's id/i).clear();
      cy.findByLabelText(/collector's id/i).type("9001011234088");
      cy.findByRole("button", { name: /confirm collection/i }).click({
        force: true,
      });
    });
    cy.contains(/parcel collected/i, { timeout: 15_000 }).should("be.visible");
    cy.findByRole("dialog", { name: /issue parcel:/i }).should("not.exist");
  });

  it("creates a new incoming parcel", () => {
    cy.findByRole("button", { name: /add parcel/i }).click({ force: true });
    cy.findByRole("dialog").within(() => {
      cy.findByLabelText(/delivery number/i).type("DEL-1009");
      cy.findByLabelText(/customer name/i).type("New Parcel User");
      cy.findByRole("button", { name: /create parcel/i }).click({
        force: true,
      });
    });
    cy.contains(/del-1009/i).should("be.visible");
  });
});
