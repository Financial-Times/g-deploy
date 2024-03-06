/**
 * @file
 * Main CLI interface
 */

import * as chalk from "chalk";
import * as inquirer from "inquirer";
import * as meow from "meow";
import * as parseGitHubURL from "parse-github-url";
import Deployer, { IDeployerOptions } from "./Deployer";
import help from "./help";
import { git, verifyGitVersion, listGitTags } from "./util";

interface ICLIFlags {
  preview?: boolean;
  live?: boolean;
  cacheAssets?: string;
  branch?: string;
  bucket?: string;
  project?: string | null;
  confirm?: boolean;
  path?: string;
  tag?: string;
  getBranchUrl?: boolean;
  getTagUrl?: boolean;
  dir?: string;
  urlBase?: string;
  targets?: Array<string | undefined>;
  writeVersionsJson?: boolean;
  publicRead?: boolean;
}

export default async () => {
  // use meow to parse CLI arguments
  const cli = meow(help);

  // define our defaults - some of which come from environment variables
  const defaults = {
    awsRegion: process.env.AWS_REGION || "eu-west-1",
    bucket: process.env.BUCKET_NAME,
    cacheAssets: true,
    dir: "dist/client",
    urlBase: cli.flags.path ? undefined : "v2",
    path: undefined,
    tag: undefined,
    branch: undefined,
    writeVersionsJson: process.env.WRITE_VERSIONS_JSON,
    publicRead: false,
  };

  // 'preview' defaults, applied when the --preview flag is set
  const preview = {
    dir: "dist/client",
    awsRegion: "eu-west-1",
    bucket: "djd-ig-preview",
    urlBase: "preview",
  };

  // 'live' defaults, applied when the --live flag is set
  const live = {
    dir: "dist/client",
    awsRegion: "eu-west-1",
    bucket: "djd-ig-live",
    branch: "HEAD",
    tag: "HEAD",
    urlBase: "v3",
    writeVersionsJson: true,
  };

  const options = {
    ...defaults,
    ...(cli.flags.preview ? preview : {}),
    ...(cli.flags.live ? live : {}),
    ...(cli.flags as ICLIFlags),
    ...(cli.input.length ? { dir: cli.input[0] } : {}),
  };

  // unless provided, magically infer the variables that determine our deploy targets
  if (!options.project || !options.branch) {
    await verifyGitVersion();

    // infer the project name from the GitHub repo name
    if (!options.project) {
      const originURL = (
        await git(["config", "--get", "remote.origin.url"])
      ).trim();

      const { repo, host } = parseGitHubURL(originURL) as parseGitHubURL.Result;

      if (host !== "github.com") {
        throw new Error(
          `Expected git remote "origin" to be a github.com URL, but it was: ${originURL}`
        );
      }

      options.project = repo?.toLowerCase();
    }

    // use the name of the branch we're on now
    if (!options.branch) {
      options.branch = (
        await git(["rev-parse", "--abbrev-ref", "--verify", "HEAD"])
      ).trim();
    }
  }

  // validate options
  if (!options.bucket) {
    throw new Error("bucket not set");
  }
  if (!options.awsRegion) {
    throw new Error("awsRegion not set");
  }

  if (!options.branch) {
    throw new Error("branchName not set");
  }

  // By default, publish to the branchname
  options.targets = [options.branch];

  if (options.tag === "HEAD") {
    options.tag = "(tags at HEAD)";
    // Infer any current tags at git HEAD
    const tags = await listGitTags("HEAD");
    options.targets.push(...tags);
  } else if (options.tag) {
    options.targets.push(options.tag);
  }

  // construct our deployer
  const deployer = new Deployer(options as IDeployerOptions);

  // handle special --get-branch-url or --get-tag-url use cases
  if (options.getBranchUrl || options.getTagUrl) {
    process.stdout.write(deployer.getURLs()[options.getBranchUrl ? 0 : 1]);
    process.exit();
  }

  // report options (except secrets)
  console.log(
    "g-deploy: Deploying from...\n" +
      `  dir: ${options.dir}\n` +
      "to...\n" +
      `  bucket: ${options.bucket}\n` +
      `  url base: ${options.urlBase}\n` +
      `  project: ${options.project}\n` +
      `  branch: ${options.branch as string}\n` +
      `  tag: ${options.tag}\n` +
      `  cache assets: ${options.cacheAssets}\n`
  );

  if (options.path) {
    console.log(`  path (BE CAREFUL): ${options.path}`);
  }

  // ask for confirmation
  if (
    !options.confirm &&
    !(await inquirer.prompt([
      { name: "deploy", type: "confirm", message: "Continue?" },
    ]))
  ) {
    process.exit();
  }

  // deploy!
  const urls = await deployer.execute();

  // report result
  console.log(chalk.green("Deployment complete."));

  urls.forEach((url: string) => {
    console.log(chalk.cyan(`  ${url}`));
  });
};
