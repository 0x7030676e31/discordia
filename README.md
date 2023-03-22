# Discordia
Discordia is a TypeScript project that provides a way to map incoming WebSocket payloads into types based on provided configuration. It is specifically designed to map Discord's WebSocket API.

## Why Discordia exists?
Discord has a well documented WebSocket API, but it is made specifically for bots. This means that some of the payloads are not documented, and some of the payloads are not documented correctly. Discordia aims to solve this problem by providing a way to map incoming payloads using user account.

## How it works?
Discordia uses user like websocket connection to map incoming payloads that only user can receive. After receiving an event, it will be merged with existing dataset and saved locally. This dataset can be used to generate TypeScript declarations file.

## Usage

### Installation
```bash
git clone https://github.com/0x7030676e31/discordia.git
cd discordia
npm install
```

### Configuration
- Provide environment variable `TOKEN` with your user token.
- Configure `.cfg` file to match your needs (you can use default one).

### Running
```bash
npm start
```

Note that after running, Discordia will create directory named `types` and will store all generated types and data there. If you want to reset data, just delete this directory. 

### Generating types
```bash
npm run compile
```

This will generate `types.ts` file in `types` directory as well as `declarations.txt` file which will contain list of all generated types.

## Risk
Discordia uses user token to connect to Discord's WebSocket API. It's designed to mimic user's behavior, but it's not guaranteed that it will not be detected by Discord. However, I Iused such tools a lot and never got banned so it's relatively safe to use.

## TODO
- Complete websocket cycle