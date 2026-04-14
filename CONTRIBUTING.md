## Development

This is a TypeScript + React application built with Vite.

### Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:5173` (or the URL shown in your terminal).

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Build & Deploy

```bash
# Build for production
npm run build

# Preview production build locally
npm run preview

# Deploy to GitHub Pages
npm run deploy
```

See [RELEASE.md](./RELEASE.md) for detailed deployment instructions.

## Tech Stack

- **Frontend**: React 19 with TypeScript
- **Build**: Vite
- **Testing**: Vitest with jsdom
- **Styling**: CSS
- **Deployment**: GitHub Pages

## File Organization

```
src/
├── engine/              # Core calculation engine
│   ├── models/         # Hill models (Minetti, RE3, Ultrapacer, etc)
│   ├── planner/        # Race planning logic
│   ├── slowdown/       # Slowdown scenarios
│   ├── export/         # Export formats (CSV, JSON, tattoo)
│   └── utils/          # Utilities (pace formatting, units, bisection)
└── ui/
    └── components/     # React components
tests/                  # Unit and integration tests
```
