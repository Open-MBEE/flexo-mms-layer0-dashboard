# MMS5 Layer 0 Admin Dashboard
Webapp GUI allowing admins to inspect and edit MMS5 named graphs.

## Install

For NPM users:
```sh
npm i
npm run dev
```

For Yarn:
```sh
yarn install
yarn dev
```


## Setup

Create a file `.env.local` with the following variables set:
```sh
VITE_ROOT_CONTEXT='https://your-mms5-root-context'
VITE_SPARQL_ENDPOINT='https://cors-compatible-endpoint/sparql'
```
