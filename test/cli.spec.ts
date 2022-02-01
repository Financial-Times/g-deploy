/**
 * @file
 * Spec for cli entry point
 *
 * @TODO This is just a stub at the moment because
 *       mocking everything CLI does is hard.
 */

import * as chai from "chai";
import cli from "../src/cli";

const should = chai.should();

describe("cli entry point", () => {
  describe("exports", () => {
    it("exports default", () => {
      should.exist(cli);
    });
  });
});
