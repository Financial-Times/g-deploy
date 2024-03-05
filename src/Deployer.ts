/**
 * @file
 * EventEmitter-based deployer class.
 * This does all the work.
 */

import { S3 } from "aws-sdk";
import { EventEmitter } from "events";
import { readFileSync } from "fs";
import { sync as glob } from "glob";
import { lookup as mime } from "mime-types";
import { extname, join } from "path";
import { listGitTags } from "./util";

export interface IDeployerOptions {
  dir: string; // e.g. '/path/to/dist'

  awsRegion?: string;
  bucket: string;

  cacheAssets: boolean; // whether to cache the assets/ dir forever

  publicRead: boolean; // whether to apply a public-read ACL

  project: string; // usually in the form 'ft-interactive/some-project'

  urlBase?: string; // prefix for project name, e.g. 's3://v2/<project>'

  targets: string[]; // for reference, the CLI provides two targets: the branch name and tag

  path?: string; // Set arbitrary S3 prefix instead of using existing path logic

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
      dir,
      bucket,
      project,
      publicRead,
      awsRegion,
      targets,
      path,
      maxAge,
      cacheAssets,
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
    const client = new S3();

    const allFiles: string[][] = glob(`${dir}/**/*`, { nodir: true }).map(
      (filePath) => [filePath, filePath.replace(`${dir}/`, "")]
    );

    const dests = path ? [""] : targets;

    await dests.reduce(async (queue: Promise<any[]>, target: string) => {
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
              ACL: publicRead ? "public-read" : undefined,
              Body: readFileSync(filePath as string),
              Bucket: bucket,
              CacheControl:
                cacheAssets && filename.match(/^(assets|static)\//)
                  ? "max-age=365000000, immutable"
                  : `max-age=${typeof maxAge === "number" ? maxAge : 60}`,
              ContentType,
              Key: this.getPath(filename, target),
              ...otherOptions,
            })
            .promise();
        })
      ).then(() => {
        this.emit("uploaded", {
          info: `${path || target} (bundle)`,
        });
      });

      return [...acc, await uploadedTarget];
    }, Promise.resolve([]));

    if (writeVersionsJson) {
      const tags = await listGitTags();

      await client
        .putObject({
          ACL: publicRead ? "public-read" : undefined,
          Body: JSON.stringify(tags || []),
          Bucket: bucket,
          CacheControl: `max-age=${typeof maxAge === "number" ? maxAge : 60}`,
          ContentType: "application/json",
          Key: this.getPath(VERSIONS_JSON_FILENAME),
          ...otherOptions,
        })
        .promise()
        .then(() =>
          this.emit("uploaded", {
            info: `${project} (modified versions: ${VERSIONS_JSON_FILENAME})`,
          })
        );
    }

    return this.getURLs();
  }

  /**
   * Returns the base URLs that this deployer would deploy to.
   */
  public getURLs() {
    const { bucket, publicRead, awsRegion, targets, path, urlBase } =
      this.options;

    const urls = path ? [path] : targets.map((t) => this.getPath("/", t));

    const domain =
      bucket === "djd-ig-preview"
        ? `https://ig.in.ft.com/`
        : publicRead
        ? `http://${bucket}.s3-website-${awsRegion}.amazonaws.com`
        : `https://${bucket}.s3.${awsRegion}.amazonaws.com`;

    return urls.map((url) => `${domain}/${url}`);
  }

  private getPath(file: string, target = "") {
    const { urlBase, path, project } = this.options;

    const parts: Array<string | undefined> = [urlBase];

    if (path) {
      parts.push(path);
    } else {
      parts.push(project, target);
    }

    parts.push(file);

    // Join non-empty path parts
    return join(...parts.flatMap((s) => (s?.length ? [s] : [])));
  }
}
