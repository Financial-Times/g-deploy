/**
 * @file
 * Help screen documentation
 */

import * as chalk from "chalk";
const { cyan, grey } = chalk;
export default `
  ${grey(">")} ft-graphics-deploy ${grey("[FLAGS...]")}
  ${grey(
    "────────────────────────────────────────────────────────────────────"
  )}
  ${grey(`All flags are optional when this command is run from a typical FT
  Graphics project repo in CI.`)}
  ${grey(
    "────────────────────────────────────────────────────────────────────"
  )}
  ${cyan("Vault settings")}
  ${grey(`If not provided these will be inferred from environment variables following
  each flag.`)}
  --vault-endpoint (VAULT_ENDPOINT)
  --vault-role (VAULT_ROLE)
  --vault-secret (VAULT_SECRET)
  --vault-secret-path (VAULT_SECRET_PATH)

  ${cyan("AWS settings (Deprecated for FT projects — use Vault instead)")}
  ${grey(`If not provided, these settings are taken from env vars
  ("AWS_KEY_PROD", "AWS_SECRET_PROD", etc.)`)}
    --aws-key
    --aws-secret
    --aws-region
    --bucket-name

  ${cyan("Upload settings")}
  ${grey("If not provided, these are deduced from the git status in the CWD.")}
    --project-name
    --sha - unique reference for this commit
    --branch-name - name of the branch you are deploying
    --local-dir - what to upload; defaults to ./dist
    --preview - upload files to preview folder
    --assets-prefix - base for asset URLs; affects the rev-manifest and all
                      HTML/CSS files

  ${cyan("Other")}
    --help - show this help and exit
    --get-branch-url - instead of deploying, just print the URL it would deploy to
    --get-commit-url - as above, but get the commit-specific URL
    --confirm - skip the confirmation dialogue when deploying
`;
