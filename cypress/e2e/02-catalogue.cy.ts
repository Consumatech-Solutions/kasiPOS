import { CataloguePage } from "../pages/catalogue-page";

function clickRowAction(rowLabel: RegExp, actionLabel: "Edit" | "Delete") {
  const itemRegex = new RegExp(`^\\s*${actionLabel}\\s*$`, "i");
  const menuItemSelector = '[role="menuitem"], [data-radix-collection-item]';
  const targetRow = () => cy.contains("tr", rowLabel, { timeout: 20_000 });

  const clickActionsButtonInRow = () => {
    targetRow().should("be.visible");
    return targetRow().within(() => {
      cy.get('button[aria-label="Actions"]').first().as("rowActionsButton");
      cy.get("@rowActionsButton").scrollIntoView();
      cy.get("@rowActionsButton").should("be.visible");
      cy.get("@rowActionsButton").click({ force: true });
    });
  };

  const openActionsMenu = (remainingAttempts = 2) =>
    clickActionsButtonInRow().then(() => {
      cy.get("body").then(($body) => {
        const hasVisibleActionItem =
          $body.find(`${menuItemSelector}:visible`).length > 0;
        if (hasVisibleActionItem || remainingAttempts <= 0) return;
        return openActionsMenu(remainingAttempts - 1);
      });
    });

  const clickMenuItem = (remainingAttempts = 4): Cypress.Chainable => {
    return openActionsMenu().then(() => {
      return cy.get("body").then(($body) => {
        const candidate = $body
          .find(`${menuItemSelector}:visible`)
          .toArray()
          .find((el) => itemRegex.test((el.textContent ?? "").trim()));

        if (candidate) {
          return cy.wrap(candidate).click({ force: true });
        }

        if (remainingAttempts <= 0) {
          throw new Error(`Could not find visible ${actionLabel} menu item`);
        }

        return clickMenuItem(remainingAttempts - 1);
      });
    });
  };

  clickMenuItem();
}

function openCategoriesTab() {
  cy.findByRole("tab", { name: /^categories$/i })
    .filter(":visible")
    .first()
    .click({ force: true });
  cy.contains("th, td", /category name/i, { timeout: 15_000 }).should(
    "be.visible"
  );
}

function openCategoryEditDialog(rowLabel: RegExp) {
  const openSelector = `${CataloguePage.categoryDialogSelector}[data-state="open"]`;
  clickRowAction(rowLabel, "Edit");
  cy.get("body").then(($body) => {
    const isOpen = $body.find(openSelector).length > 0;
    if (isOpen) return;
    clickRowAction(rowLabel, "Edit");
  });
}

describe("Catalogue", () => {
  beforeEach(() => {
    cy.setupScenario();
    cy.setOnlineModeOnly();
    CataloguePage.visit();
    cy.setOnline();
    CataloguePage.waitUntilLoaded();
  });

  it("loads catalogue route and tabs", () => {
    cy.location("pathname").should("eq", "/catalogue");
    cy.findByRole("tab", { name: /^products$/i }).should("be.visible");
    cy.findByRole("tab", { name: /^categories$/i }).should("be.visible");
  });

  it("creates a product and shows it in list", () => {
    CataloguePage.openAddProductDialog();
    cy.get('input[name="name"]', { timeout: 15_000 })
      .last()
      .as("productNameInput");
    cy.get("@productNameInput").clear();
    cy.get("@productNameInput").type("E2E Apples");
    cy.get('[data-testid="catalogue-product-dialog"]')
      .last()
      .as("productDialog");
    cy.get("@productDialog")
      .find('[role="combobox"]')
      .first()
      .click({ force: true });
    cy.findByRole("option", { name: /^beverages$/i, timeout: 15_000 }).click({
      force: true,
    });
    cy.get('input[name="price"]').last().as("productPriceInput");
    cy.get("@productPriceInput").clear();
    cy.get("@productPriceInput").type("40");
    cy.get('input[name="costPrice"]').last().as("productCostInput");
    cy.get("@productCostInput").clear();
    cy.get("@productCostInput").type("25");
    CataloguePage.clickSaveInProductDialog();
    cy.wait("@createProduct");
    cy.contains("td", /e2e apples/i).should("be.visible");
  });

  it("edits product fields and persists changes", () => {
    clickRowAction(/cola 330ml/i, "Edit");
    cy.waitUntil(
      () =>
        Cypress.$(`${CataloguePage.productDialogSelector}[data-state="open"]`)
          .length > 0,
      {
        timeout: 15_000,
        errorMsg: "Product edit dialog did not open",
      }
    );
    CataloguePage.getActiveDialog(CataloguePage.productDialogSelector).within(
      () => {
        cy.get('input[name="name"]').scrollIntoView();
        cy.get('input[name="name"]').clear();
        cy.get('input[name="name"]').type("Cola 330ml Updated");
        cy.get('input[name="price"]').scrollIntoView();
        cy.get('input[name="price"]').clear();
        cy.get('input[name="price"]').type("13");
      }
    );
    cy.setOnline();
    CataloguePage.clickSaveInProductDialog();
    cy.wait("@updateProduct", { timeout: 15_000 }).then((interception) => {
      expect(interception.request.body.name).to.eq("Cola 330ml Updated");
      expect(Number(interception.request.body.price)).to.eq(13);
    });
    cy.contains("td", /cola 330ml updated/i, { timeout: 20_000 }).should(
      "be.visible"
    );
  });

  it("deletes product after confirmation", () => {
    clickRowAction(/salted chips/i, "Delete");
    cy.findByRole("alertdialog").within(() => {
      cy.findByRole("button", { name: /^delete$/i }).click({ force: true });
    });
    cy.wait("@deleteProduct");
    cy.contains("td", /salted chips/i).should("not.exist");
  });

  it("shows product form image input for upload flow", () => {
    cy.findByRole("tab", { name: /^products$/i })
      .filter(":visible")
      .first()
      .click({ force: true });
    CataloguePage.openAddProductDialog();
    cy.get('[data-testid="catalogue-product-dialog"]', { timeout: 15_000 })
      .find("button")
      .contains(/upload image/i)
      .as("uploadImageButton");
    cy.get("@uploadImageButton").scrollIntoView();
    cy.get("@uploadImageButton").should("exist");
    cy.findByRole("button", { name: /cancel/i }).click({ force: true });
  });

  it("creates and edits category", () => {
    openCategoriesTab();
    CataloguePage.openAddCategoryDialog();
    CataloguePage.getActiveDialog(CataloguePage.categoryDialogSelector)
      .find('input[name="name"]', { timeout: 15_000 })
      .clear()
      .type("Dairy");
    CataloguePage.clickSaveInCategoryDialog();
    cy.wait("@createCategory");
    cy.contains("td", /dairy/i, { timeout: 20_000 }).should("be.visible");

    openCategoryEditDialog(/home care/i);
    cy.get(`${CataloguePage.categoryDialogSelector}[data-state="open"]`, {
      timeout: 15_000,
    }).should("be.visible");
    CataloguePage.getActiveDialog(CataloguePage.categoryDialogSelector)
      .find('input[name="name"]')
      .should("not.be.disabled")
      .clear()
      .type("Home Care Updated");
    cy.setOnline();
    CataloguePage.clickSaveInCategoryDialog();
    cy.wait("@updateCategory")
      .its("request.body.name")
      .should("eq", "Home Care Updated");
  });

  it("blocks deleting category with products", () => {
    openCategoriesTab();
    cy.contains("td", /beverages/i, { timeout: 20_000 }).should("be.visible");
    clickRowAction(/beverages/i, "Delete");
    cy.get('[role="alertdialog"] button', { timeout: 15_000 })
      .last()
      .click({ force: true });
    cy.wait("@deleteCategory").its("response.statusCode").should("eq", 400);
    cy.contains("td", /beverages/i).should("be.visible");
  });

  it("deletes category without products", () => {
    openCategoriesTab();
    CataloguePage.openAddCategoryDialog();
    CataloguePage.getActiveDialog(CataloguePage.categoryDialogSelector)
      .find('input[name="name"]', { timeout: 15_000 })
      .clear()
      .type("Temporary Category");
    CataloguePage.clickSaveInCategoryDialog();
    cy.wait("@createCategory");

    clickRowAction(/temporary category/i, "Delete");
    cy.get('[role="alertdialog"]', { timeout: 15_000 }).should("exist");
    cy.get("body").then(($body) => {
      const $dialog = $body.find('[role="alertdialog"]').last();
      const $destructive = $dialog.find('button[class*="destructive"]');
      if ($destructive.length > 0) {
        cy.wrap($destructive.last()).click({ force: true });
        return;
      }
      const $deleteButton = $dialog
        .find("button")
        .filter((_, el) => /^delete$/i.test((el.textContent ?? "").trim()))
        .last();
      cy.wrap($deleteButton).click({ force: true });
    });
    cy.wait("@deleteCategory")
      .its("response.statusCode")
      .should("be.oneOf", [200, 204]);
    cy.contains("td", /temporary category/i, { timeout: 20_000 }).should(
      "not.exist"
    );
  });
});
