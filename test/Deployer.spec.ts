/**
 * @file
 * Spec for Deployer class
 */

import * as chai from "chai";
import { readFileSync } from "fs";
import { resolve } from "path";
import * as proxyquire from "proxyquire";
import * as sinon from "sinon";
import * as sinonChai from "sinon-chai";

chai.use(sinonChai);
const should = chai.should();

describe("Deployer class", () => {
  let inst: any;
  const putObjectStub = sinon.stub();
  const { default: Deployer } = proxyquire("../src/Deployer", {
    "aws-sdk": {
      // prettier-ignore
      S3: function() { // tslint:disable-line
        return { putObject: putObjectStub };
      },
    },
    "./util": {
      listGitTags: async () => ["v1.0.0", "v2.0.0", "v3.0.0"],
    },
  });
  beforeEach(() => {
    putObjectStub.returns({ promise: () => Promise.resolve(true) });
    inst = new Deployer({
      awsRegion: "eu-west-1",
      bucket: "test-bucket",
      cacheAssets: true,
      dir: resolve(__dirname, "..", "fixture", "dist"),
      otherOptions: {
        Metadata: {
          "x-amz-meta-surrogate-key": "my-key",
        },
      },
      project: "test-project",
      targets: ["test"],
      urlBase: "v2",
      publicRead: true,
    });
  });

  afterEach(() => {
    putObjectStub.resetHistory();
  });

  describe("exports", () => {
    it("exports default", () => {
      should.exist(Deployer);
    });
  });

  describe("#execute()", () => {
    it("uploads expected files to S3", async () => {
      const res = await inst.execute();

      res.should.be.a("array");
      res[0].should.equal(
        "http://test-bucket.s3-website-eu-west-1.amazonaws.com/v2/test-project/test/"
      );
      putObjectStub.callCount.should.equal(3);
      putObjectStub.should.have.been.calledWith({
        ACL: "public-read",
        Body: readFileSync(
          resolve(__dirname, "..", "fixture", "dist", "assets", "foo.abc123.js")
        ),
        Bucket: "test-bucket",
        CacheControl: "max-age=365000000, immutable",
        ContentType: "application/javascript",
        Key: `v2/test-project/test/assets/foo.abc123.js`,
        Metadata: { "x-amz-meta-surrogate-key": "my-key" },
      });
      putObjectStub.should.have.been.calledWith({
        ACL: "public-read",
        Body: readFileSync(
          resolve(__dirname, "..", "fixture", "dist", "index.html")
        ),
        Bucket: "test-bucket",
        CacheControl: "max-age=60",
        ContentType: "text/html; charset=utf-8",
        Key: `v2/test-project/test/index.html`,
        Metadata: { "x-amz-meta-surrogate-key": "my-key" },
      });

      putObjectStub.should.have.been.calledWith({
        ACL: "public-read",
        Body: readFileSync(
          resolve(
            __dirname,
            "..",
            "fixture",
            "dist",
            "test.directory",
            "test.file"
          )
        ),
        Bucket: "test-bucket",
        CacheControl: "max-age=60",
        ContentType: undefined,
        Key: `v2/test-project/test/test.directory/test.file`,
        Metadata: { "x-amz-meta-surrogate-key": "my-key" },
      });
    });

    it("allows arbitrary paths", async () => {
      const newInst = new Deployer({
        awsRegion: "eu-west-1",
        bucket: "test-bucket",
        dir: resolve(__dirname, "..", "fixture", "dist"),
        path: "__arbitrary-path-test",
        cacheAssets: true,
        maxAge: 3600,
        publicRead: true,
      });

      const res = await newInst.execute();

      res.should.be.a("array");
      res[0].should.equal(
        "http://test-bucket.s3-website-eu-west-1.amazonaws.com/__arbitrary-path-test"
      );
      putObjectStub.callCount.should.equal(3);
      putObjectStub.should.have.been.calledWith({
        ACL: "public-read",
        Body: readFileSync(
          resolve(__dirname, "..", "fixture", "dist", "assets", "foo.abc123.js")
        ),
        Bucket: "test-bucket",
        CacheControl: "max-age=365000000, immutable",
        ContentType: "application/javascript",
        Key: `__arbitrary-path-test/assets/foo.abc123.js`,
      });
      putObjectStub.should.have.been.calledWith({
        ACL: "public-read",
        Body: readFileSync(
          resolve(__dirname, "..", "fixture", "dist", "index.html")
        ),
        Bucket: "test-bucket",
        CacheControl: "max-age=3600",
        ContentType: "text/html; charset=utf-8",
        Key: `__arbitrary-path-test/index.html`,
      });
    });

    it("rejects if `path` opt has trailing or leading slashes", async () => {
      const trailing = new Deployer({
        path: "__arbitrary-path-test/",
      });
      const leading = new Deployer({
        path: "__arbitrary-path-test/",
      });

      try {
        await trailing.execute();
        throw new Error("This should have already thrown");
      } catch (e: any) {
        e.message.should.equal(
          "Please provide `path` without leading or trailing slashes."
        );
      }

      try {
        await leading.execute();
        throw new Error("This should have already thrown");
      } catch (e: any) {
        e.message.should.equal(
          "Please provide `path` without leading or trailing slashes."
        );
      }
    });

    it("writes VERSIONS.json, allows preview", async () => {
      const newInst = new Deployer({
        awsRegion: "eu-west-1",
        bucket: "test-bucket",
        dir: resolve(__dirname, "..", "fixture", "dist"),
        project: "test-project",
        targets: ["test"],
        writeVersionsJson: true,
        cacheAssets: false,
        urlBase: "preview",
        publicRead: false,
      });

      await newInst.execute();
      putObjectStub.should.have.been.calledWith({
        ACL: undefined,
        Body: readFileSync(
          resolve(__dirname, "..", "fixture", "dist", "assets", "foo.abc123.js")
        ),
        Bucket: "test-bucket",
        CacheControl: "max-age=60",
        ContentType: "application/javascript",
        Key: `preview/test-project/test/assets/foo.abc123.js`,
      });
      putObjectStub.should.have.been.calledWith({
        ACL: undefined,
        Body: '["v1.0.0","v2.0.0","v3.0.0"]',
        Bucket: "test-bucket",
        CacheControl: "max-age=60",
        ContentType: "application/json",
        Key: "preview/test-project/VERSIONS.json",
      });
    });
  });

  describe("#getURLs()", () => {
    it("returns an array of URLs", () => {
      const urls = inst.getURLs();

      urls.should.be.a("array");
      urls[0].should.equal(
        `http://test-bucket.s3-website-eu-west-1.amazonaws.com/v2/test-project/test/`
      );
    });
  });
});
