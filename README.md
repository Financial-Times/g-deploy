# g-deploy [![Build Status][circle-image]][circle-url] [![npm](https://img.shields.io/npm/v/@financial-times/g-deploy.svg)](https://npmjs.com/package/@financial-times/g-deploy)

CLI for deploying built static websites to an S3 bucket.

## How to use

Requires Node 8 or higher.

To install:

```bash
$ npm i @financial-times/g-deploy
```

### Command line usage

```
$ g-deploy --help
CLI for deploying FT Graphics projects

  > g-deploy [FLAGS...]

  Settings Presets
  These provide default values for bucket, project, branch, etc
    --preview - For deploying to our okta-protected preview environment
        expands to: --bucket djd-ig-preview --url-base preview
    --live - To make pages available in ig-router
        expands to: --bucket djd-ig-live --url-base v3 --branch HEAD --tag HEAD --write-versions-json

  ────────────────────────────────────────────────────────────────────
  The remaining flags are optional when this command is run from a typical FT
  Graphics project repo in CI.
  ────────────────────────────────────────────────────────────────────

  AWS settings
  Authentication should follow the standard AWS env vars or profile
    --bucket - S3 bucket to upload to, defaults to BUCKET_NAME env
    --public-read - Whether to apply a public-read ACL to the files uploaded
    --aws-region - AWS region the bucket lives in, defaults to AWS_REGION env or 'eu-west-1'

  Upload settings
  If not provided, these are deduced from the git status in the CWD.
    --project - Name of the project, defaults to current git repo (e.g. ft-interactive/some-story)
    --branch - Name of the branch you are deploying, defaults to current in git
    --tag - Tagged version to deploy
    --dir - What to upload; defaults to ./dist/client
    --url-base - First component of the URL to upload to, defaults to 'v2'

  Other
    --help - show this help and exit
    --get-branch-url - instead of deploying, just print the URL it would deploy to
    --get-tag-url - as above, but get the tag-specific URL
    --confirm - skip the confirmation dialogue when deploying
    --write-versions-json - write a VERSIONS.json file at the project base containing every version number
```

## JavaScript API

The most straightforward way:

```js
import deploy from "@financial-times/g-deploy";

deploy(options).then((baseURLs) => {
  console.log("uploaded to:", baseURLs);
});
```

For more fine-grained control:

```js
import { Deployer } from "@financial-times/g-deploy";

const deployer = new Deployer(options);

deployer.execute().then((baseURLs) => {
  console.log("uploaded to:", baseURLs);
});
```

The JavaScript API does **not** do any git-sniffing or use any environment variables to configure the deployment – you must pass in all required options manually. See the [Deployer class](./src/Deployer.js) source for the full options.

## Development

Clone this repo and run `yarn` to install dependencies.

Run `yarn build -- --watch` and `yarn test -- --watch` in separate terminal tabs while developing. (The first one watches `src` and builds to `dist`. The second one runs ava tests in `dist`.)

## Publishing to NPM

After you merge a pull request with a new feature, you should deploy it to NPM. To do so:

1. Make sure you're on main: `git checkout main`
2. Run `npm version [major|minor|patch]` to increment the version based on the type of changes in this release. We use [Semantic Versioning](https://semver.org/) to increment versions:

- Breaking (non-backwards-compatible) changes should be a `major` release
- New features (that are backwards-compatible) should be `minor`
- Bug fixes should be a `patch`
- Alternatively, you can use `npm version vX.X.X` to set the version yourself.

3. Run `git push --follow-tags` to push the new version to GitHub, which will trigger the CircleCI pipeline that publishes the new version on NPM.

### Pre-release ("canary") versions

If you'd like to release a pre-release version (e.g. to test or gradually roll out a new feature), you can create a new version like `npm version v1.0.0-canary.0`. The version number should represent the ultimate release this change will land in, while the final `0` can be incremented to make subsequent prerelease builds.

NPM can also generate this automatically for you, with `npm version pre[major|minor|patch] --preid canary`.

<!-- badge URLs -->

[circle-url]: https://circleci.com/gh/ft-interactive/g-deploy
[circle-image]: https://circleci.com/gh/ft-interactive/g-deploy.svg?style=svg
