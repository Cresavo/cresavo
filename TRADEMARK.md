**Draft, pending legal review**

# Cresavo trademark, brand and media policy

Cresavo is a provisional name and is not registered as a trademark. This
policy covers two things the code licence does not: the **Cresavo brand**
(trademark rights) and a few **standalone brand and media files**
(copyright). Nothing in it limits what the AGPL lets you do with the code, or
uses permitted by applicable law.

## 1. What the AGPL covers

The application source is licensed under [AGPL-3.0-only](LICENSE). That
includes the files the software needs to build and run, even where they show
the brand:

- the design token files the code imports (`design/brand/*/tokens/**`, for
  example `colors.json`);
- the wordmark artwork written into source files (for example
  `src/concept/ui/wordmark.tsx`) and the app icons in `public/brand/**`;
- the AI-generated demo photos in `public/demo/` (see
  [public/demo/manifest.json](public/demo/manifest.json)), to the extent any
  copyright exists in them, and the screenshots and screen recordings of the
  product in `public/site/**`, `public/demo/*.png`, `docs/design/**` and
  `docs/concept/screens/**`.

The AGPL gives copyright permission only. It grants no trademark rights in the
Cresavo name or logo (AGPL section 7(e)).

## 2. What is not covered by the AGPL (all rights reserved)

- the brand kits in `design/brand/**` as standalone artwork and documents
  (wordmark and symbol files, icon sets, typography and voice notes, site
  artwork and earlier kits such as Libovo), except the token files in
  section 1;
- the media in `docs/media/**` (the product tour video and its poster).

You may keep these files, unchanged, in a copy or fork of this repository, and
show the tour video or poster unchanged when writing or talking about the
Cresavo project, with a link to this repository. Any other use needs written
permission.

## 3. Using the Cresavo name and logo

You may:

- fork the repository, keep its attribution and notices, and develop your
  changes in public;
- redistribute unmodified copies of the repository or official releases under
  their original name and logo;
- refer accurately to Cresavo in documentation, articles, reviews, talks and
  comparisons;
- say truthfully that your work "is based on Cresavo" or "works with Cresavo".

Please do not:

- use a name or logo for an independently offered modified product or hosted
  service that is the same as, or confusingly similar to, Cresavo. Give such
  an offering its own public-facing name and logo (in this code, the name
  lives in `src/concept/brand.ts` and the logo in the brand assets);
- use the marks in a way that suggests your version is an official release,
  or that the project sponsors or endorses you;
- register domain names, social media accounts or trademarks that contain the
  Cresavo name.

For any other brand use, ask the maintainer, for example in a GitHub
discussion or issue.
