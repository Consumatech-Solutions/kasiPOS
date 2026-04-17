import { VouchersPage } from "../pages/vouchers-page";
import { PosPage } from "../pages/pos-page";

describe("Vouchers", () => {
  beforeEach(() => {
    cy.setupScenario();
  });

  it("loads vouchers and filters by status", () => {
    VouchersPage.visit();
    cy.setOnline();
    VouchersPage.waitUntilLoaded();
    cy.location("pathname").should("eq", "/vouchers");
    cy.contains(/save10/i).should("be.visible");
    cy.findByRole("button", { name: /^inactive$/i }).click({ force: true });
    cy.contains(/inactive5/i).should("be.visible");
  });

  it("creates percentage voucher", () => {
    VouchersPage.visit();
    cy.setOnline();
    VouchersPage.waitUntilLoaded();
    VouchersPage.openCreateDialog();
    cy.findByLabelText(/voucher code/i).type("APRIL20");
    cy.findByLabelText(/discount type/i).click();
    cy.findByRole("option", { name: /percentage/i }).click();
    cy.findByLabelText(/percentage/i).clear();
    cy.findByLabelText(/percentage/i).type("20");
    cy.findByLabelText(/minimum purchase/i).clear();
    cy.findByLabelText(/minimum purchase/i).type("10");
    cy.findByRole("button", { name: /^create$/i }).click({ force: true });
    cy.wait("@createVoucher");
    cy.contains(/april20/i).should("be.visible");
  });

  it("creates fixed amount voucher", () => {
    VouchersPage.visit();
    cy.setOnline();
    VouchersPage.waitUntilLoaded();
    VouchersPage.openCreateDialog();
    cy.findByLabelText(/voucher code/i).type("FIX25");
    cy.findByLabelText(/discount type/i).click();
    cy.findByRole("option", { name: /fixed amount/i }).click();
    cy.findByLabelText(/amount/i).clear();
    cy.findByLabelText(/amount/i).type("25");
    cy.findByLabelText(/minimum purchase/i).clear();
    cy.findByLabelText(/minimum purchase/i).type("50");
    cy.findByRole("button", { name: /^create$/i }).click({ force: true });
    cy.wait("@createVoucher");
    cy.contains(/fix25/i).should("be.visible");
  });

  it("edits voucher to deactivate it", () => {
    VouchersPage.visit();
    cy.setOnline();
    VouchersPage.waitUntilLoaded();
    cy.contains("tr", /save10/i).within(() => {
      cy.get("button").first().click({ force: true });
    });
    cy.findByRole("switch").click({ force: true });
    cy.findByRole("button", { name: /^update$/i }).click({ force: true });
    cy.wait("@updateVoucher");
    cy.contains("tr", /save10/i).should("contain.text", "Inactive");
  });

  it("applies voucher code from POS and reflects discount", () => {
    PosPage.visit();
    cy.setOnline();
    PosPage.waitUntilLoaded();
    cy.findByRole("button", { name: /add customer/i, timeout: 30_000 }).should(
      "be.visible",
    );
    cy.location("pathname").should("eq", "/");
    PosPage.ensureProductCarouselView();
    PosPage.addProduct("Cola 330ml", 2);
    PosPage.selectCustomerFromDialog("Alice Mokoena");
    PosPage.openVoucherDialog();
    cy.get("#voucherCode", { timeout: 15_000 }).clear();
    cy.get("#voucherCode", { timeout: 15_000 }).type("SAVE10");
    cy.findByRole("button", { name: /find voucher/i }).should("be.enabled");
    cy.findByRole("button", { name: /find voucher/i }).click();
    cy.wait("@validateVoucher").then((interception) => {
      expect(interception.response?.body).to.have.property("valid", true);
    });
    cy.findByRole("alert", { timeout: 15_000 }).should(
      "contain.text",
      "Voucher Found!",
    );
    cy.findByRole("button", { name: /apply discount/i })
      .should("be.enabled")
      .click();
    cy.get("#voucherCode").should("not.exist");
    cy.contains("Voucher applied", {
      matchCase: false,
      timeout: 20_000,
    }).should("be.visible");
  });

  it("rejects inactive voucher in POS validation", () => {
    PosPage.visit();
    cy.setOnline();
    PosPage.waitUntilLoaded();
    cy.findByRole("button", { name: /add customer/i, timeout: 30_000 }).should(
      "be.visible",
    );
    cy.location("pathname").should("eq", "/");
    PosPage.ensureProductCarouselView();
    PosPage.addProduct("Cola 330ml", 2);
    PosPage.selectCustomerFromDialog("Alice Mokoena");
    PosPage.openVoucherDialog();
    cy.get("#voucherCode", { timeout: 15_000 }).clear();
    cy.get("#voucherCode", { timeout: 15_000 }).type("INACTIVE5");
    cy.findByRole("button", { name: /find voucher/i }).should("be.enabled");
    cy.findByRole("button", { name: /find voucher/i }).click();
    cy.wait("@validateVoucher").then((interception) => {
      expect(interception.response?.body).to.have.property("valid", false);
    });
    cy.findByRole("alert", { timeout: 15_000 }).should("contain.text", "Error");
    cy.findByRole("alert").should("contain.text", "inactive");
  });
});
