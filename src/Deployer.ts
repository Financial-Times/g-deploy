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

  maxAge?: number; // for everything except checksum-ed files (in assets/ dir)

  otherOptions?: object; // pass in any other params that aws-sdk supports

  writeVersionsJson?: boolean;
}

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

    // make an S3 client instance
    const client = new S3({
      region: awsRegion,
    });

    const allFiles: string[][] = glob(`${localDir}/**/*`, { nodir: true }).map(
      (filePath) => [filePath, filePath.replace(`${localDir}/`, "")]
    );

    const prefixes = path ? [path] : targets;

    await prefixes.reduce(async (queue: Promise<any[]>, target: string) => {
      const acc = await queue;
      const uploadedTarget = Promise.all(
        allFiles.map(([filePath, filename]) => {
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
              ACL:
                bucketName === "ft-ig-content-prod" ? "public-read" : undefined,
              Body: readFileSync(filePath as string),
              Bucket: bucketName,
              CacheControl: filename.match(/^assets\//)
                ? "max-age=365000000, immutable"
                : `max-age=${typeof maxAge === "number" ? maxAge : 60}`,
              ContentType,
              Key: path
                ? `${path}/${filename}`
                : `${
                    preview ? "preview" : "v2"
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
            : `${
                preview ? "preview" : "v2"
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
        `http://${bucketName}.s3-website-${awsRegion}.amazonaws.com/${
          preview ? "preview" : "v2"
        }/${projectName}/${target}/`
    );
  }
}
