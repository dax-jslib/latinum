# Latinum

A browser-side composition framework for fast rendering and navigation of complex page structures.

## Generating Javascript documentation.

The source code for Latinum has been annotated with inline comments that conform to the syntax
understood by JSDoc. In order to generate the documentation, install JSDoc and then execute the
following command at a terminal:

```
jsdoc lib -c jsdoc.json -d apidocs -R README.md
```