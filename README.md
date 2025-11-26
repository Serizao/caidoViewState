# ViewState Analyzer for Caido

A Caido plugin that analyzes ASP.NET ViewState to detect encryption and MAC signatures.

## Features

- **Automatic ViewState Detection**: Automatically extracts `__VIEWSTATE` parameters from requests
- **Encryption Detection**: Identifies if ViewState is encrypted
- **MAC/HMAC Detection**: Determines if ViewState has integrity protection (signature)
- **Multiple ViewState Support**: Handles requests with multiple ViewState parameters
- **Detailed Analysis**: Shows version byte, entropy analysis, and decoded length

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Build the plugin:
   ```bash
   pnpm build
   ```
4. Load the plugin in Caido from the `dist` folder

## Development

### Watch mode
```bash
pnpm watch
```

### Build
```bash
pnpm build
```

### Lint
```bash
pnpm lint
```

## Usage

1. Open a request in Caido that contains ASP.NET ViewState
2. Click on the "ViewState" tab in the request viewer
3. View the analysis results:
   - ✓ **Valid**: ViewState is valid base64 and parseable
   - 🔏 **Signed (MAC)**: ViewState contains HMAC signature
   - 🔒 **Encrypted**: ViewState appears to be encrypted

## Technical Details

The plugin uses entropy analysis and pattern matching to determine:

- **Encryption**: High entropy (> 7.5) throughout the data suggests encryption
- **MAC/HMAC**: High entropy (> 7.5) in the last 20-32 bytes suggests HMAC signature
- **Version**: First byte indicates ViewState version

## License

MIT

## Author

Serizao - [GitHub](https://github.com/serizao)


## Thank's

Thank's for the work:
- https://www.claranet.com/us/blog/2019-06-13-exploiting-viewstate-deserialization-using-blacklist3r-and-ysoserialnet
- https://github.com/NotSoSecure/Blacklist3r