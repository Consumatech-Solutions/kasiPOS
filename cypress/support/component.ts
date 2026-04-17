import "./commands";
import { mount } from "cypress/react";

declare module "cypress" {
  interface Chainable {
    mount: typeof mount;
  }
}

Cypress.Commands.add("mount", mount);
