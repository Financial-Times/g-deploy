/**
 * @file
 * Help screen documentation
 */

import * as chalk from "chalk";
const { cyan, grey } = chalk;
export default `
  ${grey(">")} g-deploy ${grey("[FLAGS...]")}

  <dir> - Path to the directory you want to upload (default: ./dist/)

  ${cyan("Settings Presets")}
  ${grey("These provide default values for bucket, project, branch, etc")}
    --preview - For deploying to our okta-protected preview environment
        expands to: --bucket djd-ig-preview --url-base preview
    --live - To make pages available in ig-router
        expands to: --bucket djd-ig-live --url-base v3 --branch HEAD --tag HEAD --write-versions-json

  ${grey(
    "────────────────────────────────────────────────────────────────────"
  )}
  ${grey(`The remaining flags are optional when this command is run from a typical FT
  Graphics project repo in CI.`)}
  ${grey(
    "────────────────────────────────────────────────────────────────────"
  )}

  ${cyan("AWS settings")}
  ${grey(`Authentication should follow the standard AWS env vars or profile`)}
    --bucket - S3 bucket to upload to, defaults to BUCKET_NAME env
    --public-read - Whether to apply a public-read ACL to the files uploaded
    --aws-region - AWS region the bucket lives in, defaults to AWS_REGION env or 'eu-west-1'

  ${cyan("Upload settings")}
  ${grey("If not provided, these are deduced from the git status in the CWD.")}
    --project - Name of the project, defaults to current git repo (e.g. ft-interactive/some-story)
    --branch - Name of the branch you are deploying, defaults to current in git
    --tag - Tagged version to deploy
    --url-base - First component of the URL to upload to, defaults to 'v2'

  ${cyan("Other")}
    --help - show this help and exit
    --get-branch-url - instead of deploying, just print the URL it would deploy to
    --get-tag-url - as above, but get the tag-specific URL
    --confirm - skip the confirmation dialogue when deploying
    --write-versions-json - write a VERSIONS.json file at the project base containing every version number
`;
