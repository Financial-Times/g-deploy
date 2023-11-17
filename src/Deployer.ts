/**
 * @file
 * EventEmitter-based deployer class.
 * This does all the work.
 */

import { S3 } from "aws-sdk";
import { EventEmitter } from "events";
import { createReadStream, readFileSync, writeFileSync } from "fs";
import { sync as glob } from "glob";
import { lookup as mime } from "mime-types";
import { extname, resolve } from "path";
import { git, listGitTags } from "./util";

export interface IDeployerOptions {
  localDir: string; // e.g. '/path/to/dist'
  awsKey?: string;
  awsSecret?: string;
  awsRegion?: string;
  bucketName: string;

  projectName: string; // usually in the form 'ft-interactive/some-project'

  targets: string[]; // for reference, the CLI provides two targets: the commit sha and branch name

  path?: string; // Set arbitrary S3 prefix instead of using existing path logic

  preview?: boolean;

  maxAge?: number; // for everything except revved assets

  assetsPrefix?: string; // e.g. "https://example.com/v2/__assets/"

  otherOptions?: object; // pass in any other params that aws-sdk supports

  writeVersionsJson?: boolean;
}

interface IRevManifest {
  [key: string]: string;
}

const REV_MANIFEST_FILENAME = "rev-manifest.json";
const VERSIONS_JSON_FILENAME = "VERSIONS.json";

export default class Deployer extends EventEmitter {
  public options: IDeployerOptions;

  constructor(options: IDeployerOptions) {
    super();
    this.options = options;
  }

  public async execute() {
    const {
      localDir,
      bucketName,
      projectName,
      awsKey,
      awsSecret,
      awsRegion,
      targets,
      path,
      preview,
      assetsPrefix,
      maxAge,
      otherOptions,
      writeVersionsJson,
    } = this.options;

    if (path && (path.startsWith("/") || path.endsWith("/"))) {
      throw new Error(
        "Please provide `path` without leading or trailing slashes."
      );
    } else if (path) {
      console.warn(
        "Using the `path` option. PLEASE BE VERY CAREFUL WITH THIS."
      );
    }

    // load in the rev-manifest
    const revManifest: IRevManifest | null = (() => {
      try {
        return JSON.parse(
          readFileSync(resolve(localDir, REV_MANIFEST_FILENAME), "utf-8")
        );
      } catch (error: any) {
        if (error.code === "ENOENT") {
          return undefined;
        }
        throw error;
      }
    })();

    // save an altered version of the rev manifest, if any
    const modifiedRevManifest: IRevManifest = {};
    if (revManifest) {
      if (typeof assetsPrefix !== "string") {
        throw new Error(
          "Expected assetsPrefix to be defined if revManifest is being used"
        );
      }

      if (path) {
        Object.keys(revManifest).forEach((key) => {
          modifiedRevManifest[key] = `${path}/${revManifest[key]}`;
        });
      } else {
        Object.keys(revManifest).forEach((key) => {
          modifiedRevManifest[key] = `${assetsPrefix}${revManifest[key]}`;
        });
      }
    }

    const revvedFiles = revManifest && Object.values(modifiedRevManifest);

    // make an S3 client instance
    const client = new S3({
      accessKeyId: awsKey,
      region: awsRegion,
      secretAccessKey: awsSecret,
    });

    const allFiles: string[][] = glob(`${localDir}/**/*`, { nodir: true })
      .filter((filePath) => !filePath.includes(REV_MANIFEST_FILENAME))
      .map((filePath) => [filePath, filePath.replace(`${localDir}/`, "")]);

    if (revvedFiles) {
      const uploadedAssets = Promise.all(
        allFiles
          .filter(([filePath, filename]) =>
            revvedFiles.find((revved) => revved.includes(filename as string))
          )
          .map(([filePath, filename]) =>
            client
              .putObject({
                ACL: bucketName.includes("ft-djd-ccc")
                  ? undefined
                  : "public-read",
                Body: readFileSync(filePath as string),
                Bucket: bucketName,
                CacheControl: "max-age=365000000, immutable",
                Key: path
                  ? `${path}/${filename}`
                  : `v2/__assets/${projectName}/${filename}`,
                ...otherOptions,
              })
              .promise()
          )
      ).then(() => this.emit("uploaded", { info: "assets" }));
    }

    const prefixes = path ? [path] : targets;

    await prefixes.reduce(async (queue: Promise<any[]>, target: string) => {
      const acc = await queue;
      const uploadedTarget = Promise.all(
        allFiles
          .filter(
            ([, filename]) =>
              filename && !filename.includes(REV_MANIFEST_FILENAME)
          )
          .map(([filePath, filename]) => {
            const mimeType =
              extname(filename as string) === ""
                ? "text/html"
                : mime(extname(filename as string)) || undefined;

            const ContentType =
              mimeType && mimeType.includes("text")
                ? `${mimeType}; charset=utf-8`
                : mimeType;

            return client
              .putObject({
                ACL: bucketName.includes("ft-djd-ccc")
                  ? undefined
                  : "public-read",
                Body: readFileSync(filePath as string),
                Bucket: bucketName,
                CacheControl: `max-age=${
                  typeof maxAge === "number" ? maxAge : 60
                }`,
                ContentType,
                Key: path
                  ? `${path}/${filename}`
                  : `v2${
                      preview ? "-preview" : ""
                    }/${projectName}/${target}/${filename}`,
                ...otherOptions,
              })
              .promise();
          })
      ).then(() => {
        this.emit("uploaded", {
          info: `${target} (bundle)`,
        });
      });

      if (revManifest) {
        await client
          .putObject({
            ACL: bucketName.includes("ft-djd-ccc") ? undefined : "public-read",
            Body: JSON.stringify(revManifest),
            Bucket: bucketName,
            CacheControl: `max-age=${typeof maxAge === "number" ? maxAge : 60}`,
            ContentType: "application/json",
            Key: path
              ? `${path}/${REV_MANIFEST_FILENAME}`
              : `v2${
                  preview ? "-preview" : ""
                }/${projectName}/${target}/${REV_MANIFEST_FILENAME}`,
            ...otherOptions,
          })
          .promise()
          .then(() =>
            this.emit("uploaded", { info: `${target} (modified rev-manifest)` })
          );
      }
      return [...acc, await uploadedTarget];
    }, Promise.resolve([]));

    if (writeVersionsJson) {
      const tags = await listGitTags();

      await client
        .putObject({
          Body: JSON.stringify(tags || []),
          Bucket: bucketName,
          CacheControl: `max-age=${typeof maxAge === "number" ? maxAge : 60}`,
          ContentType: "application/json",
          Key: path
            ? `${path}/${VERSIONS_JSON_FILENAME}`
            : `v2${
                preview ? "-preview" : ""
              }/${projectName}/${VERSIONS_JSON_FILENAME}`,
          ...otherOptions,
        })
        .promise()
        .then(() =>
          this.emit("uploaded", {
            info: `${projectName} (modified versions: ${VERSIONS_JSON_FILENAME})`,
          })
        );
    }
    return this.getURLs();
  }

  /**
   * Returns the base URLs that this deployer would deploy to.
   */
  public getURLs() {
    const { bucketName, projectName, awsRegion, targets, path, preview } =
      this.options;

    if (path) {
      return [
        `http://${bucketName}.s3-website-${awsRegion}.amazonaws.com/${path}/`,
      ];
    }

    return targets.map(
      (target) =>
        `http://${bucketName}.s3-website-${awsRegion}.amazonaws.com/v2${
          preview ? "-preview" : ""
        }/${projectName}/${target}/`
    );
  }
}
