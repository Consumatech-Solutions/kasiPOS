describe("Real auth smoke", () => {
  beforeEach(function () {
    const mode = String(Cypress.env("TEST_MODE") ?? "mock").toLowerCase();
    if (mode !== "real") {
      this.skip();
    }
    cy.setupScenario();
  });

  it("logs in with real credentials and loads app shell", () => {
    const expectedPath =
      (Cypress.env("REAL_POST_LOGIN_PATH") as string | undefined) ?? "/";
    cy.waitForAppReady(
      expectedPath.startsWith("/")
        ? new RegExp(`^${expectedPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)
        : expectedPath
    );
    cy.location("pathname", { timeout: 30_000 }).should("not.eq", "/login");
    cy.window().then((win) => {
      const token = String(win.localStorage.getItem("token") ?? "");
      const user = String(win.localStorage.getItem("user") ?? "");
      expect(token).to.be.a("string");
      expect(token.length).to.be.greaterThan(0);
      expect(user).to.be.a("string");
      expect(user.length).to.be.greaterThan(0);
    });
  });
});
