import "@testing-library/cypress/add-commands";
import "cypress-wait-until";
import "./commands";

Cypress.on("uncaught:exception", (error) => {
  const message = error?.message ?? "";
  if (
    /Hydration failed because the server rendered HTML didn't match the client/i.test(
      message
    ) ||
    /Text content does not match server-rendered HTML/i.test(message)
  ) {
    return false;
  }
  return true;
});
