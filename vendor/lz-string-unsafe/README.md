lz-string-unsafe
=========
LZ-based (unsafe) compression algorithm for JavaScript

## Forked version

This fork is copied directly from https://github.com/JobLeonard/lz-string/tree/array-lookup branch.

We slapped a `-fork-{local change index}` suffix on the last version and pushed it to npm. The `{local change index}` is incremented whenever we make a change to the fork.

Why? Because we needed to include this library in our Stylus extension and every library we use needs to have a proper source location with a release (that isn't a beta version).

## Install via [npm](https://npmjs.org/)

```shell
$ npm install -g lz-string-unsafe
$ lz-string-unsafe input.js > output.txt
```

## Development

The `lz-string-unsafe.js` file in the root directory was modified independently of the source files located in the `libs` folder.

To create the `lz-string-unsafe.min.js` file, use the following in the command line:

```shell
$ npm run minify
```

This uses [uglify-es](https://www.npmjs.com/package/uglify-es) to compress & create the minified file.

Open the `tests/SpecRunner-unsafe.html` file in the browser to test the *minified* file, since this is the version we're using in Stylus.

## Home page
Home page for this program with examples, documentation and a live demo: http://pieroxy.net/blog/pages/lz-string/index.html
