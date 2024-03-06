/**
 * @file
 * Provides various utility functions
 */

import * as execa from "execa";
import { parse as semver } from "semver";

export const git = async (args: string[]) => {
  const { stdout, stderr } = await execa("git", args);
  if (stderr) {
    throw new Error(stderr);
  }

  return stdout;
};

/**
 * Verifies the system's git is at least v1.7.0.
 */
export const verifyGitVersion = async () => {
  const gitVersionStr = (await git(["--version"])).replace(/[^\d.]/g, "");

  const gitVersion = semver(gitVersionStr);

  if (!gitVersion) {
    throw new Error("Unable to parse Git version or Git not available.");
  } else if (gitVersion.major <= 1 && gitVersion.minor <= 7) {
    throw new Error(
      `Expected git version 32 or higher, but it was: "${gitVersion.version}"`
    );
  }

  return gitVersion;
};

/**
 * Verifies the required options are present; throw if not
 */
export const verifyOptions = ({
  awsKey,
  awsSecret,
  awsRegion,
  bucketName,
}: IVerifyOptions) => {
  if (!awsKey) {
    throw new Error("Could not find an AWS access key ID.");
  }

  if (!awsSecret) {
    throw new Error("Could not find an AWS secret access key.");
  }

  if (!awsRegion) {
    throw new Error("Could not find an AWS region.");
  }

  if (!bucketName) {
    throw new Error("Could not find an AWS S3 bucket name.");
  }
};

interface IVerifyOptions {
  awsKey?: string;
  awsSecret?: string;
  awsRegion?: string;
  bucketName?: string;
  [key: string]: any;
}

export const listGitTags = async (at?: string) => {
  const output = await git(at ? ["tag", "--points-at", at] : ["tag"]);
  return output
    .split("\n")
    .map((v) => v.trim())
    .filter((v) => /^v\d/.test(v))
    .sort();
};
