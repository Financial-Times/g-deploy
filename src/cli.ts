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
import vault from "./vault";

interface ICLIFlags {
  cacheAssets?: string;
  awsRegion?: string;
  branchName?: string;
  bucketName?: string;
  confirm?: boolean;
  getBranchUrl?: boolean;
  getTagUrl?: boolean;
  localDir?: string;
  path?: string;
  preview?: string;
  projectName?: string | null;
  tag?: string;
  targets?: Array<string | undefined>;
  vaultEndpoint?: string;
  vaultRole?: string;
  vaultSecret?: string;
  vaultSecretPath?: string;
  writeVersionsJson?: boolean;
}

export default async () => {
  // use meow to parse CLI arguments
  const cli = meow(help);

  // define our defaults - some of which come from environment variables
  const defaults = {
    awsRegion: process.env.AWS_REGION_PROD || "eu-west-1",
    bucketName: process.env.BUCKET_NAME_PROD,
    cacheAssets: true,
    localDir: "dist",
    path: undefined,
    preview: false,
    tag: undefined,
    vaultEndpoint: process.env.VAULT_ENDPOINT,
    vaultRole: process.env.VAULT_ROLE,
    vaultSecret: process.env.VAULT_SECRET,
    vaultSecretPath: process.env.VAULT_SECRET_PATH,
    writeVersionsJson: process.env.WRITE_VERSIONS_JSON || true,
  };

  const options = { ...defaults, ...(cli.flags as ICLIFlags) };

  // unless provided, magically infer the variables that determine our deploy targets
  if (!options.projectName || !options.branchName) {
    await verifyGitVersion();

    // infer the project name from the GitHub repo name
    if (!options.projectName) {
      const originURL = (
        await git(["config", "--get", "remote.origin.url"])
      ).trim();

      const { repo, host } = parseGitHubURL(originURL) as parseGitHubURL.Result;

      if (host !== "github.com") {
        throw new Error(
          `Expected git remote "origin" to be a github.com URL, but it was: ${originURL}`
        );
      }

      options.projectName = repo;
    }

    // use the name of the branch we're on now
    if (!options.branchName) {
      options.branchName = (
        await git(["rev-parse", "--abbrev-ref", "--verify", "HEAD"])
      ).trim();
    }
  }

  // validate options
  if (!options.bucketName) {
    throw new Error("bucketName not set");
  }
  if (!options.awsRegion) {
    throw new Error("awsRegion not set");
  }

  if (!options.branchName) {
    throw new Error("branchName not set");
  }

  // By default, publish to the branchname
  options.targets = [options.branchName];
  if (options.tag) {
    options.targets.push(options.tag);
  } else if (!options.preview) {
    // Infer any current tag from git and publish there (only in prod)
    const tags = await listGitTags("HEAD");
    options.targets.push(...tags);
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
    "\nOptions:\n" +
      `  local dir: ${options.localDir}\n` +
      `  project name: ${options.projectName}\n` +
      `  branch name: ${options.branchName as string}\n` +
      `  tag: ${options.tag}\n` +
      `  cache assets: ${options.cacheAssets}\n` +
      `  preview: ${options.preview}\n` +
      `  bucket: ${options.bucketName}\n`
  );

  if (options.path) {
    console.log(`  path (BE CAREFUL): ${options.path}`);
  }

  // ask for confirmation
  if (
    !options.confirm &&
    !(await inquirer.prompt([{ type: "confirm", message: "Continue?" }]))
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
