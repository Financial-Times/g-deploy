/**
 * @file
 * Help screen documentation
 */

import * as chalk from "chalk";
const { cyan, grey } = chalk;
export default `
  ${grey(">")} g-deploy ${grey("[FLAGS...]")}
  ${grey(
    "────────────────────────────────────────────────────────────────────"
  )}
  ${grey(`All flags are optional when this command is run from a typical FT
  Graphics project repo in CI.`)}
  ${grey(
    "────────────────────────────────────────────────────────────────────"
  )}

  ${cyan("AWS settings")}
  ${grey(`Authentication should follow the standard AWS env vars`)}
    --aws-region
    --bucket-name

  ${cyan("Upload settings")}
  ${grey("If not provided, these are deduced from the git status in the CWD.")}
    --project-name
    --branch-name - name of the branch you are deploying
    --tag - tagged version to also deploy to
    --local-dir - what to upload; defaults to ./dist
    --preview - upload files to preview folder

  ${cyan("Other")}
    --help - show this help and exit
    --get-branch-url - instead of deploying, just print the URL it would deploy to
    --get-tag-url - as above, but get the tag-specific URL
    --confirm - skip the confirmation dialogue when deploying
    --write-versions-json - write a VERSIONS.json file at the project base containing every version number
`;
